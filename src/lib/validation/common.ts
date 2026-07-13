import { z } from "zod";

import { isValidDateString } from "@/lib/dates/local-date";

/** A real calendar date in `YYYY-MM-DD` (rejects e.g. 2026-02-31). */
export const isoDateSchema = z
  .string()
  .refine(isValidDateString, "expected a valid YYYY-MM-DD date");
