# JC-APS Deployment Strategy

## Scope and status

JC-APS is an independent academic deployment of the RCC payroll application. Its only deployment repository is **https://github.com/jc-rcc/jc-APS**. The original `jc-rcc/rcc-aps` repository, hosting project and database are outside this assignment's scope.

**Status: source and pipeline prepared; new hosting/database provisioning and live verification pending.** An older project's URL is not evidence of this deployment.

## Chosen infrastructure and architecture

The frontend is vanilla HTML/CSS/JavaScript under `rcc-aps/public`, calling same-origin `/api/*` endpoints. The backend is Express on Node.js 22, exported by `rcc-aps/api/index.js`. It uses JWT/bcrypt authentication, optional school-domain Google sign-in, and `mysql2/promise` for persistent SQL state.

**Application: a new Vercel project.** This reuses the existing Node serverless adapter and provides HTTPS, environment configuration and automated deployment. With the current `vercel.json`, all requests, including static files, pass through Express. This version does not claim separate CDN-only routing for static files.

**Database: a separate TiDB Cloud Starter instance in MySQL-compatible mode, using database `jc_aps_demo`.** Set `TIDB_ENABLE_SSL=true`. Do not reuse the original project's database credentials. MySQL compatibility must be checked against the actual cloud tier: schema migrations, transactions, and advisory locks (`GET_LOCK`/`RELEASE_LOCK`) are release acceptance criteria. If the chosen tier cannot support them, use managed MySQL 8 rather than disabling concurrency protection.

```text
Browser --HTTPS--> Vercel / Express --TLS--> assignment SQL database
GitHub main --> install + syntax + smoke + MySQL tests --> build --> deploy
```

### Cost, scaling and limitations

This is a small, non-commercial class demonstration with intermittent traffic. Vercel Hobby and TiDB Starter allowances are the target cost strategy, subject to current eligibility and quotas; free operation is not guaranteed for every usage level. Check current plan dashboards before provisioning. Do not automatically upgrade to paid plans. If paid usage is approved, enable spending limits/billing alerts and remove assignment resources after grading when no longer needed.

Vercel scales request execution without maintaining a VM. The database pool permits five connections per warm function instance, so multiple instances increase aggregate connections. The database has separate capacity and request limits. Broad state reads, serialized writes and database-stored profile photos limit throughput. Higher load would require pagination, narrower transactions, external object storage and measured capacity planning.

Functions have finite duration and payload limits. Consult current plan limits rather than an old fixed timeout. The application's 10 MB JSON limit does not override a smaller hosting limit. Local serverless files are not durable storage. A stable `JWT_SECRET` is mandatory; long-running jobs need another execution model. Cloud/internet outages and quota exhaustion affect availability. This academic demo does not establish suitability for institutional production payroll.

## Alternatives evaluated

| Alternative | Reason not selected for this demo |
| --- | --- |
| Netlify | A viable PaaS, but requires adapting the existing Express function/routing to its runtime. Vercel already has an adapter in this project. |
| Cloudflare Pages/Workers | Attractive for static/edge work. Conventional Node dependencies, TCP MySQL and SQL behavior require compatibility work. The app has no measured need for edge execution. |
| Docker + AWS ECS + managed MySQL | Useful for persistent processes, custom system dependencies or workers. This single Node application needs none of those yet; image registry, IAM, networking, monitoring and provisioned capacity add cost and operational effort. |
| Local/on-premise | Appropriate for some private institutional tools, but public class access requires managed HTTPS, networking, uptime and maintenance. A developer laptop alone is not a dependable live submission. |

## CI/CD pipeline

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It runs on pull requests to `main` and pushes to `main`, including merges.

1. Check out code and install Node.js 22.
2. Install locked application dependencies with `npm ci`.
3. Run `npm run lint` (JavaScript syntax checks) and `npm test` (existing smoke tests and HTTP checks of the serverless handler, UI assets, API health and protected routes).
4. Run schema/data-persistence and Google authentication integration tests against a disposable MySQL 8 service. Tests create/drop isolated databases; cloud credentials never enter this checks job.
5. Start deployment only after `checks` succeeds, only for pushes to `jc-rcc/jc-APS:main`. PRs never receive deployment secrets or deploy production.
6. Install the Vercel CLI from `deployment/package-lock.json`, pull production project configuration, build using `vercel build --prod`, and publish the artifact with `vercel deploy --prebuilt --prod`. No manual application uploads are used.
7. Put the deployment URL in the Actions summary and verify public HTML plus `/api/health`. Failure marks the run failed, but does not automatically roll back a release already published. The health probe does not validate SQL connectivity or successful login.

