import { doubleCsrf } from 'csrf-csrf';
import { env } from '../../config.js';

/**
 * Double-submit-cookie CSRF protection. The cookie value is
 * `${token}|${hmacHash}` (csrf-csrf's internal format) and is never read by
 * the SPA -- the token the client must echo back in `X-CSRF-Token` is
 * handed to it explicitly in the JSON response body of `/csrf-token`,
 * `/login`, `/mfa/verify`, and password-change (see `generateToken` call
 * sites below). Since JS never needs to read the cookie, it stays
 * `HttpOnly` just like the session cookie.
 *
 * Deliberately not bound to `req.sessionID`: the session ID rotates on
 * login/MFA/password-change (fixation protection), which would invalidate
 * an in-flight CSRF token for no security benefit. The double-submit
 * cookie's security already comes from the token being unguessable and the
 * cookie being unreadable/unsettable cross-origin (`SameSite=Lax` plus the
 * browser's same-origin policy) -- session binding here would be
 * redundant, not load-bearing.
 */
export const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  cookieName: env.NODE_ENV === 'production' ? '__Host-csrf-token' : 'csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    path: '/',
  },
  getSessionIdentifier: () => 'csrf',
});
