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
cp .env.example .env            # then fill in real secrets
cp apps/web/.env.example apps/web/.env
pnpm install
pnpm docker:up                  # MongoDB (single-node replica set), Redis, Mailpit, MinIO
pnpm db:migrate
pnpm seed                       # creates the default organization, permissions, roles, admin user
pnpm dev:api
pnpm dev:web
pnpm dev:worker
```

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
