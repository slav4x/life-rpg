import { z } from "zod";

import { isValidDateString } from "@/lib/dates/local-date";
import { BASE_XP } from "@/domain/game/constants";

/** A real calendar date in `YYYY-MM-DD` (rejects e.g. 2026-02-31). */
export const isoDateSchema = z
  .string()
  .refine(isValidDateString, "expected a valid YYYY-MM-DD date");

/** Single source of truth for a task/template base-XP value (SPEC §5.4). */
export const baseXpSchema = z.number().int().min(BASE_XP.min).max(BASE_XP.max);

export const estimatedMinutesSchema = z.number().int().min(1).max(1440);

