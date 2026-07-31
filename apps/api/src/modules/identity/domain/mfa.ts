import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';
import { env } from '../../../config.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function derivedKey(): Buffer {
  return createHash('sha256').update(env.MFA_ENCRYPTION_KEY).digest();
}

/** Encrypts a TOTP secret at rest using AES-256-GCM with a key derived from MFA_ENCRYPTION_KEY. */
export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, derivedKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), ciphertext.toString('base64'), authTag.toString('base64')].join(
    '.',
  );
}

export function decryptMfaSecret(ciphertextPayload: string): string {
  const [ivPart, ciphertextPart, authTagPart] = ciphertextPayload.split('.');
  if (!ivPart || !ciphertextPart || !authTagPart) {
    throw new Error('Malformed MFA secret ciphertext');
  }
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    derivedKey(),
    Buffer.from(ivPart, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(accountName: string, issuer: string, secret: string): string {
  return authenticator.keyuri(accountName, issuer, secret);
}

export function verifyTotpToken(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
    const code = randomBytes(5).toString('hex');
    codes.push(code);
    hashes.push(hashRecoveryCode(code));
  }
  return { codes, hashes };
}

/**
 * Recovery codes are high-entropy random tokens (not user-chosen secrets),
 * so a fast cryptographic hash is sufficient and keeps verification cheap
 * even with a large hash list.
 */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
