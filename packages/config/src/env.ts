import { z } from 'zod';

const boolFromString = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value === 'true'));

const csvToArray = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('Inventory Management System'),
  APP_BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),

  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1),
  REDIS_URL: z.string().min(1),

  SESSION_COOKIE_NAME: z.string().min(1).default('ims.sid'),
  SESSION_SECRET: z.string().min(32),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().positive().default(12),
  CSRF_SECRET: z.string().min(32),

  PASSWORD_PEPPER: z.string().min(32),
  MFA_ENCRYPTION_KEY: z.string().min(32),

  OBJECT_STORAGE_ENDPOINT: z.string().url().optional(),
  OBJECT_STORAGE_BUCKET: z.string().min(1).optional(),
  OBJECT_STORAGE_ACCESS_KEY: z.string().optional(),
  OBJECT_STORAGE_SECRET_KEY: z.string().optional(),

  MAIL_HOST: z.string().min(1).optional(),
  MAIL_PORT: z.coerce.number().int().positive().optional(),
  MAIL_SECURE: boolFromString(false),
  MAIL_USER: z.string().min(1).optional(),
  MAIL_PASSWORD: z.string().min(1).optional(),
  MAIL_FROM: z.string().email().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ALLOWED_ORIGINS: csvToArray,
  DEFAULT_TIMEZONE: z.string().min(1).default('UTC'),
  DEFAULT_CURRENCY: z.string().length(3).default('USD'),
  DEFAULT_EXPIRY_WARNING_DAYS: z.coerce.number().int().nonnegative().default(90),

  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_FORGOT_PASSWORD_MAX: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_FORGOT_PASSWORD_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  RATE_LIMIT_MFA_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_MFA_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_GENERAL_API_MAX: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_GENERAL_API_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_SEARCH_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_SEARCH_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_STOCK_POSTING_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_STOCK_POSTING_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_EXPORT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_EXPORT_WINDOW_SECONDS: z.coerce.number().int().positive().default(86400),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_UPLOAD_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),

  ACCOUNT_LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(10),
  ACCOUNT_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  MFA_REQUIRED_FOR_ADMIN: boolFromString(true),

  PURCHASE_ORDER_PREVENT_SELF_APPROVAL: boolFromString(true),
  STOCK_REQUEST_PREVENT_SELF_APPROVAL: boolFromString(true),
  ADJUSTMENT_PREVENT_SELF_APPROVAL: boolFromString(true),
  ADJUSTMENT_MATERIAL_QUANTITY_THRESHOLD: z.coerce.number().nonnegative().default(100),
  TRANSFER_PREVENT_SELF_APPROVAL: boolFromString(true),
  STOCK_COUNT_PREVENT_SELF_APPROVAL: boolFromString(true),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}
