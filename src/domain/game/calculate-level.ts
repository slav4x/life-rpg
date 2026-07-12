/**
 * Level formula (SPEC §5.1). `xpRequiredForLevel(level)` is the cumulative XP
 * needed to reach a level: L1=0, L2=400, L3=900, L5=2500, L10=10000. A user
 * starts at level 1 with 0 XP, so level 1 has no threshold above zero.
 */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 * level * level;
}

/** Inverse of {@link xpRequiredForLevel}: the level for a given total XP. */
export function calculateLevel(totalXp: number): number {
  if (totalXp <= 0) return 1;
  return Math.max(1, Math.floor(Math.sqrt(totalXp / 100)));
}

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0..1 progress towards the next level. */
  ratio: number;
}

export function levelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = calculateLevel(xp);
  const currentLevelXp = xpRequiredForLevel(level);
  const nextLevelXp = xpRequiredForLevel(level + 1);
  const xpForNextLevel = nextLevelXp - currentLevelXp;
  const xpIntoLevel = xp - currentLevelXp;

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    ratio: xpForNextLevel > 0 ? xpIntoLevel / xpForNextLevel : 0,
  };
}
