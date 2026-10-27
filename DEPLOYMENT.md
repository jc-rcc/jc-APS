# JC-APS Deployment Strategy: Vercel + Supabase

## Scope and deployment status

JC-APS is an independent academic copy of the RCC Automated Payroll System, deployed only from **https://github.com/jc-rcc/jc-APS**. The original `jc-rcc/rcc-aps` checkout, hosting project and MySQL database are not changed or reused.

The assignment Supabase project **`jc-aps`** has been created in **Tokyo (`ap-northeast-1`)**. Application/database connection, demo provisioning and live Vercel verification are still pending. No older deployment URL should be submitted as the new application's URL.

## 1. Architecture and infrastructure choice

The frontend is vanilla HTML/CSS/JavaScript in `rcc-aps/public`. It calls same-origin Express endpoints under `/api/*`. The backend runs on Node.js 22 and is exported as a Vercel handler by `rcc-aps/api/index.js`. The current catch-all Vercel routing sends both API and static file requests through Express; it does not separately publish static files to a CDN-only route.

**Vercel hosts the application and Express API.** The existing handler makes this a small hosting change. Managed HTTPS, deployment versions and environment configuration reduce server administration for the class demonstration.

**Supabase hosts a separate PostgreSQL database.** The application uses the `pg` driver and Supabase's **Transaction pooler** connection from Dashboard → Connect. Supabase is used as a SQL database; existing Express JWT authentication, bcrypt passwords and role checks are retained. Supabase Auth, public API keys and a browser-side database client are not required.

```text
Browser -- HTTPS --> Vercel Express API -- verified TLS --> Supabase pooler
                                                       --> PostgreSQL jc_aps schema
GitHub main --> npm ci --> syntax/smoke/PostgreSQL tests --> build --> deploy
```

### Changes required by PostgreSQL

This is a real database migration, not just a credential change. The SQL schema uses PostgreSQL identity columns, quoted application field names, unique indexes and foreign keys. SQL statements use PostgreSQL placeholders and `ON CONFLICT`. Null-safe state updates use `IS NOT DISTINCT FROM`. Dates remain calendar strings and decimal fields retain the application's existing numeric conversions.

Write operations use a **transaction-scoped advisory lock**. State revision checks, reads, writes and password/Google account updates share one checked-out PostgreSQL client until commit/rollback, including nested operations. This avoids session-lock assumptions that are invalid with transaction pooling. Read-only state snapshots use repeatable-read transactions. Queries do not use named prepared statements. The client pool is capped at three connections per warm function instance.

Payroll tables live in the private **`jc_aps` schema**, with PUBLIC schema access revoked. Keep it outside Supabase's exposed Data API schemas. The API's database credential stays server-side; payroll and authentication tables must never be exposed to anonymous browser clients. Use a dedicated, least-privilege runtime database role before extending the demo to broader institutional use.

### Cost, scaling and limitations

Vercel Hobby and Supabase Free are the intended starting plans for this small non-commercial class demo, subject to current eligibility, usage quotas and availability. No paid upgrade is required by this source configuration. Review the actual dashboards before enabling paid resources; configure billing alerts/spending controls if a paid plan is approved. Remove assignment resources after grading when no longer needed.

Vercel can scale function execution without a maintained VM, but database connections, storage, compute, function duration and request payload limits remain constraints. Each additional function instance adds its own small pool. Free database projects can become unavailable or paused under their current inactivity/resource policies; verify the project before grading.

The app reads broad state snapshots, serializes writes and stores profile photos in SQL. These choices are reasonable for a class demo but constrain throughput. Growth would require paginated endpoints, narrower transactions, object storage and measured capacity planning. Vercel's inbound payload limit takes precedence over Express's 10 MB JSON limit. Local serverless files are not durable storage, and long-running work needs a separate worker. Internet/cloud outages affect availability. A successful demo does not establish that the deployment meets institutional payroll operation requirements.

## 2. Alternatives and trade-offs

| Alternative | Why it was not selected |
| --- | --- |
| Netlify PaaS | Viable, but adapting the existing Express/Vercel routing would add work without a demonstrated benefit for this project. |
| Cloudflare Pages/Workers | Useful for static and edge workloads. The application expects conventional Node modules and SQL transactions; adapting to Workers/database connectivity adds compatibility work without a measured edge requirement. |
| Docker + AWS ECS + managed PostgreSQL | Suitable for persistent services, background workers or custom system dependencies. This single Node application has no such requirement; registry, IAM, networking, monitoring and provisioned capacity add operations and cost complexity. |
| Local/on-premise | Can suit private institutional tools. Public class access would require dependable uptime, TLS, networking and maintenance. A developer laptop alone is not a dependable live submission. |
| Vercel + managed MySQL/TiDB | Preserves the original SQL dialect, but the chosen assignment stack is Supabase. PostgreSQL conversion costs extra implementation effort, accepted in exchange for one managed database dashboard and its pooling tools. |

## 3. Automated CI/CD

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It runs on pull requests targeting `main` and pushes/merges to `main`.

1. Check out source and install Node.js 22.
2. Run `npm ci` against the application lockfile.
3. Run JavaScript syntax checks and smoke tests, including real HTTP checks for the serverless entry, frontend assets, health response and protected API routes.
4. Test schema setup/repeated setup, stable row IDs, rollback, foreign keys, unique payroll periods, half-day leave, data persistence, role restrictions, concurrent-save conflicts and Google authentication against a disposable PostgreSQL 16 service. Integration tests create/drop isolated local test databases and refuse remote/cloud test servers.
5. After `checks` succeeds, deploy only on a push to **`jc-rcc/jc-APS:main`**. PRs never deploy production or receive deployment secrets.
6. Install the locked Vercel CLI, pull production configuration, run `vercel build --prod`, then `vercel deploy --prebuilt --prod`. Application deployment is automated; there are no manual file uploads.
7. Record the deployment URL in the Actions summary and check public HTML and `/api/health`. That probe checks application/API availability, not SQL connectivity or role-based workflows. Failure marks the run failed but does not automatically undo a published release.

