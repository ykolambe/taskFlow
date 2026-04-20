/**
 * Central JWT signing material. In production, JWT_SECRET must be set and long enough
 * so sessions cannot be forged with a well-known default.
 */
const DEV_FALLBACK = "fallback-dev-secret-please-change";
/** OWASP-style minimum for HS256 secrets in production (bytes of entropy in base64 would differ; length in UTF-8 chars). */
const PRODUCTION_MIN_LENGTH = 32;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * UTF-8 secret string for HMAC-JWT and for OTP hashing (must match across callers).
 * Throws in production if missing or too short.
 */
export function getJwtSecretUtf8(): string {
  const raw = process.env.JWT_SECRET?.trim();

  if (!raw) {
    if (isProduction()) {
      throw new Error(
        "JWT_SECRET must be set to a strong random value in production (see .env.example)."
      );
    }
    return DEV_FALLBACK;
  }

  if (isProduction() && raw.length < PRODUCTION_MIN_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${PRODUCTION_MIN_LENGTH} characters in production.`
    );
  }

  if (!isProduction() && raw.length < PRODUCTION_MIN_LENGTH) {
    console.warn(
      `[auth] JWT_SECRET is shorter than ${PRODUCTION_MIN_LENGTH} characters; use a longer secret before production.`
    );
  }

  return raw;
}

/** Binary key for jose SignJWT / jwtVerify. */
export function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecretUtf8());
}
