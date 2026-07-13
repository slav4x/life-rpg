export type GameErrorCode =
  | "task_not_found"
  | "task_not_pending"
  | "nothing_to_revert"
  | "template_not_found"
  | "quest_not_found"
  | "quest_not_active"
  | "step_not_found"
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
      case "nothing_to_revert":
      case "quest_not_active":
        return 409;
      default:
        return 400;
    }
  }
}
