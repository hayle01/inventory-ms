const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly correlationId: string;
  readonly fieldErrors: { field: string; message: string }[] | undefined;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    correlationId: string,
    fieldErrors?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.correlationId = correlationId;
    this.fieldErrors = fieldErrors;
  }
}

// The csrf-csrf cookie holds `${token}|${hmacHash}` -- the server only
// accepts the plain `token` half back in the `X-CSRF-Token` header (see
// `validateRequest` in csrf-csrf: it compares the header verbatim against
// the segment before the delimiter). We must NOT read/forward the raw
// cookie value; the token to send is the one returned in each JSON
// response body (`data.csrfToken`), which we keep in memory here.
let csrfToken: string | undefined;
let csrfBootstrapPromise: Promise<void> | undefined;

async function fetchCsrfToken(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/csrf-token`, {
    credentials: 'include',
  });
  const payload = (await response.json().catch(() => undefined)) as
    | { data?: { csrfToken?: string } }
    | undefined;
  csrfToken = payload?.data?.csrfToken;
}

/**
 * The double-submit CSRF token only exists once the client has hit
 * `GET /auth/csrf-token` at least once. Fetch it lazily (and only once,
 * even under concurrent calls) before the first state-changing request.
 */
async function ensureCsrfToken(): Promise<void> {
  if (csrfToken) return;
  csrfBootstrapPromise ??= fetchCsrfToken();
  await csrfBootstrapPromise;
}

function isCsrfError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 403 && error.code === 'FORBIDDEN';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
}

async function performRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  if (method !== 'GET') {
    await ensureCsrfToken();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const init: RequestInit = { method, credentials: 'include', headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);

  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const errorPayload = payload as
      | {
          error?: {
            code?: string;
            message?: string;
            correlationId?: string;
            details?: { fields?: { field: string; message: string }[] };
          };
        }
      | undefined;
    const err = errorPayload?.error;
    throw new ApiError(
      response.status,
      err?.code ?? 'INTERNAL_ERROR',
      err?.message ?? 'An unexpected error occurred.',
      err?.correlationId ?? 'unknown',
      err?.details?.fields,
    );
  }

  // Login, MFA-verify, and password-change rotate the session and hand back
  // a fresh csrfToken in the body (the old one is invalidated server-side).
  // Capture it so the next mutating request (e.g. logout) doesn't 403.
  const data = (payload as { data?: { csrfToken?: string } }).data;
  if (data?.csrfToken) csrfToken = data.csrfToken;

  return (payload as { data: T }).data;
}

/**
 * Thin fetch wrapper for the first-party session-cookie API. Never stores
 * tokens in localStorage/sessionStorage -- the browser session cookie is
 * `HttpOnly` and managed entirely by the server; this client only attaches
 * the CSRF token for state-changing requests.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await performRequest<T>(path, options);
  } catch (error) {
    // A rejected/expired/stale CSRF cookie (e.g. left over from before a
    // scheme change, or past its lifetime) surfaces as a 403 from the
    // double-submit check. Refetch a fresh token once and retry.
    if (!isCsrfError(error) || (options.method ?? 'GET') === 'GET') throw error;
    csrfToken = undefined;
    csrfBootstrapPromise = fetchCsrfToken();
    await csrfBootstrapPromise;
    return performRequest<T>(path, options);
  }
}