Production jobs are serialized. Configure branch protection to require `checks` and block force pushes. Avoid required human approval on the GitHub `production` environment if fully automatic deployment is required. Disable separate Vercel automatic Git deployments so they cannot bypass the CI gate.

## One-time setup

1. Publish this independent source to `jc-rcc/jc-APS`. Never push from or repoint the original checkout.
2. Create the new database and a new Vercel project (for example `jc-aps`). Set Vercel Root Directory to `rcc-aps`, framework preset Other, and Node.js 22. Use the existing `vercel.json`. Leave automatic Git deployments disconnected/disabled; GitHub Actions owns application deployment.
3. Set these Vercel **Production** variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=jc_aps_demo`, `TIDB_ENABLE_SSL=true`, and a long random `JWT_SECRET`. Keep values out of source and chat. Leave `HRIS_API_URL`/`HRIS_API_KEY` unset for mock HRIS data. Leave `GOOGLE_CLIENT_ID` unset unless a separate OAuth client and authorized origin have been configured for the assignment.
4. Initialize the new database from a trusted environment before public deployment: set those database/auth variables and separate `DEMO_ADMIN_PASSWORD`, `DEMO_FINANCE_PASSWORD`, `DEMO_EMPLOYEE_PASSWORD` values, each at least 16 characters. In `rcc-aps`, run `npm ci` then `npm run db:bootstrap-demo`. This applies schema/upgrades and sets bcrypt passwords. This is database provisioning, not manual application deployment. Never run against the institution's database. Routine deployment does not run schema/seed scripts.
5. The copied seed uses demo names, no profile/payroll/attendance data, and blank passwords that cannot log in until bootstrap assigns them. No original SQL dump is included. Supply the demo admin, finance and employee credentials privately to the evaluator; review mock records before demonstration.
6. Create GitHub environment `production`. Add its secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` from the new Vercel project/account. Database passwords remain in Vercel and the trusted bootstrap environment. Do not commit tokens or `.vercel` metadata.
7. Push/merge to `main`; CI performs application build and deployment. Ensure the grading URL is publicly reachable without Vercel access protection, while application authentication protects payroll endpoints.

## Verification and rollback

- Retain the successful Actions run URL and verify the Vercel production build completed.
- Open the new URL while signed out; verify page, CSS, JavaScript and logos.
- Log in with each demo role. Check access restrictions, profile changes, teaching load, a small payroll calculation, report export and persistence after refresh.
- As admin/finance, verify `/api/db/status` reports `connected: true`. Check writes and concurrent updates against the actual cloud database. The disposable CI MySQL tests do not prove TiDB behavior.
- Verify that original infrastructure remains untouched and no old deployment URL is submitted.
- For a bad release, revert through GitHub and let CI redeploy; Vercel's previous known-good deployment is an immediate recovery option. Database schema/data need a separate backup and restore plan; code rollback does not restore them.

## Course submission

| Deliverable | Link/status |
| --- | --- |
| New live application | **Pending provisioning, deployment and functional verification** |
| CI/CD configuration | https://github.com/jc-rcc/jc-APS/blob/main/.github/workflows/deploy.yml |
| Architecture document | https://github.com/jc-rcc/jc-APS/blob/main/DEPLOYMENT.md |
| Successful workflow evidence | Add Actions run URL after successful deployment |

## References

- [Vercel: GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)
- [Vercel: Function limits](https://vercel.com/docs/functions/limitations)
- [Vercel: Hobby plan](https://vercel.com/docs/plans/hobby)
- [TiDB Cloud: Starter limitations](https://docs.pingcap.com/tidbcloud/serverless-limitations/)
- [TiDB: MySQL compatibility](https://docs.pingcap.com/tidb/stable/mysql-compatibility/)
