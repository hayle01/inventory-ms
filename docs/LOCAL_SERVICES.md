# Local Docker services — access guide

This project's local Docker Compose stack (`infra/docker/compose/docker-compose.yml`) runs MongoDB, Redis, and MinIO. There is no web-based admin portal bundled for MongoDB or Redis — use a native client (Compass, `redis-cli`, or a GUI) against the exposed ports below. Mailpit has been removed; outbound email goes through real SMTP (see `SYSTEM_DOCUMENTATION.md` Appendix A and the "Local" deployment topology section) and does not have a local viewer.

Start the stack from the repo root:

```bash
docker compose -f infra/docker/compose/docker-compose.yml up -d
```

## MongoDB

- The container listens on **port 27018**, not Mongo's default 27017. If you have any other MongoDB installed natively on Windows (a `mongod` Windows service, common if you've worked on other local Node/Mongo projects), it typically claims 27017 for itself, which silently shadows this project's Docker Mongo on `localhost:27017` depending on which address a client resolves to. Run `Get-NetTCPConnection -LocalPort 27017 -State Listen` in PowerShell if you want to check what's bound to 27017 on your machine.
- No web portal either way. `http://localhost:27018` in a browser will show "It looks like you are trying to access MongoDB over HTTP on the native driver port" — that response is normal and means Mongo is up; connect with a Mongo client instead.
- **MongoDB Compass** (recommended, since it's already installed): connect with

  ```text
  mongodb://localhost:27018/?replicaSet=rs0
  ```

  The container runs a single-node replica set named `rs0` (initialized by the `mongo-rs-init` one-shot service) so that multi-document transactions work; there is no authentication configured locally, so no username/password is needed.
- The database used by the API is `ims` (or whatever `MONGODB_DB_NAME` is set to in `.env`).
- CLI alternative: `docker exec -it inventory-ms-mongo-1 mongosh --port 27018 --eval "rs.status()"`.

## Redis

- No web portal by default either. `http://localhost:6379` will fail in a browser (`ERR_INVALID_HTTP_RESPONSE` — expected, it's not HTTP).
- CLI: `docker exec -it inventory-ms-redis-1 redis-cli` (or `redis-cli -h localhost -p 6379` if you have `redis-cli` installed locally). No password is configured locally.
- If you want a GUI, any general Redis client (e.g. RedisInsight) pointed at `localhost:6379` works; none is bundled in this stack.
- AOF persistence is enabled (`--appendonly yes`), so sessions/queues survive a container restart as long as the `redis-data` volume isn't removed.

## MinIO (object storage)

- Web console: <http://localhost:9001>
- Credentials (local dev only, not for any shared/staging environment):
  - Username: `localminio`
  - Password: `localminiosecret`
- S3 API endpoint used by the app: `http://localhost:9000` (`OBJECT_STORAGE_ENDPOINT`).

## Email (SMTP)

- There is no local mail-catcher container. The worker sends real email via nodemailer using the `MAIL_HOST`/`MAIL_PORT`/`MAIL_SECURE`/`MAIL_USER`/`MAIL_PASSWORD`/`MAIL_FROM` variables in `.env`.
- If `MAIL_HOST` is left blank (the default in `.env.example`), the worker logs a warning and skips sending instead of failing — invite and password-reset emails simply won't go out.
- For local/manual testing without configuring a real SMTP provider, both the create-user and forgot-password API responses include the raw token directly in the JSON body outside production:
  - `POST /api/v1/users` → `inviteToken` on the returned user.
  - `POST /api/v1/auth/forgot-password` → `devResetToken`.
  - Either token can be used at `http://localhost:5173/reset-password?token=<token>` to set a password directly, without needing the email to arrive. The Users UI already surfaces this as a copyable link after creating a user.
