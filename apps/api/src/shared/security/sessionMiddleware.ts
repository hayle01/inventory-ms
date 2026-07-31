import type { RequestHandler } from 'express';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { env } from '../../config.js';
import { getRedisClient } from '../infrastructure/redis.js';

/**
 * Server-side session: the browser only ever holds an opaque, `Secure`,
 * `HttpOnly`, `SameSite=Lax` session ID. All session state lives in Redis.
 */
export function sessionMiddleware(): RequestHandler {
  return session({
    store: new RedisStore({ client: getRedisClient(), prefix: 'sess:' }),
    name: env.SESSION_COOKIE_NAME,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: env.SESSION_IDLE_MINUTES * 60 * 1000,
    },
  });
}
