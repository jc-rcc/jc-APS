# JC-APS Deployment Strategy: Vercel + Supabase

## Scope and deployment status

JC-APS is an independent academic copy of the RCC Automated Payroll System, deployed only from **https://github.com/jc-rcc/jc-APS**. The original `jc-rcc/rcc-aps` checkout, hosting project and MySQL database are not changed or reused.

The assignment application is live at **https://jc-aps.vercel.app**. Its separate Supabase project **`jc-aps`** is hosted in **Tokyo (`ap-northeast-1`)**. The database schema and three demo accounts are provisioned, and database connections use verified TLS.

**Verified on 27 October 2026:** an application source push automatically triggered both GitHub Actions and the connected Vercel project. All Actions jobs passed, including the production verification job. The live API reported the exact deployed source revision, `cbbfb61700aeeca3419b63248a193fe99a2dd952`.

- [Successful complete workflow run](https://github.com/jc-rcc/jc-APS/actions/runs/40463563344)
- [Vercel deployment record](https://vercel.com/jcs-projects-03dd9d3c/jc-aps/6Mv3tGHVqDeU3jX6BMqJb42xsBbT)
- [Public API health](https://jc-aps.vercel.app/api/health)

Live admin, finance and employee password logins and authenticated data reads have been verified. Employee data is scoped to that employee. PostgreSQL integration tests also cover persistence, transaction rollback, role restrictions and conflicting concurrent saves. These checks do not replace full manual acceptance testing of every payroll scenario. Credentials remain outside the repository and report.

## 1. Architecture and infrastructure choice

The frontend is vanilla HTML/CSS/JavaScript in `rcc-aps/public`. It calls same-origin Express endpoints under `/api/*`. The backend runs on Node.js 22 and is exported as a Vercel handler by `rcc-aps/api/index.js`. The current catch-all Vercel routing sends both API and static file requests through Express; it does not separately publish static files to a CDN-only route.

**Vercel hosts the application and Express API.** The existing handler makes this a small hosting change. Managed HTTPS, deployment versions and environment configuration reduce server administration for the class demonstration.

**Supabase hosts a separate PostgreSQL database.** The application uses the `pg` driver and Supabase's **Transaction pooler** connection from Dashboard → Connect. Supabase is used as a SQL database; existing Express JWT authentication, bcrypt passwords and role checks are retained. Supabase Auth, public API keys and a browser-side database client are not required.

```text
Browser -- HTTPS --> Vercel Express API -- verified TLS --> Supabase pooler
                                                       --> PostgreSQL jc_aps schema
GitHub main --> Actions checks with disposable PostgreSQL --> verify live revision
           --> Vercel install --> syntax/smoke tests --> build --> deploy
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

## 3. Automated CI and CD

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Application/configuration changes pushed or merged to `main` trigger Actions and Vercel's connected Git integration. Pull requests run Actions checks. Documentation-only updates outside the app do not require a new application deployment.

### GitHub Actions checks

1. Check out source and install Node.js 22.
2. Install locked application dependencies with `npm ci`.
3. Run `npm run lint` and `npm test`: JavaScript syntax checks and 15 smoke-test files, including HTTP checks of the serverless handler and protected routes.
4. Run state/persistence and Google authentication integration tests against a disposable PostgreSQL 16 service. Tests cover repeated setup, stable row IDs, rollback, foreign keys, unique periods, half-day leave, role restrictions and concurrent saves. Test databases are isolated, and remote/cloud database servers are refused by the test fixture.

### Vercel automatic build and release

The existing Vercel Git integration starts a deployment from the same source push. Its Node builder installs dependencies and runs the application's `vercel-build` script, defined in [`rcc-aps/package.json`](rcc-aps/package.json): **`npm run lint && npm test`**. If either command fails, the build fails before publication. The builder then packages the Express function and publishes the new production deployment.

Vercel and Actions start independently from the same push. Vercel's own syntax/smoke checks are the publication gate; Vercel does not wait automatically for the external Actions PostgreSQL integration job. Requiring Actions checks before merging is the recommended repository protection for that additional gate.

### Verify the actual production release

After the Actions `checks` job passes, the `deploy` job reads the commit's **Vercel** status through the automatically supplied GitHub token. It waits for success, requests the public HTML page and `/api/health`, and verifies that the live `revision` matches `GITHUB_SHA`. The Actions summary records the application URL, source revision and Vercel deployment record.

This setup uses native Git-based continuous deployment. **No Vercel token, Vercel organization/project secrets, manual application upload or manual redeploy is required for normal releases.** Supabase credentials remain only in the configured Vercel runtime settings and the private local setup file. Routine deployments never seed or reset the database.

The end-to-end source-push test passed in [run 40463563344](https://github.com/jc-rcc/jc-APS/actions/runs/40463563344). The previous token-based CLI job has been replaced; its older failed runs remain historical records.

## 4. One-time setup

### A. Supabase and demo database

1. Use the new `jc-aps` project. Its region is Tokyo; use only synthetic assignment data.
2. The schema is [`rcc-aps/server/db/sql/postgres.sql`](rcc-aps/server/db/sql/postgres.sql). It can be run in the new project's SQL Editor. Do not import the old MySQL dump. Creating tables alone does not create working demo logins.
3. In Supabase Dashboard → **Connect → Transaction pooler**, obtain the connection URI. Keep the password private and percent-encode special characters when inserting it in a URI. The expected database name is `postgres`, as supplied by Supabase; the application tables are inside schema `jc_aps`.
4. Copy `rcc-aps/.env.example` to local `rcc-aps/.env` in the **independent JC-APS checkout**. Set `DATABASE_URL`, a long random `JWT_SECRET`, `DEMO_SETUP_CONFIRM=jc-aps`, and three different strong values for `DEMO_ADMIN_PASSWORD`, `DEMO_FINANCE_PASSWORD`, `DEMO_EMPLOYEE_PASSWORD` (at least 16 characters). Never commit or share `.env`.
5. If TLS needs a root certificate, download it from Supabase's database settings and set `DATABASE_CA_CERT` to the PEM content. Certificate verification remains enabled; do not bypass it.
6. In `rcc-aps`, run `npm ci`, then `npm run db:bootstrap-demo`. The script loads local `.env`, applies the schema, seeds an empty assignment database, and assigns bcrypt passwords to `admin@rcc.edu.ph`, `finance@rcc.edu.ph`, `employee@rcc.edu.ph`. Give demo credentials privately to the evaluator. Checked-in seed passwords are blank and cannot sign in before provisioning. Re-running bootstrap intentionally resets those demo passwords; it is not a routine deployment step.

### B. Vercel Git integration

1. Use the separate `jc-aps` Vercel project connected to **`jc-rcc/jc-APS`**, with production branch `main`, Root Directory `rcc-aps`, framework Other and Node.js 22. Keep automatic Git deployments enabled.
2. Add Production variables `DATABASE_URL`, `JWT_SECRET` and `DATABASE_CA_CERT` as required by the verified database TLS connection. Copy values without surrounding quotation marks. Do not add demo setup/password variables to runtime settings. Supabase API keys are not required by this direct SQL architecture.
3. The Node builder runs `vercel-build` automatically. Test sources remain available during the build, while only required runtime files are traced into the Express function. Private `.env` files are excluded from version control and deployment uploads.
4. Leave HRIS integration variables unset for mock data. Optional Google SSO remains disabled unless separately configured. Its current in-memory nonce store needs shared storage before reliable multi-instance Google SSO; password login is the verified demonstration path.
5. Push or merge an app change to `main`. Watch Actions and the Vercel check complete automatically. The production verification job confirms both HTTP availability and the exact deployed revision.

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
| New live application | https://jc-aps.vercel.app |
| CI/CD configuration | https://github.com/jc-rcc/jc-APS/blob/main/.github/workflows/deploy.yml |
| Architecture document | https://github.com/jc-rcc/jc-APS/blob/main/DEPLOYMENT.md |
| Successful CI and automated release evidence | https://github.com/jc-rcc/jc-APS/actions/runs/40463563344 |
| Public API health and source revision | https://jc-aps.vercel.app/api/health |

## References

- [Vercel: Git deployments](https://vercel.com/docs/git)
- [Vercel: Builds](https://vercel.com/docs/builds)
- [Vercel: Function limits](https://vercel.com/docs/functions/limitations)
- [Supabase: PostgreSQL connections and poolers](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Serverless database drivers](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers)
- [Supabase: Prepared statements and transaction pooling](https://supabase.com/kb/troubleshooting/disabling-prepared-statements-qL8lEL)
- [node-postgres: SSL](https://node-postgres.com/features/ssl)
