interface DatabaseErrorLike {
  code?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
}

/** Handles both postgres.js errors and wrappers that expose them through `cause`. */
export function isUniqueConstraintViolation(
  error: unknown,
  constraint: string,
): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current instanceof Error; depth += 1) {
    const databaseError = current as Error & DatabaseErrorLike;
    if (
      databaseError.code === "23505" &&
      databaseError.constraint_name === constraint
    ) {
      return true;
    }
    current = databaseError.cause;
  }
  return false;
}
