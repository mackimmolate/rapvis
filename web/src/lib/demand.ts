import Papa from "papaparse";

import type {
  ArticleGroups,
  DemandRecord,
  FilterOptions,
  LoadedDataset,
  PeriodPoint,
  TableRow,
  TimeScale,
} from "../types";

export const DEFAULT_ARTICLE_GROUPS: ArticleGroups = {
  "Audi AU38": [
    "8Y1853189D",
    "8Y1853190M",
    "8Y1853190P",
    "8Y2853189M",
    "8Y2853190D",
  ],
  "VW 380R": [
    "5H0867439B",
    "5H0867440B",
    "5H1858415D",
    "5H1858415F",
    "5H1858416F",
    "5H1858416H",
    "5H2858415G",
    "5H2858416E",
  ],
};

const ARTICLE_COLUMN_ALIASES = ["Article number buyer", "Artikelnummer"];
const PERIOD_PATTERN = /^\d{4}-\d{2}-\d{2}\s*-\s*\d{4}-\d{2}-\d{2}$/;

export async function loadDemandFile(file: File): Promise<LoadedDataset> {
  const parsed = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
    transformHeader: (header) => header.trim(),
  });

  const fields = parsed.meta.fields ?? [];
  const articleColumn = ARTICLE_COLUMN_ALIASES.find((field) =>
    fields.includes(field),
  );

  if (!articleColumn) {
    throw new Error(
      "CSV-filen saknar kolumnen 'Article number buyer' eller 'Artikelnummer'.",
    );
  }

  const weekColumns = fields.filter((field) => PERIOD_PATTERN.test(field));
  if (weekColumns.length === 0) {
    throw new Error(
      "CSV-filen saknar veckokolumner i formatet YYYY-MM-DD - YYYY-MM-DD.",
    );
  }

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error("CSV-filen kunde inte läsas.");
  }

  const records: DemandRecord[] = [];
  let totalDemand = 0;

  for (const row of parsed.data) {
    const articleId = stringifyCell(row[articleColumn]).trim();
    const articleNormalized = normalizeArticle(articleId);

    if (!articleId || !articleNormalized) {
      continue;
    }

    for (const weekColumn of weekColumns) {
      const demand = parseDemand(stringifyCell(row[weekColumn]));
      if (!Number.isFinite(demand) || demand <= 0) {
        continue;
      }

      const weekStart = extractWeekStart(weekColumn);
      if (!weekStart) {
        continue;
      }

      records.push({
        articleId,
        articleNormalized,
        weekStart,
        demand,
      });
      totalDemand += demand;
    }
  }

  records.sort((left, right) => {
    if (left.articleNormalized === right.articleNormalized) {
      return left.weekStart.localeCompare(right.weekStart);
    }
    return left.articleNormalized.localeCompare(right.articleNormalized);
  });

  return {
    fileName: file.name,
    importedAt: new Date().toISOString(),
    totalDemand,
    records,
  };
}

export function sanitizeArticleGroups(articleGroups: ArticleGroups): ArticleGroups {
  const normalizedEntries = Object.entries(articleGroups)
    .map(([label, values]) => {
      const groupName = label.trim();
      const normalizedValues = Array.from(
        new Set(values.map(normalizeArticle).filter(Boolean)),
      );

      return [groupName, normalizedValues] as const;
    })
    .filter(([label, values]) => label && values.length > 0);

  return Object.fromEntries(normalizedEntries);
}

export function listAvailablePeriods(
  currentRecords: DemandRecord[],
  historyRecords: DemandRecord[],
  scale: TimeScale,
): string[] {
  const allKeys = [...currentRecords, ...historyRecords].map((record) =>
    getPeriodKey(record.weekStart, scale),
  );

  if (allKeys.length === 0) {
    return [];
  }

  const sorted = Array.from(new Set(allKeys)).sort();
  return buildPeriodRange(sorted[0], sorted.at(-1) ?? sorted[0], scale);
}

export function filterRecords(
  records: DemandRecord[],
  options: FilterOptions,
): DemandRecord[] {
  if (records.length === 0) {
    return [];
  }

  const normalizedGroups = sanitizeArticleGroups(options.articleGroups);
  const normalizedSearch = normalizeArticle(options.articleSearch);
  const allGroupedArticles = new Set(Object.values(normalizedGroups).flat());
  const [fromPeriod, toPeriod] = normalizePeriodBounds(
    options.fromPeriod,
    options.toPeriod,
  );

  return records.filter((record) => {
    const periodKey = getPeriodKey(record.weekStart, options.scale);

    if (fromPeriod && toPeriod) {
      if (periodKey < fromPeriod || periodKey > toPeriod) {
        return false;
      }
    }

    if (options.articleFilter !== "Alla") {
      if (options.articleFilter === "Övrigt") {
        if (allGroupedArticles.has(record.articleNormalized)) {
          return false;
        }
      } else {
        const group = normalizedGroups[options.articleFilter];
        if (!group || !group.includes(record.articleNormalized)) {
          return false;
        }
      }
    }

    if (normalizedSearch) {
      const articleId = normalizeArticle(record.articleId);
      if (
        !articleId.includes(normalizedSearch) &&
        !record.articleNormalized.includes(normalizedSearch)
      ) {
        return false;
      }
    }

    return true;
  });
}

