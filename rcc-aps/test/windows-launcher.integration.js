'use strict';
// Uses a disposable fake app and DB driver. Never starts/stops the live Payroll server.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto'),http=require('http');
const {spawn}=require('child_process');
if(process.platform!=='win32'){console.log('SKIP: Windows launcher test requires Windows.');process.exit(0);}
const helper=path.resolve(__dirname,'../scripts/windows.ps1');
fs.mkdirSync(path.resolve(__dirname,'../tmp'),{recursive:true});
const root=fs.mkdtempSync(path.resolve(__dirname,'../tmp/launcher-test-'));
const recordFile=path.join(root,'tmp/server-process.json');
let launcher,output='';
const active=new Set();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function run(action,port){
 const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',helper,'-Action',action,'-AppRoot',root],{env:{...process.env,PORT:String(port)},windowsHide:true});
 active.add(child);
 let text='';child.stdout.on('data',data=>{text+=data;output+=data;});child.stderr.on('data',data=>{text+=data;output+=data;});
 child.finished=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>{active.delete(child);resolve({code,text});});});
 return child;
}
function readRecord(){return JSON.parse(fs.readFileSync(recordFile,'utf8').replace(/^\uFEFF/,''));}
async function waitFor(predicate){for(let i=0;i<600;i++){if(await predicate())return;await delay(100);}throw Error('Launcher timeout. '+output);}
function alive(pid){try{process.kill(pid,0);return true;}catch{return false;}}
(async()=>{
 for(const folder of ['server/db','tmp','node_modules/pg'])fs.mkdirSync(path.join(root,folder),{recursive:true});
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:{pg:'test'}}));
 const lock='test-lock';fs.writeFileSync(path.join(root,'package-lock.json'),lock);
 fs.writeFileSync(path.join(root,'tmp/dependencies.sha256'),crypto.createHash('sha256').update(lock).digest('hex').toUpperCase());
 fs.writeFileSync(path.join(root,'node_modules/pg/index.js'),'module.exports={};');
 fs.writeFileSync(path.join(root,'server/db/postgres.js'),"module.exports={query:async()=>[[]],close:async()=>{}};");
 fs.writeFileSync(path.join(root,'server/server.js'),"require('http').createServer((req,res)=>res.end('fixture')).listen(Number(process.env.PORT));");
 const reservation=http.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
 const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 launcher=run('Start',port);
 await waitFor(()=>fs.existsSync(recordFile));
 const record=readRecord();assert.ok(alive(record.pid));assert.equal(record.entryPoint,path.join(root,'server/server.js'));
 await waitFor(async()=>{try{const response=await fetch('http://localhost:'+port);return await response.text()==='fixture';}catch{return false;}});
 const duplicate=await run('Start',port).finished;assert.equal(duplicate.code,1);assert.match(duplicate.text,/already in use/);assert.ok(alive(record.pid));
 fs.writeFileSync(recordFile,JSON.stringify({...record,startedUtcTicks:'1'}));
 const mismatch=await run('Stop',port).finished;assert.equal(mismatch.code,1);assert.match(mismatch.text,/identity no longer matches/);assert.ok(alive(record.pid),'Refuse to stop a mismatched process');
 fs.writeFileSync(recordFile,JSON.stringify(record));
 const stopped=await run('Stop',port).finished;assert.equal(stopped.code,0,stopped.text);
 await launcher.finished;assert.equal(fs.existsSync(recordFile),false);assert.equal(alive(record.pid),false);
 assert.equal((await run('Stop',port).finished).code,0,'Repeated shutdown is harmless');
 // Failed DB connection must stop startup and must not claim offline login works.
 fs.writeFileSync(path.join(root,'server/db/postgres.js'),"module.exports={query:async()=>{throw Error('fixture offline');}};");
 const offline=await run('Start',port).finished;assert.equal(offline.code,1);assert.match(offline.text,/Cannot connect to PostgreSQL/);assert.equal(fs.existsSync(recordFile),false);
 console.log('PASS: Windows start/stop with spaces in paths, dependency check, DB failure, duplicate port protection, process identity validation and repeated shutdown.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
 // Retain the fixture for diagnostics. Cleanup only processes created by this test.
 if(fs.existsSync(recordFile)){const record=readRecord();if(record.entryPoint===path.join(root,'server/server.js')&&alive(record.pid))process.kill(record.pid);}
 for(const child of active)child.kill();
});
