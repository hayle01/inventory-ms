# Inventory Management System

Secure MERN inventory management system. See [`SYSTEM_DOCUMENTATION.md`](./SYSTEM_DOCUMENTATION.md)
for the full product/engineering contract and [`CLAUDE.md`](./CLAUDE.md) for the coding-agent
contract governing how this repository is built.

## Stack

- MongoDB replica set (transactions required), Mongoose
- Node.js 22 LTS, Express, TypeScript strict mode
- React 19, Vite, React Router, TanStack Query, React Hook Form
- Redis (sessions, rate limiting, queues, scheduler locks), BullMQ

## Repository layout

```text
apps/web/       React SPA
apps/api/       Express modular monolith
apps/worker/    Queues and scheduled jobs
packages/       Shared contracts, config, ui, eslint-config, tsconfig
infra/          Docker Compose and deployment
docs/           ADRs and runbooks
tests/e2e/      Browser end-to-end tests
```

## Local development

```bash
# Each app loads its own .env from its own directory -- copy and fill in
# real secrets for all three. (.env at the repo root is a reference copy
# only; nothing loads it directly.)
cp .env.example apps/api/.env
cp .env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env

pnpm install                    # also builds packages/config and packages/contracts (postinstall)
pnpm docker:up                  # MongoDB (single-node replica set, port 27018), Redis, MinIO
pnpm db:migrate
pnpm seed                       # creates the default organization, permissions, roles, admin user
pnpm dev                        # runs api + web + worker together
```

New to the team? See [`docs/LOCAL_SERVICES.md`](./docs/LOCAL_SERVICES.md) for how to connect to
the local Mongo/Redis/MinIO containers, and [`docs/MANUAL_TESTING_GUIDE.md`](./docs/MANUAL_TESTING_GUIDE.md)
for a full click-through walkthrough of every module once the app is running.

## Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration   # requires `pnpm docker:up`
pnpm test:security
pnpm test:e2e
pnpm build
pnpm db:migrate
pnpm db:verify-indexes
```

Integration and security tests run against the real MongoDB replica set and Redis started by
`pnpm docker:up` -- never against a standalone MongoDB or an in-memory mock.
