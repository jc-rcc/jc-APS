# JC APS Deployment Presentation Script

Subject for email: Final Assignment Web Project Deployment Strategy JC APS [Name and Section]

Student or group members: [Insert names]

Course and section: [Insert course and section]

## Introduction

Good day, Sir or Ma'am. Our project is JC-APS, an Automated Payroll System deployed using Vercel and Supabase PostgreSQL. This presentation explains our platform choices, cost and scaling considerations, limitations, alternative platforms, and automated deployment process.

Ang goal po namin ay mailipat ang application mula sa local computer papunta sa accessible online environment. Ipapakita namin ang actual repository, configuration files, successful workflow run, at live application bilang evidence ng deployment.

## Step 1 Analyze the application architecture

Our frontend uses HTML, CSS, and JavaScript. The backend uses Node.js 22 and Express. PostgreSQL stores users, payroll records, teaching loads, attendance, and related information.

Kailangan ng application ang backend authentication, role-based permissions, at persistent relational data. The browser communicates with the Express API, and the API checks access before reading or writing database records.

The original application used MySQL. For this independent deployment project, the database layer was migrated to PostgreSQL, including the schema, parameter syntax, transactions, and locking behavior. The original system repository and its database were kept separate.

Architecture document: https://github.com/jc-rcc/jc-APS/blob/main/DEPLOYMENT.md

Project repository: https://github.com/jc-rcc/jc-APS

## Step 2 Choose the application and database platforms

We chose Vercel to host the Express API and frontend. The project already had a Vercel-compatible serverless entry point, which reduced hosting changes. Managed HTTPS and deployment versions also reduce the need to maintain an application server ourselves.

We chose Supabase for its managed PostgreSQL database. Payroll data is relational, so tables, foreign keys, unique constraints, and transactions are useful for maintaining consistent records. The project is hosted in Tokyo, and the backend connects using verified TLS through the transaction pooler.

Sa setup namin, Vercel ang nagpapatakbo ng application at Supabase ang nagtatago ng persistent data. Existing Express JWT authentication and bcrypt password hashing are retained. We do not send database credentials to the browser or require Supabase Auth for the current demo.

Database schema: https://github.com/jc-rcc/jc-APS/blob/main/rcc-aps/server/db/sql/postgres.sql

## Step 3 Justify the cost and scaling decisions

Our starting plans are Vercel Hobby and Supabase Free for the small non-commercial academic demonstration, subject to their current eligibility and resource allowances. This reduces initial infrastructure cost and avoids operating a dedicated virtual machine for intermittent demonstration traffic.

Hindi po namin ina-assume na unlimited o free ang system sa lahat ng usage levels. More traffic, storage, or compute may require paid capacity. An institutional deployment would need a separate budget, backup plan, monitoring, and capacity assessment. If paid resources are enabled, billing alerts and spending controls should be configured.

Vercel manages request execution without a manually maintained VM. However, database capacity remains a limit. Each warm function instance uses a small pool of at most three connections, and the backend uses Supabase's transaction pooler. More function instances can still increase the total database connections.

For heavier usage, we would add paginated reads, smaller transactions, external photo storage, and workload testing. Sa current demo, transaction locks and state revision checks protect against conflicting saves; they also limit write throughput because writes are serialized.

Platform justification: https://github.com/jc-rcc/jc-APS/blob/main/DEPLOYMENT.md

## Step 4 Explain the limitations

Vercel functions have execution-time and request-payload limits. Long-running processing and large uploads may require workers or external storage. Local files in a function cannot be used as durable application storage.

Supabase resources depend on the selected plan. Free projects may pause after low activity, and storage, compute, and connection limits must be monitored. We need to check project availability before grading. Both platforms also depend on internet and cloud-service availability.

May limitations din ang application design: broad state reads, serialized writes, and profile photos stored in SQL can become bottlenecks. The current deployment is a working academic demonstration; institutional payroll operation requires further acceptance testing and operational controls.

Sensitive values are stored in environment settings. Payroll tables are inside the private jc_aps schema, and authentication and role checks are enforced by the Express API. Passwords and connection credentials are not included in this presentation or the public repository.

Safe configuration example: https://github.com/jc-rcc/jc-APS/blob/main/rcc-aps/.env.example

## Step 5 Compare the other platforms

Netlify was a viable PaaS alternative. We did not select it because the application already had a Vercel handler; adapting the routing and function configuration would add work without a demonstrated advantage for this project.