Production jobs are serialized. Require `checks` through branch protection before merging. Leave automatic Vercel Git deployment disconnected/disabled to prevent bypassing the test gate. Do not add required human approval on the GitHub `production` environment if the course requires fully automatic CD. One-time database provisioning is separate from application release; routine deployment never reseeds payroll data.

## 4. One-time setup

### A. Supabase and demo database

1. Use the new `jc-aps` project. Its region is Tokyo; use only synthetic assignment data.
2. The schema is [`rcc-aps/server/db/sql/postgres.sql`](rcc-aps/server/db/sql/postgres.sql). It can be run in the new project's SQL Editor. Do not import the old MySQL dump. Creating tables alone does not create working demo logins.
3. In Supabase Dashboard → **Connect → Transaction pooler**, obtain the connection URI. Keep the password private and percent-encode special characters when inserting it in a URI. The expected database name is `postgres`, as supplied by Supabase; the application tables are inside schema `jc_aps`.
4. Copy `rcc-aps/.env.example` to local `rcc-aps/.env` in the **independent JC-APS checkout**. Set `DATABASE_URL`, a long random `JWT_SECRET`, `DEMO_SETUP_CONFIRM=jc-aps`, and three different strong values for `DEMO_ADMIN_PASSWORD`, `DEMO_FINANCE_PASSWORD`, `DEMO_EMPLOYEE_PASSWORD` (at least 16 characters). Never commit or share `.env`.
5. If TLS needs a root certificate, download it from Supabase's database settings and set `DATABASE_CA_CERT` to the PEM content. Certificate verification remains enabled; do not bypass it.
6. In `rcc-aps`, run `npm ci`, then `npm run db:bootstrap-demo`. The script loads local `.env`, applies the schema, seeds an empty assignment database, and assigns bcrypt passwords to `admin@rcc.edu.ph`, `finance@rcc.edu.ph`, `employee@rcc.edu.ph`. Give demo credentials privately to the evaluator. Checked-in seed passwords are blank and cannot sign in before provisioning. Re-running bootstrap intentionally resets those demo passwords; it is not a routine deployment step.

### B. New Vercel project

1. Create a separate JC-APS Vercel project; never reuse the original project's deployment settings. Set Root Directory to `rcc-aps`, framework preset Other, and Node.js 22. Keep automatic Git deployment disabled; the Actions workflow performs the release.
2. Add **Production** environment variables: `DATABASE_URL`, `JWT_SECRET`, and `DATABASE_CA_CERT` if required. Do not add the demo setup/password variables to the runtime project. No `DB_HOST`, `DB_NAME`, `TIDB_ENABLE_SSL`, Supabase anon key or service-role API key is needed.
3. Leave `HRIS_API_URL` and `HRIS_API_KEY` unset to use bundled mock HRIS data. Optional Google SSO remains disabled unless a separate OAuth client and authorized origin are configured. The current in-memory nonce store needs shared storage before reliable Google SSO across multiple function instances; password login is the required demo path.
4. In GitHub environment **production**, save `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` from the new Vercel account/project. Store credentials only in the appropriate secrets/settings.
5. Push/merge to `main`; Actions builds and deploys. Make the grading URL accessible without Vercel access protection, while keeping application authentication active. Verify the result before recording its URL below.

## 5. Validation and recovery

- Retain a successful Actions run and Vercel release URL as evidence.
- Open the new URL while signed out; verify HTML, CSS, JavaScript and logos.
- Sign in as demo admin, finance and employee. Verify restricted access, profile changes, a small teaching load/payroll example, exports and persistence after refresh.
- As admin/finance, confirm `/api/db/status` reports PostgreSQL with `connected: true`. Exercise saves and concurrent edits against the real Supabase database. CI's disposable PostgreSQL service does not prove that cloud credentials/TLS/pooling are configured correctly.
- Keep the original project untouched and never substitute its live URL for JC-APS.
- For bad code releases, revert through GitHub and let CI redeploy, or restore a known-good Vercel deployment. Code rollback does not restore schema/data. Keep a separate tested database backup/restore process; for example use PostgreSQL `pg_dump`/`pg_restore` with the session/direct connection and the private `jc_aps` schema, or an available Supabase backup facility. Confirm the account's backup features and retention before relying on them.

## 6. Course submission

| Deliverable | Link/status |
| --- | --- |
| New live application | **Pending Vercel configuration, database provisioning and live functional verification** |
| CI/CD configuration | https://github.com/jc-rcc/jc-APS/blob/main/.github/workflows/deploy.yml |
| Architecture document | https://github.com/jc-rcc/jc-APS/blob/main/DEPLOYMENT.md |
| Successful release evidence | Add the successful Actions run URL after deployment |

## References

- [Vercel: GitHub Actions deployment](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)
- [Vercel: Function limits](https://vercel.com/docs/functions/limitations)
- [Supabase: PostgreSQL connections and poolers](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Serverless database drivers](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers)
- [Supabase: Prepared statements and transaction pooling](https://supabase.com/kb/troubleshooting/disabling-prepared-statements-qL8lEL)
- [node-postgres: SSL](https://node-postgres.com/features/ssl)
