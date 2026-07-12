import { createHash, randomBytes } from "node:crypto";

/**
 * Session token helpers (SPEC §9.1). The raw token is returned to the client
 * once in an HttpOnly cookie; only its SHA-256 hash is ever persisted.
 */

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
