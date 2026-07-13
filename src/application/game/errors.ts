export type GameErrorCode =
  | "task_not_found"
  | "task_not_pending"
  | "task_date_future"
  | "task_date_too_old"
  | "nothing_to_revert"
  | "template_not_found"
  | "quest_not_found"
  | "quest_not_active"
  | "quest_steps_incomplete"
  | "step_not_found"
  | "step_already_completed"
  | "quest_step_task_exists"
  | "duplicate_skill"
  | "duplicate_template"
  | "skill_not_found"
  | "attribute_not_found"
  | "invalid_input";

export class GameError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = "GameError";
    this.code = code;
  }

  get status(): number {
    switch (this.code) {
      case "task_not_found":
      case "template_not_found":
      case "quest_not_found":
      case "step_not_found":
      case "skill_not_found":
      case "attribute_not_found":
        return 404;
      case "task_not_pending":
      case "task_date_future":
      case "task_date_too_old":
      case "nothing_to_revert":
      case "quest_not_active":
      case "quest_steps_incomplete":
      case "step_already_completed":
      case "quest_step_task_exists":
      case "duplicate_skill":
      case "duplicate_template":
        return 409;
      default:
        return 400;
    }
  }
}
