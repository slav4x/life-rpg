import { env } from "@/lib/env";

/**
 * Lightweight CSRF guard for mutating requests (SPEC §9.3): reject requests
 * whose `Origin` header does not match `APP_URL`. A missing Origin is allowed
 * (same-origin navigations may omit it); an unconfigured `APP_URL` (local dev)
 * disables the check.
 */
export function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (!env.APP_URL) return true;

  try {
    return new URL(origin).origin === new URL(env.APP_URL).origin;
  } catch {
    return false;
  }
}
