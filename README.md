# JC-APS

Independent academic deployment of the RCC Automated Payroll System: Node.js 22, Express, Supabase PostgreSQL and vanilla JavaScript.

Repository: https://github.com/jc-rcc/jc-APS

**Live application:** https://jc-aps.vercel.app

Read [DEPLOYMENT.md](DEPLOYMENT.md) for architecture, CI/CD, setup, verification and assignment deliverables. The Vercel application and separate Supabase database are running. GitHub Actions CI checks pass; its automated deployment job still needs the Vercel deployment secrets before an end-to-end release can be verified.

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