Cloudflare Pages and Workers are useful for static and edge workloads. Our backend expects conventional Node dependencies and SQL transactions. Adapting its execution and database connectivity would add compatibility work without a measured need for edge execution.

Docker with AWS ECS offers more runtime control and suits persistent services, custom system dependencies, or background workers. Our current project has one Node service and no required long-running worker. Managing images, a registry, IAM, networking, and monitoring would increase operational effort and cost complexity.

Local or on-premise hosting can be appropriate for private institutional tools. For this class demonstration, it would require dependable public networking, HTTPS, and uptime. Hosting only on a developer laptop would make availability depend on that laptop staying online.

Hindi po ibig sabihin na hindi kayang gamitin ang alternatives. We selected the combination whose implementation effort and operations fit the current project scope.

Comparison and trade-offs: https://github.com/jc-rcc/jc-APS/blob/main/DEPLOYMENT.md

## Step 6 Explain the actual automated CI and CD process

We use GitHub Actions together with Vercel's native Git integration. An application change pushed or merged to main automatically starts both systems. Normal releases do not require uploading application files or clicking Redeploy.

In GitHub Actions, the checks job retrieves the source, installs Node.js 22, and installs locked dependencies using npm ci. It then runs JavaScript syntax checks and 15 smoke-test files.

A disposable PostgreSQL 16 service runs the database integration tests. These cover schema setup, repeated setup, stable row IDs, persistence, rollback, role restrictions, authentication, and concurrent-save conflicts. The tests use isolated local test databases rather than the production Supabase database.

At the same time, Vercel receives the Git push and installs the application's dependencies. Before packaging and publishing the function, its Node builder runs the vercel-build script: npm run lint followed by npm test. A failure in either check fails that Vercel build.

Magkahiwalay na nagsisimula ang Actions at Vercel mula sa parehong push. Vercel's own syntax and smoke checks run before publication. The additional PostgreSQL integration tests run in Actions; requiring those checks before merging is the recommended repository protection.

After the Actions checks job passes, the final job waits for the Vercel status of that exact commit. It checks the production HTML page and API health, then compares the deployed revision with the workflow's commit SHA. This confirms that the new source version reached the live application.

GitHub workflow: https://github.com/jc-rcc/jc-APS/blob/main/.github/workflows/deploy.yml

Vercel build checks: https://github.com/jc-rcc/jc-APS/blob/main/rcc-aps/package.json

Vercel routing configuration: https://github.com/jc-rcc/jc-APS/blob/main/rcc-aps/vercel.json

## Step 7 Show the successful deployment evidence

On 27 October 2026, the source push for commit cbbfb61700aeeca3419b63248a193fe99a2dd952 triggered the automated process. All GitHub Actions jobs passed, and the Vercel status confirmed a completed deployment. The live health endpoint reported the same revision.

Ito po ang actual evidence ng automated deployment. In the workflow run, we can expand the dependency installation, syntax, smoke, PostgreSQL integration, and production verification steps. The final verification confirms the exact deployed revision and public API availability.

Successful complete workflow run: https://github.com/jc-rcc/jc-APS/actions/runs/40463563344

Vercel deployment record: https://vercel.com/jcs-projects-03dd9d3c/jc-aps/6Mv3tGHVqDeU3jX6BMqJb42xsBbT

Public API health: https://jc-aps.vercel.app/api/health

Admin, finance, and employee production logins and authenticated data reads have also been verified. Employee data access is scoped to the employee. During the live demonstration, we will show the login and selected system functions using demo records, while keeping credentials private.

## Step 8 Submit the required deliverables

The first deliverable is the live application URL, where the deployed system can be accessed.

Live application: https://jc-aps.vercel.app

The second deliverable is the repository link pointing directly to the CI/CD configuration, so the instructor can inspect the workflow rather than only the repository home page.

CI and CD configuration: https://github.com/jc-rcc/jc-APS/blob/main/.github/workflows/deploy.yml

The third deliverable is DEPLOYMENT.md, which explains our platform decisions, cost and scaling considerations, limitations, rejected alternatives, and pipeline steps.

Architecture document: https://github.com/jc-rcc/jc-APS/blob/main/DEPLOYMENT.md

We also provide the successful workflow run as supporting evidence: https://github.com/jc-rcc/jc-APS/actions/runs/40463563344

Thank you, Sir or Ma'am. We are ready to demonstrate the deployed application and explain the configuration and deployment records.
