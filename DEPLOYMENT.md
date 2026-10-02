# Free Hosting: Vercel + Neon

The prepared deployment uses Vercel Hobby for Next.js and Neon Free for PostgreSQL.
Vercel supplies an HTTPS address such as `almaza-deck-system.vercel.app`, subject to availability.
This is a free subdomain, not ownership of a `.com` domain. Vercel Hobby is for personal,
non-commercial use. Both providers have usage limits; keep the free plans selected.

## 1. Create the accounts and repository

Create or sign in to [GitHub](https://github.com), [Vercel](https://vercel.com), and
[Neon](https://neon.com). A private repository under your personal GitHub account is suitable.
Use `main` as its default branch and put the app at the repository root.

This workspace also contains unrelated synced project references. The `.gitignore` excludes
`sources/`, `.env`, SQLite databases, screenshots, generated clients, and private exports.
Do not upload the entire folder through a web uploader: upload only the app sources,
`prisma/` (without databases), the two seed JSON files in `data/`, `public/`, `scripts/`,
`.github/`, configuration files, the lockfile, and documentation. Normal Git respects the ignore file.

No repository has been created, committed, or pushed by this preparation.

## 2. Create a Neon Free project

Choose a region near your Vercel project. In Neon's connection dialog get:

- The pooled connection string for `DATABASE_URL` (hostname contains `-pooler`).
- The direct/unpooled string for `DIRECT_URL` (used for migrations).

Keep `sslmode=require`. A small Prisma `connection_limit=5` on the pooled URL is suitable
for starting out. Do not paste these credentials into the repository or chat.

## 3. Link the Vercel project

From the app directory run `pnpm dlx vercel link`. Sign in and create/link a project
named `almaza-deck-system` (or another available name). Choose Next.js and Node.js 22.
Do not deploy yet; the workflow will initialize the database first.

Open the project's **Settings > Environment Variables**, choose **Production**, and add:

| Variable | Value |
| --- | --- |
| `STORAGE_BACKEND` | `postgres` |
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `SESSION_SECRET` | A newly generated random secret, at least 32 characters |

Generate the session secret locally with:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The generated `.vercel/project.json` contains your `projectId` and `orgId`.
It is intentionally ignored by Git. `vercel.json` disables Vercel's parallel Git-triggered
deployments so GitHub Actions is the single production deployment path.

## 4. Configure GitHub Actions

In the repository open **Settings > Secrets and variables > Actions**.
Add these repository **secrets**:

| Secret | Where it comes from |
| --- | --- |
| `VERCEL_TOKEN` | Create a token in Vercel Account Settings > Tokens |
| `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |
| `DATABASE_URL` | Same pooled URL used in Vercel |
| `DIRECT_URL` | Same direct URL used in Vercel |
| `ADMIN_PASSWORD` | A new strong password of at least 12 characters |

The cloud admin username is `admin`. The local demo password is not used for cloud setup.
Seeding creates the account once; later deployments preserve its password. Changing the
GitHub secret alone does not rotate an existing admin password.

Add a repository **variable** `DEPLOY_ENABLED` with value `true` after the secrets are set.
Without this variable the check job runs but deployment is skipped. This lets you upload
the repository before creating the hosting accounts.

Push to `main`, or open **Actions > Check and deploy Almaza > Run workflow**, selecting `main`.
The workflow:

1. Creates a disposable PostgreSQL database, applies migrations, seeds twice, tests cloud persistence, and builds.
2. Builds the production deployment with Vercel's production environment.
3. Applies committed Neon migrations and inserts missing default content.
4. Publishes the prebuilt app and reports the production URL in the deployment output.

Pull requests only run checks, without production credentials. Production deployments
are serialized and are not canceled midway through a database migration.

## 5. Optionally transfer existing local players

The seed JSON files bring your existing saved sets and card customizations into the new
database. Existing local player accounts and decks require a separate private export.
Do this before people start registering on the hosted site.

With the local SQLite `.env` still active:

```sh
pnpm export:local
```

This writes a private file in `exports/`. It includes normal users' password hashes,
their decks, content, and cached translations. It excludes the local admin account.
Do not commit or publicly upload it.

Then supply the cloud environment variables in your terminal, without overwriting the
local `.env`, and run:

```sh
pnpm cloud:migrate
pnpm cloud:seed
pnpm cloud:import exports/almaza-TIMESTAMP.json
```

Use the actual exported filename. Import runs in one transaction, preserves the cloud
admin, and refuses a database that already contains player accounts or deck entries.
Existing cloud content is not overwritten. Your local database is not modified.

## Future updates and data

Push application changes to `main`; the workflow checks and deploys them. Users, decks,
sets, card overrides, and translations are stored in Neon and survive redeployments.
Runtime card edits are not overwritten by checked-in seed content.

For schema changes, keep the common User/DeckCard models in both Prisma schemas aligned.
Create and review a PostgreSQL migration on a development database and commit it under
`prisma/cloud/migrations/`. Production runs `migrate deploy`, never a reset or destructive
`db push`. Use additive migrations that remain compatible with the previous deployed app.
Code rollback does not roll back the database. Keep database backups before changing schemas.

Local development continues to use SQLite and the existing JSON files unless
`STORAGE_BACKEND=postgres` is explicitly set. Do not run the local `setup` script with
cloud database settings; use `cloud:migrate` and `cloud:seed` instead.

The automatic Arabic translation endpoint is unofficial and can fail or throttle;
already cached translations and admin corrections remain available from Neon.

## Sources and free-plan details

- [Vercel Hobby eligibility and limits](https://vercel.com/docs/plans/hobby)
- [Vercel free deployment subdomains](https://vercel.com/docs/domains/working-with-domains)
- [Neon Free quotas](https://github.com/neondatabase/website/blob/main/content/faqs/free-plan-limits-and-quotas.md)
- [Vercel's GitHub Actions deployment flow](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)
- [GitHub Actions included usage](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

Free tiers and quotas can change; verify them in the dashboards before enabling a paid plan.
