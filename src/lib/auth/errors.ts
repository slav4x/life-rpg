export type AuthErrorCode = "invalid_init_data" | "forbidden";

/**
 * Domain-level auth failure. `invalid_init_data` maps to 401 (bad/expired
 * Telegram data); `forbidden` maps to 403 (valid Telegram user, not on the
 * allowlist) — see SPEC §9.1 and the Stage 1 acceptance result.
 */
export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }

  get status(): number {
    return this.code === "forbidden" ? 403 : 401;
  }
}
