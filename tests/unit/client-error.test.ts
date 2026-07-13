import { describe, expect, it } from "vitest";

import { getApiErrorMessage } from "@/lib/http/client-error";

describe("getApiErrorMessage", () => {
  it("maps a known API conflict to a concrete message", async () => {
    const response = Response.json(
      { error: "quest_steps_incomplete" },
      { status: 409 },
    );

    await expect(getApiErrorMessage(response, "Fallback")).resolves.toBe(
      "Сначала завершите все обязательные шаги.",
    );
  });

  it("shows conflict details returned by an import", async () => {
    const response = Response.json(
      { error: "conflict", conflicts: ["Навык уже существует", "Квест изменён"] },
      { status: 409 },
    );

    await expect(getApiErrorMessage(response, "Fallback")).resolves.toBe(
      "Навык уже существует; Квест изменён",
    );
  });

  it("uses a safe server message for non-JSON 5xx responses", async () => {
    const response = new Response("Bad Gateway", { status: 502 });

    await expect(getApiErrorMessage(response, "Fallback")).resolves.toBe(
      "Сервер не смог выполнить операцию. Повторите позже.",
    );
  });
});
