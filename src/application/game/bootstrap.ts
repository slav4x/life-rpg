import { getDb, type DbClient } from "@/db/client";
import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { countSkills, createSkills } from "@/db/repositories/skills";
import { STARTER_SKILLS } from "@/domain/game/constants";

/**
 * Ensure a signed-in user has everything needed to create their first action:
 * the system attributes exist, and a starter set of skills is seeded once.
 */
export async function ensureWorkspace(
  userId: string,
  db: DbClient = getDb(),
): Promise<void> {
  await ensureAttributes(db);

  if ((await countSkills(db, userId)) > 0) return;

  const byCode = new Map(
    (await listAttributes(db)).map((a) => [a.code, a.id]),
  );
  const rows = STARTER_SKILLS.flatMap((s) => {
    const attributeId = byCode.get(s.attribute);
    return attributeId ? [{ userId, attributeId, name: s.name }] : [];
  });
  await createSkills(db, rows);
}
