# JC-APS

Independent academic deployment of the RCC Automated Payroll System: Node.js 22, Express, Supabase PostgreSQL and vanilla JavaScript.

Repository: https://github.com/jc-rcc/jc-APS

Read [DEPLOYMENT.md](DEPLOYMENT.md) for architecture, CI/CD, setup, verification and assignment deliverables. Live deployment is pending setup. Use a separate hosting project, database and credentials.

Application source is in `rcc-aps/`. With Node.js 22 installed:

```sh
cd rcc-aps
npm ci
npm run lint
npm test
```

For local startup, copy `rcc-aps/.env.example` to `rcc-aps/.env` and configure only the new assignment database. Provision demo accounts with `npm run db:bootstrap-demo`, then run `npm start`. Never commit `.env`.

The PostgreSQL schema is [rcc-aps/server/db/sql/postgres.sql](rcc-aps/server/db/sql/postgres.sql). The old MySQL dump cannot be imported into Supabase.

The original institutional repository and infrastructure are outside this assignment's scope.
