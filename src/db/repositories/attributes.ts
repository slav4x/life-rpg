import { asc } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { attributes, type Attribute } from "@/db/schema";
import { ATTRIBUTES } from "@/domain/game/constants";

/** Idempotently seed the six system attributes (SPEC §5.2). */
export async function ensureAttributes(db: DbClient): Promise<void> {
  await db
    .insert(attributes)
    .values(
      ATTRIBUTES.map((a) => ({
        code: a.code,
        name: a.name,
        description: a.description,
        sortOrder: a.sortOrder,
      })),
    )
    .onConflictDoNothing({ target: attributes.code });
}

export async function listAttributes(db: DbClient): Promise<Attribute[]> {
  return db.select().from(attributes).orderBy(asc(attributes.sortOrder));
}
