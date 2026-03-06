export type TimeScale = "weeks" | "months" | "years";

export type ArticleGroups = Record<string, string[]>;

export interface DemandRecord {
  articleId: string;
  articleNormalized: string;
  weekStart: string;
  demand: number;
}

export interface LoadedDataset {
  fileName: string;
  importedAt: string;
  totalDemand: number;
  records: DemandRecord[];
}

export interface PeriodPoint {
  label: string;
  current: number;
  history: number;
}

export interface TableRow {
  articleId: string;
  current: number;
  history: number;
  diff: number;
}

export interface StoredPreferences {
  timeScale: TimeScale;
  showLabels: boolean;
  articleFilter: string;
  articleGroups: ArticleGroups;
}

export type SortKey = keyof TableRow;

export interface FilterOptions {
  scale: TimeScale;
  fromPeriod: string;
  toPeriod: string;
  articleFilter: string;
  articleGroups: ArticleGroups;
  articleSearch: string;
}
