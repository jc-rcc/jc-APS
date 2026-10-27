# Google sign-in for RCC Payroll

Google sign-in accepts only verified Google Workspace accounts whose hosted
domain and email domain are `rcc.edu.ph`. Admin creates the Payroll account first,
using the employee's school email, and assigns its role. Finance sets compensation.
Existing active accounts keep their Payroll roles and records when signing in.
Google sign-in does not create accounts. An unregistered user is told to contact
the System Administrator; inactive accounts cannot sign in.

## Activate

1. In Google Cloud Console, create/select a project and configure its Google Auth
   Platform branding and audience. A project outside the school organization uses
   an External audience; add school test users while the app is in Testing.
2. Create an OAuth client of type **Web application**. Add the exact Payroll
   origin to **Authorized JavaScript origins**, e.g. `http://localhost:3000` for
   development and the actual HTTPS origin for deployment. This uses Google's
   popup callback, so it does not need a redirect URI or client secret.
3. Put its public Client ID into `server/sso-config.json` as `googleClientId`, or
   set the `GOOGLE_CLIENT_ID` environment variable. Restart the app.
4. Open Payroll and click **Continue with Google**. Test an existing employee,
   an unregistered school account, an inactive account and a personal Gmail account.

No school administrator credential is needed to write or configure this app.
Google Workspace policy can still require the school to allow the OAuth app.
Without a real Client ID, the Google button stays disabled and local school-email
password login remains available. The app never receives Google's password.

## Identity and sessions

The server uses Google's official library to verify signatures, issuer, audience
and expiry, and checks the Workspace domain, verified email, and login nonce.
Each short-lived nonce is bound to a SameSite HttpOnly cookie and consumed once.
Account linking runs inside a database transaction under the same lock as other
Payroll writes. `auth.googleSub` uniquely links Google's
stable account ID and is never accepted from browser state submissions.
Only an Admin-created account can be linked; Google profile data cannot assign
roles, compensation or personnel details.
Logout ends the Payroll session; it does not sign the browser out of Google.

Migration adds nullable `auth.googleSub` and its unique index at server startup.
Back up the database before deploying this update to another installation.

Official setup: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
Token verification: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
