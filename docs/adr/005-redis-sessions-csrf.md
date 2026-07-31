# ADR-005: Redis-backed browser sessions and CSRF protection

## Status

Accepted

## Context

The first-party React app must authenticate without storing long-lived tokens in browser
storage, where they are vulnerable to XSS exfiltration.

## Decision

The browser only ever receives an opaque session ID in a `Secure`, `HttpOnly`,
`SameSite=Lax` cookie. Session state (user ID, MFA level, expiry) lives server-side in Redis.
Sessions rotate on login, MFA completion, password change, and privilege change, and support
current-session logout, logout-all, and per-session revocation. State-changing requests require
a CSRF token plus Origin/Referer validation; CORS uses an explicit allow-list and is never
combined with a wildcard origin and credentials.

## Consequences

- No JWT or refresh token is ever written to `localStorage`/`sessionStorage`.
- External API integrations (when introduced) use separate scoped API clients or short-lived
  JWTs -- never the browser session.
- Losing Redis availability degrades authentication; readiness checks
  (`GET /api/v1/operations/health/ready`) report Redis health explicitly.
