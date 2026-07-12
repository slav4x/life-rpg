import { describe, expect, it } from "vitest";

import { InitDataError, verifyInitData } from "@/lib/telegram/init-data";
import { createInitData, TEST_BOT_TOKEN } from "../fixtures/telegram";

const options = { maxAgeSeconds: 86_400 };

describe("verifyInitData", () => {
  it("accepts a validly signed payload", () => {
    const initData = createInitData({ user: { id: 42, first_name: "Ada" } });

    const result = verifyInitData(initData, TEST_BOT_TOKEN, options);

    expect(result.user.id).toBe(42);
    expect(result.user.first_name).toBe("Ada");
  });

  it("rejects a tampered payload", () => {
    const initData = createInitData({
      user: { id: 42, first_name: "Ada" },
    }).replace("Ada", "Eve");

    expect(() => verifyInitData(initData, TEST_BOT_TOKEN, options)).toThrow(
      /signature mismatch/,
    );
  });

  it("rejects a wrong bot token", () => {
    const initData = createInitData();

    expect(() =>
      verifyInitData(initData, "999999:OTHER_TOKEN", options),
    ).toThrow(InitDataError);
  });

  it("rejects an expired auth_date", () => {
    const initData = createInitData({
      authDate: new Date(Date.now() - 2 * 86_400_000),
    });

    expect(() => verifyInitData(initData, TEST_BOT_TOKEN, options)).toThrow(
      /expired/,
    );
  });

  it("rejects a missing hash", () => {
    expect(() =>
      verifyInitData("auth_date=1&user=%7B%7D", TEST_BOT_TOKEN, options),
    ).toThrow(/missing hash/);
  });

  it("stays valid when Telegram adds a signature field", () => {
    const initData = createInitData({ extra: { signature: "ed25519sig" } });

    const result = verifyInitData(initData, TEST_BOT_TOKEN, options);

    expect(result.user.first_name).toBeDefined();
  });
});
