-- Seed the starter achievements (SPEC §5.8). Idempotent.
INSERT INTO "achievements" ("code", "name", "description", "icon", "rule_type", "rule_config", "sort_order") VALUES
  ('first_action', 'Первое действие', 'Выполните первое действие', '🎯', 'tasks_completed', '{"threshold":1}', 1),
  ('tasks_10', '10 задач', 'Выполните 10 задач', '✅', 'tasks_completed', '{"threshold":10}', 2),
  ('xp_1000', '1000 XP', 'Заработайте 1000 общего опыта', '⭐', 'total_xp', '{"threshold":1000}', 3),
  ('level_5', 'Уровень 5', 'Достигните общего уровня 5', '🚀', 'global_level', '{"threshold":5}', 4),
  ('streak_7', 'Серия 7 дней', 'Поддерживайте серию 7 дней', '🔥', 'streak', '{"threshold":7}', 5),
  ('skill_5', 'Мастер навыка', 'Достигните уровня 5 в одном навыке', '🏆', 'skill_level', '{"threshold":5}', 6),
  ('all_attributes', 'Разносторонний', 'Развивайте все шесть характеристик', '🌱', 'attributes_started', '{"threshold":6}', 7),
  ('first_quest', 'Первый квест', 'Завершите первый квест', '📜', 'quests_completed', '{"threshold":1}', 8)
ON CONFLICT ("code") DO NOTHING;