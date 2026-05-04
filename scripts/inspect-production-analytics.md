# Production Inspection Script

This script turns the GenericAgent runtime and analytics checks into one reusable read-only command.

Current script path: `scripts/inspect-production-analytics.mjs`

## What it checks

- SSH into the GenericAgent production host with a private key or password when using the default remote mode
- Detect the active `EnvironmentFile` from the `systemd` service in remote mode
- Check the `systemd` service state and public site health in remote mode
- Query PostgreSQL analytics data from the GenericAgent runtime database
- Summarize referrers, landing paths, page routes, CTA clicks, funnel movement, checkout failures, and deduplicated payments
- Summarize Nginx page/API/static/console proxy traffic from access logs in remote mode

## Commands

Run the default GenericAgent Neon text report:

```bash
npm run prod:inspect
```

The default analytics target is `neon-cordovan-zebra` (`neondb_owner@ep-bitter-brook-am2gjcic-pooler.c-5.us-east-1.aws.neon.tech:5432/neondb`). The password is intentionally not stored in this repository; provide it with `GENERICAGENT_ANALYTICS_DB_PASSWORD`, `PGPASSWORD`, `DATABASE_URL`, or `POSTGRES_URL`.

Query a local or Neon PostgreSQL source explicitly:

```bash
npm run prod:inspect -- --local-db --skip-health
```

Write a JSON report:

```bash
npm run prod:inspect -- --local-db --skip-health --format json --output ../推广/exports/genericagent-production-analytics-report.json
```

Inspect a different service or SSH key:

```bash
npm run prod:inspect:remote -- --service multica.service --ssh-key-path ~/.ssh/multicaLaunch_prod_205_key
```

Skip health checks and query only analytics:

```bash
npm run prod:inspect -- --skip-health
```

## Data Source

- The script loads `.env.production` by default.
- `npm run prod:inspect` defaults to the GenericAgent Neon analytics database.
- `--local-db` skips SSH and uses the current process environment plus loaded env files, falling back to the non-secret `neon-cordovan-zebra` host/user/database defaults.
- SSH settings come from CLI flags first, then `DEPLOY_*`, `MULTICA_DEPLOY_*`, and `MULTICA_SERVER_*` variables.
- The remote env file defaults to `/data/multica/multica.env`, or the active `EnvironmentFile` detected from `multica.service`.
- PostgreSQL uses the same GenericAgent-style source order as the app: `MULTICA_POSTGRES_URL`, `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, then discrete `MULTICA_POSTGRES_*` / `PG*` / `POSTGRES_*` variables.
- The report is read-only. It does not modify the remote host or database.
