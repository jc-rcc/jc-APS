param(
    [Parameter(Mandatory=$true)][ValidateSet('Start','Stop')][string]$Action,
    [string]$AppRoot = ''
)
$ErrorActionPreference = 'Stop'
if (-not $AppRoot) { $AppRoot = Split-Path -Parent $PSScriptRoot }
$AppRoot = (Resolve-Path -LiteralPath $AppRoot).Path
$entryPoint = Join-Path $AppRoot 'server\server.js'
$runtimeFolder = Join-Path $AppRoot 'tmp'
$processFile = Join-Path $runtimeFolder 'server-process.json'
$serverProcess = $null
$resultCode = 0

try {
    if ($Action -eq 'Stop') {
        if (-not (Test-Path -LiteralPath $processFile)) {
            Write-Host '[INFO] No server started by START.bat was found.'
            Write-Host 'For a manually started server, press Ctrl+C in its terminal.'
            exit 0
        }
        $record = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
        if (-not [string]::Equals([string]$record.entryPoint, $entryPoint, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'The server record belongs to a different checkout. Nothing was stopped.'
        }
        $serverProcess = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
        if (-not $serverProcess) {
            Remove-Item -LiteralPath $processFile
            Write-Host '[INFO] The server has already stopped.'
            exit 0
        }
        if ($serverProcess.StartTime.ToUniversalTime().Ticks.ToString() -ne [string]$record.startedUtcTicks -or
            -not [string]::Equals($serverProcess.Path, [string]$record.nodePath, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'The recorded process identity no longer matches. Nothing was stopped.'
        }
        $command = (Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$record.pid)).CommandLine
        $entryPattern = '(?i)(?:^|\s)"?' + [regex]::Escape($entryPoint) + '"?\s*$'
        if (-not $command -or $command -notmatch $entryPattern) {
            throw 'The process is not running this Payroll server. Nothing was stopped.'
        }
        Remove-Item -LiteralPath $processFile
        Stop-Process -Id $serverProcess.Id -ErrorAction Stop
        Write-Host '[OK] Stopped this RCC-APS server. MySQL and other apps remain running.'
        exit 0
    }

    Set-Location -LiteralPath $AppRoot
    if (-not (Test-Path -LiteralPath $entryPoint)) { throw 'Payroll server files were not found.' }
    $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    if (-not $node) { throw 'Install Node.js 22 or newer from https://nodejs.org, then run START.bat again.' }
    $nodeVersion = & $node -p 'process.versions.node'
    if ($LASTEXITCODE -ne 0 -or [int]($nodeVersion.Split('.')[0]) -lt 22) {
        throw ('Node.js 22 or newer is required. Installed version: ' + $nodeVersion)
    }
    Write-Host ('[OK] Node.js ' + $nodeVersion)
    $port = 3000
    if ($env:PORT) {
        if (-not [int]::TryParse($env:PORT, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
            throw 'PORT must be a number from 1 to 65535.'
        }
    }
    $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    if ($listeners | Where-Object { $_.Port -eq $port }) {
        throw ('Port ' + $port + ' is already in use. Close its server first, or use the existing Payroll window. No processes were stopped.')
    }
    if (Test-Path -LiteralPath $processFile) {
        $existingRecord = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
        if (Get-Process -Id ([int]$existingRecord.pid) -ErrorAction SilentlyContinue) {
            throw 'A server process is already recorded for this checkout. Use shutdown.bat before starting again.'
        }
        Remove-Item -LiteralPath $processFile
    }
    New-Item -ItemType Directory -Path $runtimeFolder -Force | Out-Null
    $lockFile = Join-Path $AppRoot 'package-lock.json'
    $hashFile = Join-Path $runtimeFolder 'dependencies.sha256'
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { $lockHash = [BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($lockFile))).Replace('-', '') }
    finally { $hasher.Dispose() }
    $savedHash = if (Test-Path -LiteralPath $hashFile) { (Get-Content -LiteralPath $hashFile -Raw).Trim() } else { '' }
    $install = $savedHash -ne $lockHash
    if (-not $install) {
        $dependencyProbe = @'
try { for (const name of Object.keys(require('./package.json').dependencies || {})) require.resolve(name); } catch (_) { process.exit(1); }
'@
        & $node -e $dependencyProbe 2>$null
        $install = $LASTEXITCODE -ne 0
    }
    if ($install) {
        $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
        if (-not $npm) { throw 'npm was not found. Reinstall Node.js 22 or newer.' }
        Write-Host '[INFO] Installing the locked dependencies. Internet access is required.'
        & $npm ci --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your internet connection and try again.' }
        Set-Content -LiteralPath $hashFile -Value $lockHash -Encoding ASCII
    }
    Write-Host '[INFO] Checking MySQL using the app DB_HOST, DB_USER and DB_PASSWORD settings...'
    $databaseProbe = @'
const mysql = require('mysql2/promise');
mysql.createConnection({host:process.env.DB_HOST || 'localhost',user:process.env.DB_USER || 'root',password:process.env.DB_PASSWORD || '',connectTimeout:5000})
 .then(c => c.end())
 .catch(() => { console.error('[ERROR] Cannot connect to MySQL. Start MySQL in XAMPP and check DB_HOST, DB_USER and DB_PASSWORD.'); process.exit(1); });
'@
    & $node -e $databaseProbe
    if ($LASTEXITCODE -ne 0) { throw 'MySQL is required. The Payroll server was not started.' }
    Write-Host '[OK] MySQL connected.'
    Write-Host '[INFO] Startup checks and schema updates will run automatically.'
    Write-Host '[INFO] Existing records are kept. A fresh empty database receives seed data.'
    Write-Host '[INFO] To use the exported records on another PC, import rcc_aps.sql before starting.'
    Write-Host ('Open http://localhost:' + $port + ' after the server reports it is ready.')
    Write-Host 'Use shutdown.bat or press Ctrl+C in this window to stop the server.'
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $node
    $startInfo.Arguments = '"' + $entryPoint + '"'
    $startInfo.WorkingDirectory = $AppRoot
    $startInfo.UseShellExecute = $false
    $serverProcess = [Diagnostics.Process]::Start($startInfo)
    try {
        @{pid=$serverProcess.Id; startedUtcTicks=$serverProcess.StartTime.ToUniversalTime().Ticks.ToString(); nodePath=$node; entryPoint=$entryPoint} |
            ConvertTo-Json | Set-Content -LiteralPath $processFile -Encoding UTF8
    } catch {
        if (-not $serverProcess.HasExited) { $serverProcess.Kill() }
        throw
    }
    $serverProcess.WaitForExit()
    if ($serverProcess.ExitCode -ne 0 -and (Test-Path -LiteralPath $processFile)) {
        throw 'The server exited with an error. Read the startup message above.'
    }
} catch {
    Write-Host ('[ERROR] ' + $_.Exception.Message)
    $resultCode = 1
} finally {
    if ($Action -eq 'Start' -and $serverProcess) {
        if (-not $serverProcess.HasExited) { $serverProcess.Kill() }
        if (Test-Path -LiteralPath $processFile) {
            $remainingRecord = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
            if ($remainingRecord.pid -eq $serverProcess.Id) { Remove-Item -LiteralPath $processFile }
        }
    }
}
exit $resultCode
