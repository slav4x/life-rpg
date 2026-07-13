import Link from "next/link";

import type { AttributeGroup } from "@/application/skills/skills-overview";
import { Progress } from "@/components/ui/progress";

import { SkillFormDrawer } from "./skill-form-drawer";

export function SkillsScreen({ groups }: { groups: AttributeGroup[] }) {
  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Навыки</h1>
        <SkillFormDrawer />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Навыков пока нет. Создайте первый.
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.code} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              {group.name}
            </h2>
            <div className="flex flex-col gap-2">
              {group.skills.map((skill) => (
                <Link
                  key={skill.id}
                  href={`/skills/${skill.id}`}
                  className="flex flex-col gap-1.5 rounded-xl border bg-card px-3 py-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{skill.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Ур. {skill.level.level} · {skill.xp} XP
                    </span>
                  </div>
                  <Progress value={Math.round(skill.level.ratio * 100)} />
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