export function buildPeriodSeries(
  currentRecords: DemandRecord[],
  historyRecords: DemandRecord[],
  scale: TimeScale,
  visiblePeriods: string[],
): PeriodPoint[] {
  const periodMap = new Map<string, PeriodPoint>();

  for (const label of visiblePeriods) {
    periodMap.set(label, { label, current: 0, history: 0 });
  }

  for (const record of currentRecords) {
    const key = getPeriodKey(record.weekStart, scale);
    const point = periodMap.get(key);
    if (point) {
      point.current += record.demand;
    }
  }

  for (const record of historyRecords) {
    const key = getPeriodKey(record.weekStart, scale);
    const point = periodMap.get(key);
    if (point) {
      point.history += record.demand;
    }
  }

  return Array.from(periodMap.values());
}

export function buildTableRows(
  currentRecords: DemandRecord[],
  historyRecords: DemandRecord[],
): TableRow[] {
  const labels = new Map<string, string>();
  const currentMap = new Map<string, number>();
  const historyMap = new Map<string, number>();

  for (const record of currentRecords) {
    labels.set(
      record.articleNormalized,
      labels.get(record.articleNormalized) ?? record.articleId,
    );
    currentMap.set(
      record.articleNormalized,
      (currentMap.get(record.articleNormalized) ?? 0) + record.demand,
    );
  }

  for (const record of historyRecords) {
    labels.set(
      record.articleNormalized,
      labels.get(record.articleNormalized) ?? record.articleId,
    );
    historyMap.set(
      record.articleNormalized,
      (historyMap.get(record.articleNormalized) ?? 0) + record.demand,
    );
  }

  return Array.from(new Set([...currentMap.keys(), ...historyMap.keys()]))
    .map((articleKey) => {
      const current = currentMap.get(articleKey) ?? 0;
      const history = historyMap.get(articleKey) ?? 0;

      return {
        articleId: labels.get(articleKey) ?? articleKey,
        current,
        history,
        diff: current - history,
      };
    })
    .sort((left, right) => right.current - left.current);
}

export function filterRecordsForPeriod(
  records: DemandRecord[],
  scale: TimeScale,
  period: string | null,
): DemandRecord[] {
  if (!period) {
    return records;
  }

  return records.filter((record) => getPeriodKey(record.weekStart, scale) === period);
}

export function summarizeSeries(series: PeriodPoint[]) {
  const totalCurrentDemand = series.reduce((sum, period) => sum + period.current, 0);
  const totalHistoryDemand = series.reduce((sum, period) => sum + period.history, 0);
  const peakPeriod = [...series].sort((left, right) => right.current - left.current)[0] ?? null;

  return {
    totalCurrentDemand,
    totalHistoryDemand,
    peakPeriod,
    deltaDemand: totalCurrentDemand - totalHistoryDemand,
  };
}

export function formatDemand(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatImportedAt(importedAt: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(importedAt));
}

export function normalizeArticle(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s\u00A0]+/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

export function getPeriodKey(weekStart: string, scale: TimeScale): string {
  const date = parseIsoDate(weekStart);
  if (scale === "months") {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
  }

  if (scale === "years") {
    return String(date.getUTCFullYear());
  }

  const { isoYear, isoWeek } = getIsoWeekParts(date);
  return `${isoYear}-W${pad(isoWeek)}`;
}

function normalizePeriodBounds(fromPeriod: string, toPeriod: string): [string, string] {
  if (!fromPeriod || !toPeriod) {
    return [fromPeriod, toPeriod];
  }

  return fromPeriod <= toPeriod ? [fromPeriod, toPeriod] : [toPeriod, fromPeriod];
}

function buildPeriodRange(startKey: string, endKey: string, scale: TimeScale): string[] {
  const periods: string[] = [];
  let current = startKey;

  while (current <= endKey) {
    periods.push(current);
    if (current === endKey) {
      break;
    }
    current = nextPeriodKey(current, scale);
  }

  return periods;
}

function nextPeriodKey(periodKey: string, scale: TimeScale): string {
  const date = periodKeyToDate(periodKey, scale);

  if (scale === "weeks") {
    date.setUTCDate(date.getUTCDate() + 7);
  } else if (scale === "months") {
    date.setUTCMonth(date.getUTCMonth() + 1, 1);
  } else {
    date.setUTCFullYear(date.getUTCFullYear() + 1, 0, 1);
  }

  return getPeriodKey(formatIsoDate(date), scale);
}

function periodKeyToDate(periodKey: string, scale: TimeScale): Date {
  if (scale === "months") {
    const [year, month] = periodKey.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
  }

  if (scale === "years") {
    return new Date(Date.UTC(Number(periodKey), 0, 1));
  }

  const [yearPart, weekPart] = periodKey.split("-W");
  const isoYear = Number(yearPart);
  const isoWeek = Number(weekPart);
  const januaryFourth = new Date(Date.UTC(isoYear, 0, 4));
  const weekStart = getWeekStart(januaryFourth);
  weekStart.setUTCDate(weekStart.getUTCDate() + (isoWeek - 1) * 7);
  return weekStart;
}

function extractWeekStart(columnLabel: string): string | null {
  const weekStart = columnLabel.split(" - ")[0]?.trim();
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return null;
  }

  return weekStart;
}

function parseDemand(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return Number.NaN;
  }

  const normalized = trimmed
    .replace(/[\s\u00A0]/g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");

  return Number(normalized);
}

function stringifyCell(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("-");
}

function getIsoWeekParts(date: Date) {
  const weekStart = getWeekStart(date);
  const thursday = new Date(weekStart);
  thursday.setUTCDate(weekStart.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const januaryFourth = new Date(Date.UTC(isoYear, 0, 4));
  const firstWeekStart = getWeekStart(januaryFourth);
  const isoWeek =
    1 +
    Math.round((weekStart.getTime() - firstWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

  return { isoYear, isoWeek };
}

function getWeekStart(date: Date): Date {
  const normalized = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const weekday = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() - weekday + 1);
  return normalized;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
