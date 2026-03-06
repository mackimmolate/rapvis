import { describe, expect, it } from "vitest";

import {
  buildPeriodSeries,
  buildTableRows,
  filterRecords,
  getPeriodKey,
  listAvailablePeriods,
  loadDemandFile,
  normalizeArticle,
  sanitizeArticleGroups,
  summarizeSeries,
} from "./demand";
import type { DemandRecord } from "../types";

function createRecord(
  articleId: string,
  weekStart: string,
  demand: number,
): DemandRecord {
  return {
    articleId,
    articleNormalized: normalizeArticle(articleId),
    weekStart,
    demand,
  };
}

describe("loadDemandFile", () => {
  it("parses semicolon-delimited CSV files and totals positive demand", async () => {
    const file = new File(
      [
        [
          "Article number buyer;2026-03-09 - 2026-03-15;2026-03-16 - 2026-03-22",
          "8Y 185 3189 D;10;5",
          "5H0 867 439 B;0;7",
          ";;;;",
        ].join("\n"),
      ],
      "current.csv",
      { type: "text/csv" },
    );

    const dataset = await loadDemandFile(file);

    expect(dataset.fileName).toBe("current.csv");
    expect(dataset.totalDemand).toBe(22);
    expect(dataset.records).toHaveLength(3);
    expect(dataset.records.map((record) => record.articleNormalized)).toEqual([
      "5H0867439B",
      "8Y1853189D",
      "8Y1853189D",
    ]);
  });

  it("fails with a friendly message when the article column is missing", async () => {
    const file = new File(
      [
        [
          "Wrong Header,2026-03-09 - 2026-03-15",
          "ABC123,10",
        ].join("\n"),
      ],
      "invalid.csv",
      { type: "text/csv" },
    );

    await expect(loadDemandFile(file)).rejects.toThrow(
      "CSV-filen saknar kolumnen 'Article number buyer' eller 'Artikelnummer'.",
    );
  });
});

describe("period helpers", () => {
  it("fills missing weekly periods across the visible range", () => {
    const currentRecords = [createRecord("A1", "2026-03-09", 10)];
    const historyRecords = [createRecord("B2", "2026-03-23", 5)];

    expect(listAvailablePeriods(currentRecords, historyRecords, "weeks")).toEqual([
      "2026-W11",
      "2026-W12",
      "2026-W13",
    ]);
  });

  it("aggregates current and history demand by period", () => {
    const currentRecords = [
      createRecord("A1", "2026-03-09", 10),
      createRecord("A1", "2026-03-16", 5),
      createRecord("B2", "2026-03-09", 2),
    ];
    const historyRecords = [
      createRecord("A1", "2026-03-09", 4),
      createRecord("B2", "2026-03-16", 8),
    ];
    const visiblePeriods = ["2026-W11", "2026-W12"];

    expect(buildPeriodSeries(currentRecords, historyRecords, "weeks", visiblePeriods)).toEqual([
      {
        label: "2026-W11",
        current: 12,
        history: 4,
      },
      {
        label: "2026-W12",
        current: 5,
        history: 8,
      },
    ]);
  });
});

describe("filtering and summaries", () => {
  it("sanitizes groups and supports the Övrigt filter with reversed period bounds", () => {
    const articleGroups = sanitizeArticleGroups({
      Premium: [" 8y 185 3189 d ", "8Y-185-3189-D"],
    });
    const records = [
      createRecord("8Y 185 3189 D", "2026-03-09", 10),
      createRecord("5H0 867 439 B", "2026-03-16", 7),
    ];

    const filtered = filterRecords(records, {
      scale: "weeks",
      fromPeriod: "2026-W12",
      toPeriod: "2026-W11",
      articleFilter: "Övrigt",
      articleGroups,
      articleSearch: "",
    });

    expect(filtered).toEqual([createRecord("5H0 867 439 B", "2026-03-16", 7)]);
  });

  it("builds table rows and summaries from aggregated demand", () => {
    const currentRecords = [
      createRecord("8Y 185 3189 D", "2026-03-09", 10),
      createRecord("8Y 185 3189 D", "2026-03-16", 5),
      createRecord("5H0 867 439 B", "2026-03-09", 3),
    ];
    const historyRecords = [
      createRecord("8Y 185 3189 D", "2026-03-09", 8),
      createRecord("5H0 867 439 B", "2026-03-09", 1),
    ];

    const rows = buildTableRows(currentRecords, historyRecords);
    const series = buildPeriodSeries(
      currentRecords,
      historyRecords,
      "weeks",
      listAvailablePeriods(currentRecords, historyRecords, "weeks"),
    );
    const summary = summarizeSeries(series);

    expect(rows).toEqual([
      { articleId: "8Y 185 3189 D", current: 15, history: 8, diff: 7 },
      { articleId: "5H0 867 439 B", current: 3, history: 1, diff: 2 },
    ]);
    expect(summary.totalCurrentDemand).toBe(18);
    expect(summary.totalHistoryDemand).toBe(9);
    expect(summary.deltaDemand).toBe(9);
    expect(summary.peakPeriod?.label).toBe(getPeriodKey("2026-03-09", "weeks"));
  });
});
