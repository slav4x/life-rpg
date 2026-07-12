import { describe, expect, it } from "vitest";

import {
  getLocalDate,
  isValidDateString,
  isValidTimeZone,
} from "@/lib/dates/local-date";

describe("getLocalDate", () => {
  it("uses the user's timezone to pick the calendar day", () => {
    // 22:30 UTC is already the next day in Novosibirsk (UTC+7).
    const at = new Date("2026-07-13T22:30:00Z");
    expect(getLocalDate("Asia/Novosibirsk", at)).toBe("2026-07-14");
    expect(getLocalDate("UTC", at)).toBe("2026-07-13");
  });

  it("throws on an invalid timezone", () => {
    expect(() => getLocalDate("Mars/Phobos")).toThrow(/Invalid timezone/);
  });
});

describe("isValidTimeZone", () => {
  it("distinguishes valid and invalid zones", () => {
    expect(isValidTimeZone("Asia/Novosibirsk")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("isValidDateString", () => {
  it("accepts YYYY-MM-DD and rejects the rest", () => {
    expect(isValidDateString("2026-07-13")).toBe(true);
    expect(isValidDateString("2026-13-40")).toBe(false);
    expect(isValidDateString("13.07.2026")).toBe(false);
  });
});
