import 'dotenv/config';
import { parseEnv, type Env } from '@inventory-ms/config';

export const env: Env = parseEnv();

export const rateLimitPolicies = {
  login: { points: env.RATE_LIMIT_LOGIN_MAX, durationSeconds: env.RATE_LIMIT_LOGIN_WINDOW_SECONDS },
  forgotPassword: {
    points: env.RATE_LIMIT_FORGOT_PASSWORD_MAX,
    durationSeconds: env.RATE_LIMIT_FORGOT_PASSWORD_WINDOW_SECONDS,
  },
  mfaVerify: { points: env.RATE_LIMIT_MFA_MAX, durationSeconds: env.RATE_LIMIT_MFA_WINDOW_SECONDS },
  generalApi: {
    points: env.RATE_LIMIT_GENERAL_API_MAX,
    durationSeconds: env.RATE_LIMIT_GENERAL_API_WINDOW_SECONDS,
  },
  search: {
    points: env.RATE_LIMIT_SEARCH_MAX,
    durationSeconds: env.RATE_LIMIT_SEARCH_WINDOW_SECONDS,
  },
  stockPosting: {
    points: env.RATE_LIMIT_STOCK_POSTING_MAX,
    durationSeconds: env.RATE_LIMIT_STOCK_POSTING_WINDOW_SECONDS,
  },
  exportCreation: {
    points: env.RATE_LIMIT_EXPORT_MAX,
    durationSeconds: env.RATE_LIMIT_EXPORT_WINDOW_SECONDS,
  },
  fileUpload: {
    points: env.RATE_LIMIT_UPLOAD_MAX,
    durationSeconds: env.RATE_LIMIT_UPLOAD_WINDOW_SECONDS,
  },
} as const;

export const accountLockoutPolicy = {
  failureThreshold: env.ACCOUNT_LOCKOUT_THRESHOLD,
  lockoutMinutes: env.ACCOUNT_LOCKOUT_MINUTES,
} as const;

export const procurementPolicy = {
  preventSelfApproval: env.PURCHASE_ORDER_PREVENT_SELF_APPROVAL,
} as const;

export const requestsPolicy = {
  preventSelfApproval: env.STOCK_REQUEST_PREVENT_SELF_APPROVAL,
} as const;

export const adjustmentsPolicy = {
  preventSelfApproval: env.ADJUSTMENT_PREVENT_SELF_APPROVAL,
  materialQuantityThreshold: env.ADJUSTMENT_MATERIAL_QUANTITY_THRESHOLD,
} as const;

export const transfersPolicy = {
  preventSelfApproval: env.TRANSFER_PREVENT_SELF_APPROVAL,
} as const;

export const countsPolicy = {
  preventSelfApproval: env.STOCK_COUNT_PREVENT_SELF_APPROVAL,
} as const;
