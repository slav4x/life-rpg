const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Сессия истекла. Откройте приложение заново.",
  forbidden_origin: "Запрос отклонён проверкой безопасности.",
  invalid_body: "Проверьте заполненные поля.",
  invalid_input: "Данные не прошли проверку.",
  invalid_task_id: "Некорректный идентификатор задачи.",
  invalid_template_id: "Некорректный идентификатор шаблона.",
  invalid_quest_id: "Некорректный идентификатор квеста.",
  invalid_step_id: "Некорректный идентификатор шага.",
  invalid_skill_id: "Некорректный идентификатор навыка.",
  task_not_found: "Задача не найдена или уже удалена.",
  task_not_pending: "Задача уже завершена или отменена.",
  task_date_future: "Будущую задачу нельзя завершить заранее.",
  task_date_too_old: "Задачу можно завершить задним числом только за последние 7 дней.",
  task_not_overdue: "Задача уже не является просроченной.",
  task_reschedule_past: "Перенесите задачу на сегодня или будущую дату.",
  task_scope_invalid: "Действие «эта и будущие» доступно только для повторения.",
  nothing_to_revert: "У задачи нет активного выполнения для отмены.",
  template_not_found: "Шаблон не найден или уже удалён.",
  quest_not_found: "Квест не найден или уже удалён.",
  quest_not_active: "Квест уже завершён или находится в архиве.",
  quest_steps_incomplete: "Сначала завершите все обязательные шаги.",
  step_not_found: "Шаг квеста не найден.",
  step_already_completed: "Шаг уже завершён.",
  quest_step_task_exists: "Для этого шага уже создана активная задача.",
  duplicate_skill: "Активный навык с таким названием уже существует.",
  duplicate_template: "Неархивный шаблон с таким названием уже существует.",
  skill_not_found: "Навык не найден или находится в архиве.",
  skill_archived: "Сначала восстановите навык, связанный с шаблоном.",
  attribute_not_found: "Характеристика не найдена.",
  invalid_format: "Версия или формат файла не поддерживается.",
  account_not_empty: "В профиле уже есть данные.",
  conflict: "Обнаружены конфликтующие записи.",
  internal_error: "Сервер не смог выполнить операцию. Повторите позже.",
};

export const NETWORK_ERROR_MESSAGE =
  "Нет соединения с сервером. Проверьте интернет и повторите попытку.";

export async function getApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
      conflicts?: string[];
    };
    if (payload.conflicts?.length) {
      return payload.conflicts.slice(0, 3).join("; ");
    }
    if (payload.error && ERROR_MESSAGES[payload.error]) {
      return ERROR_MESSAGES[payload.error];
    }
  } catch {
    // Non-JSON server/proxy response: use the operation-specific fallback.
  }
  if (response.status >= 500) {
    return ERROR_MESSAGES.internal_error;
  }
  return fallback;
}
