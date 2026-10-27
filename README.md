# JC-APS

Independent academic deployment of the RCC Automated Payroll System: Node.js, Express, MySQL-compatible SQL and vanilla JavaScript.

Repository: https://github.com/jc-rcc/jc-APS

Read [DEPLOYMENT.md](DEPLOYMENT.md) for architecture, CI/CD, setup, verification and assignment deliverables. Live deployment is pending setup. Use a separate hosting project, database and credentials.

Application source is in `rcc-aps/`. With Node.js 22 installed:

```sh
cd rcc-aps
npm ci
npm run lint
npm test
```

The original institutional repository and infrastructure are outside this assignment's scope.
