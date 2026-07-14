export class DataImportError extends Error {
  constructor(
    readonly code: "invalid_format" | "account_not_empty" | "conflict",
    message: string,
    readonly conflicts: string[] = [],
  ) {
    super(message);
    this.name = "DataImportError";
  }

  get status(): number {
    return this.code === "invalid_format" ? 400 : 409;
  }
}

export interface ImportCounts {
  skills: number;
  tasks: number;
  taskTemplates: number;
  quests: number;
}

export interface ImportSummary {
  created: ImportCounts;
  skipped: ImportCounts;
}

export type ContentPackSection = keyof ImportCounts;

export interface ContentPackSelection {
  skills: boolean;
  tasks: boolean;
  taskTemplates: boolean;
  quests: boolean;
}

export interface ContentPackPreview {
  formatVersion: 1 | 2;
  name: string;
  anchorDate: string;
  selection: ContentPackSelection;
  summary: ImportSummary & { rejected: ImportCounts };
  conflicts: string[];
}

export interface ContentPackImportOptions {
  anchorDate?: string;
  selection?: Partial<ContentPackSelection>;
}

