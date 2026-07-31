import argon2 from 'argon2';
import { env } from '../../../config.js';

/**
 * Argon2id with reviewed cost settings (OWASP-recommended baseline). A
 * server-side pepper is concatenated before hashing so a leaked password
 * database alone is insufficient to brute-force offline.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

function withPepper(password: string): string {
  return `${password}:${env.PASSWORD_PEPPER}`;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(withPepper(password), ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, withPepper(password));
  } catch {
    return false;
  }
}
