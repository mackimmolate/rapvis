import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { PeriodChart } from "./components/PeriodChart";
import {
  buildPeriodSeries,
  buildTableRows,
  filterRecords,
  filterRecordsForPeriod,
  formatDemand,
  loadDemandFile,
  listAvailablePeriods,
  summarizeSeries,
} from "./lib/demand";
import { loadPreferences, savePreferences } from "./lib/storage";
import type {
  ArticleGroups,
  LoadedDataset,
  SortKey,
  StoredPreferences,
  TableRow,
  TimeScale,
} from "./types";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function App() {
  const [preferences] = useState(() => loadPreferences());
  const currentInputRef = useRef<HTMLInputElement>(null);
  const historyInputRef = useRef<HTMLInputElement>(null);

  const [currentData, setCurrentData] = useState<LoadedDataset | null>(null);
  const [historyData, setHistoryData] = useState<LoadedDataset | null>(null);
  const [timeScale, setTimeScale] = useState<TimeScale>(preferences.timeScale);
  const [articleFilter, setArticleFilter] = useState(preferences.articleFilter);
  const [articleGroups] = useState<ArticleGroups>(preferences.articleGroups);
  const [fromPeriod, setFromPeriod] = useState("");
  const [toPeriod, setToPeriod] = useState("");
  const [showLabels, setShowLabels] = useState(preferences.showLabels);
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("diff");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingTarget, setLoadingTarget] = useState<"current" | "history" | null>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const deferredFilter = useDeferredValue(articleFilter);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const articleFilterOptions = [
    ...Object.keys(articleGroups),
    "Övrigt",
    "Alla",
  ].filter((value, index, array) => array.indexOf(value) === index);

  const periodOptions = listAvailablePeriods(
    currentData?.records ?? [],
    historyData?.records ?? [],
    timeScale,
  );

  const filteredCurrent = filterRecords(currentData?.records ?? [], {
    scale: timeScale,
    fromPeriod,
    toPeriod,
    articleFilter: deferredFilter,
    articleGroups,
    articleSearch: "",
  });

  const filteredHistory = filterRecords(historyData?.records ?? [], {
    scale: timeScale,
    fromPeriod,
    toPeriod,
    articleFilter: deferredFilter,
    articleGroups,
    articleSearch: "",
  });

  const visiblePeriods = periodOptions.filter((period) => {
    if (fromPeriod && period < fromPeriod) {
      return false;
    }
    if (toPeriod && period > toPeriod) {
      return false;
    }
    return true;
  });

  const periodSeries = buildPeriodSeries(
    filteredCurrent,
    filteredHistory,
    timeScale,
    visiblePeriods,
  );

  const summary = summarizeSeries(periodSeries);
  const tableCurrent = filterRecordsForPeriod(filteredCurrent, timeScale, activePeriod);
  const tableHistory = filterRecordsForPeriod(filteredHistory, timeScale, activePeriod);
  const tableRows = sortRows(
    buildTableRows(tableCurrent, tableHistory),
    sortKey,
    sortDirection,
  );

  useEffect(() => {
    const nextPreferences: StoredPreferences = {
      timeScale,
      showLabels,
      articleFilter,
      articleGroups,
    };

    savePreferences(nextPreferences);
  }, [articleFilter, articleGroups, showLabels, timeScale]);

  useEffect(() => {
    if (periodOptions.length === 0) {
      if (fromPeriod) {
        setFromPeriod("");
      }
      if (toPeriod) {
        setToPeriod("");
      }
      if (activePeriod) {
        setActivePeriod(null);
      }
      return;
    }

    if (!fromPeriod || !periodOptions.includes(fromPeriod)) {
      setFromPeriod(periodOptions[0]);
    }

    if (!toPeriod || !periodOptions.includes(toPeriod)) {
      setToPeriod(periodOptions.at(-1) ?? periodOptions[0]);
    }
  }, [activePeriod, fromPeriod, periodOptions, toPeriod]);

  useEffect(() => {
    if (activePeriod && !visiblePeriods.includes(activePeriod)) {
      setActivePeriod(null);
    }
  }, [activePeriod, visiblePeriods]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  async function handleUpload(
    target: "current" | "history",
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setErrorMessage("");
    setLoadingTarget(target);

    try {
      const dataset = await loadDemandFile(file);
      if (target === "current") {
        setCurrentData(dataset);
      } else {
        setHistoryData(dataset);
      }
      setActivePeriod(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Filen kunde inte läsas.",
      );
    } finally {
      setLoadingTarget(null);
    }
  }

  async function handleInstall() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  function handleSort(column: SortKey) {
    if (sortKey === column) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(column);
    setSortDirection(column === "articleId" ? "asc" : "desc");
  }

  function handleTimeScaleChange(scale: TimeScale) {
    setTimeScale(scale);
    setActivePeriod(null);
  }

  function handleFilterReset() {
    setArticleFilter("Alla");
    setActivePeriod(null);

    if (periodOptions.length > 0) {
      setFromPeriod(periodOptions[0]);
      setToPeriod(periodOptions.at(-1) ?? periodOptions[0]);
    }
  }

  function handleClearHistory() {
    setHistoryData(null);
    setActivePeriod(null);
  }

  const insightsText = buildInsightsText(summary, timeScale, filteredCurrent.length > 0);
  const statusText = buildStatusText(loadingTarget, currentData, historyData, activePeriod);

  return (
    <div className="page-shell">
      <div className="app-window">
        <div className="title-row">
          <div className="window-title">Efterfrågeanalys V0.4</div>
          <div className="window-actions">
            {deferredPrompt ? (
              <button className="title-button" onClick={() => void handleInstall()} type="button">
                Installera
              </button>
            ) : null}
          </div>
        </div>

        <div className="toolbar">
          <button
            className="toolbar-button success"
            onClick={() => currentInputRef.current?.click()}
            type="button"
          >
            Ladda förfrågan
          </button>

          <button
            className="toolbar-button primary"
            onClick={() => historyInputRef.current?.click()}
            type="button"
          >
            Ladda historik
          </button>

          <select
            className="toolbar-select article-select"
            value={articleFilter}
            onChange={(event) => {
              setArticleFilter(event.target.value);
              setActivePeriod(null);
            }}
          >
            {articleFilterOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <label className="toolbar-label">
            <span>Från:</span>
            <select
              className="toolbar-select"
              value={fromPeriod}
              onChange={(event) => setFromPeriod(event.target.value)}
              disabled={periodOptions.length === 0}
            >
              {periodOptions.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </label>

          <label className="toolbar-label">
            <span>Till:</span>
            <select
              className="toolbar-select"
              value={toPeriod}
              onChange={(event) => setToPeriod(event.target.value)}
              disabled={periodOptions.length === 0}
            >
              {periodOptions.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </label>

          <div className="toolbar-radios" role="radiogroup" aria-label="Tidsskala">
            <label>
              <input
                checked={timeScale === "weeks"}
                onChange={() => handleTimeScaleChange("weeks")}
                type="radio"
              />
              <span>Veckor</span>
            </label>
            <label>
              <input
                checked={timeScale === "months"}
                onChange={() => handleTimeScaleChange("months")}
                type="radio"
              />
              <span>Månader</span>
            </label>
            <label>
              <input
                checked={timeScale === "years"}
                onChange={() => handleTimeScaleChange("years")}
                type="radio"
              />
              <span>År</span>
            </label>
          </div>

          <label className="toolbar-checkbox">
            <input
              checked={showLabels}
              onChange={(event) => setShowLabels(event.target.checked)}
              type="checkbox"
            />
            <span>Visa pratbubblor</span>
          </label>

          <button className="toolbar-button warning-outline" onClick={handleFilterReset} type="button">
            Visa alla
          </button>

          <button
            className="toolbar-button danger-outline"
            disabled={!historyData}
            onClick={handleClearHistory}
            type="button"
          >
            Rensa historik
          </button>
        </div>

        {errorMessage ? <div className="message-strip error">{errorMessage}</div> : null}
        {statusText ? <div className="message-strip status">{statusText}</div> : null}

        <section className="graph-panel">
          {periodSeries.length > 0 ? (
            <PeriodChart
              activePeriod={activePeriod}
              data={periodSeries}
              onSelectPeriod={setActivePeriod}
              showLabels={showLabels}
            />
          ) : (
            <div className="empty-panel">Ingen data tillgänglig för valda filter</div>
          )}
        </section>

        <section className="insights-panel">
          <div className="section-title">Insikter</div>
          <div className="insights-text">{insightsText}</div>
        </section>

        <section className="table-panel">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <SortableHeader
                    active={sortKey === "articleId"}
                    direction={sortDirection}
                    label="Artikelnummer"
                    onClick={() => handleSort("articleId")}
                  />
                  <SortableHeader
                    active={sortKey === "current"}
                    direction={sortDirection}
                    label="Nuvarande"
                    onClick={() => handleSort("current")}
                  />
                  <SortableHeader
                    active={sortKey === "history"}
                    direction={sortDirection}
                    label="Historik"
                    onClick={() => handleSort("history")}
                  />
                  <SortableHeader
                    active={sortKey === "diff"}
                    direction={sortDirection}
                    label="Differens"
                    onClick={() => handleSort("diff")}
                  />
                </tr>
              </thead>
              <tbody>
                {tableRows.length > 0 ? (
                  tableRows.map((row) => (
                    <tr key={row.articleId}>
                      <td>{row.articleId}</td>
                      <td>{formatDemand(row.current)}</td>
                      <td>{formatDemand(row.history)}</td>
                      <td>{formatDemand(row.diff)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="empty-table" colSpan={4}>
                      Ingen data tillgänglig.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <input
          ref={currentInputRef}
          accept=".csv,text/csv"
          className="hidden-input"
          onChange={(event) => void handleUpload("current", event)}
          type="file"
        />
        <input
          ref={historyInputRef}
          accept=".csv,text/csv"
          className="hidden-input"
          onChange={(event) => void handleUpload("history", event)}
          type="file"
        />
      </div>

      {(offlineReady || needRefresh) && (
        <div className="sw-toast">
          <div className="sw-toast-text">
            {offlineReady
              ? "Offline-läget är klart."
              : "En ny version finns tillgänglig."}
          </div>
          <div className="sw-toast-actions">
            {offlineReady ? (
              <button className="title-button" onClick={() => setOfflineReady(false)} type="button">
                Stäng
              </button>
            ) : null}
            {needRefresh ? (
              <>
                <button className="title-button" onClick={() => setNeedRefresh(false)} type="button">
                  Senare
                </button>
                <button
                  className="title-button primary"
                  onClick={() => void updateServiceWorker(true)}
                  type="button"
                >
                  Uppdatera
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th>
      <button className="header-button" onClick={onClick} type="button">
        <span>{label}</span>
        <span>{active ? (direction === "asc" ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );
}

function sortRows(
  rows: TableRow[],
  sortKey: SortKey,
  sortDirection: "asc" | "desc",
): TableRow[] {
  const sorted = [...rows].sort((left, right) => {
    if (sortKey === "articleId") {
      return left.articleId.localeCompare(right.articleId, "sv");
    }
    return left[sortKey] - right[sortKey];
  });

  return sortDirection === "asc" ? sorted : sorted.reverse();
}

function buildInsightsText(
  summary: ReturnType<typeof summarizeSeries>,
  _timeScale: TimeScale,
  hasCurrentData: boolean,
) {
  if (!hasCurrentData || !summary.peakPeriod) {
    return "Ingen data tillgänglig.";
  }

  const totalText = formatDemand(summary.totalCurrentDemand);
  const peakText = formatDemand(summary.peakPeriod.current);

  return `Totalt behov: ${totalText} | Topp: ${summary.peakPeriod.label} (${peakText})`;
}

function buildStatusText(
  loadingTarget: "current" | "history" | null,
  currentData: LoadedDataset | null,
  historyData: LoadedDataset | null,
  activePeriod: string | null,
) {
  if (loadingTarget === "current") {
    return "Laddar förfrågan...";
  }

  if (loadingTarget === "history") {
    return "Laddar historik...";
  }

  if (activePeriod) {
    return `Tabellen visar vald period: ${activePeriod}`;
  }

  if (currentData && historyData) {
    return `Förfrågan: ${currentData.fileName} | Historik: ${historyData.fileName}`;
  }

  if (currentData) {
    return `Förfrågan: ${currentData.fileName}`;
  }

  if (historyData) {
    return `Historik: ${historyData.fileName}`;
  }

  return "";
}
