import { describe, expect, it } from "vitest";

import { generateSessionToken, hashSessionToken } from "@/lib/auth/tokens";

describe("session tokens", () => {
  it("generates unique high-entropy tokens", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();

    expect(a).not.toBe(b);
    // 32 random bytes encoded as base64url.
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it("hashes deterministically and never exposes the raw token", () => {
    const token = generateSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});
