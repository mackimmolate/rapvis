import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { PeriodChart } from "./components/PeriodChart";
import {
  DEFAULT_ARTICLE_GROUPS,
  buildPeriodSeries,
  buildTableRows,
  filterRecords,
  filterRecordsForPeriod,
  formatDemand,
  formatImportedAt,
  loadDemandFile,
  listAvailablePeriods,
  sanitizeArticleGroups,
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

  const [currentData, setCurrentData] = useState<LoadedDataset | null>(null);
  const [historyData, setHistoryData] = useState<LoadedDataset | null>(null);
  const [timeScale, setTimeScale] = useState<TimeScale>(preferences.timeScale);
  const [articleFilter, setArticleFilter] = useState(preferences.articleFilter);
  const [articleGroups, setArticleGroups] = useState<ArticleGroups>(preferences.articleGroups);
  const [articleSearch, setArticleSearch] = useState("");
  const [fromPeriod, setFromPeriod] = useState("");
  const [toPeriod, setToPeriod] = useState("");
  const [showLabels, setShowLabels] = useState(preferences.showLabels);
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("diff");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingTarget, setLoadingTarget] = useState<"current" | "history" | null>(null);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupDraft, setGroupDraft] = useState(
    JSON.stringify(preferences.articleGroups, null, 2),
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const deferredSearch = useDeferredValue(articleSearch.trim());

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const periodOptions = listAvailablePeriods(
    currentData?.records ?? [],
    historyData?.records ?? [],
    timeScale,
  );

  const articleFilterOptions = ["Alla", ...Object.keys(articleGroups), "Övrigt"].filter(
    (value, index, array) => array.indexOf(value) === index,
  );

  const filteredCurrent = filterRecords(currentData?.records ?? [], {
    scale: timeScale,
    fromPeriod,
    toPeriod,
    articleFilter,
    articleGroups,
    articleSearch: deferredSearch,
  });

  const filteredHistory = filterRecords(historyData?.records ?? [], {
    scale: timeScale,
    fromPeriod,
    toPeriod,
    articleFilter,
    articleGroups,
    articleSearch: deferredSearch,
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

  const visibleCurrentForTable = filterRecordsForPeriod(
    filteredCurrent,
    timeScale,
    activePeriod,
  );
  const visibleHistoryForTable = filterRecordsForPeriod(
    filteredHistory,
    timeScale,
    activePeriod,
  );
  const tableRows = sortRows(
    buildTableRows(visibleCurrentForTable, visibleHistoryForTable),
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
    if (!articleFilterOptions.includes(articleFilter)) {
      setArticleFilter("Alla");
    }
  }, [articleFilter, articleFilterOptions]);

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

    const onConnectivityChange = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("online", onConnectivityChange);
    window.addEventListener("offline", onConnectivityChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("online", onConnectivityChange);
      window.removeEventListener("offline", onConnectivityChange);
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
      startTransition(() => {
        if (target === "current") {
          setCurrentData(dataset);
        } else {
          setHistoryData(dataset);
        }
        setActivePeriod(null);
      });
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

  function resetFilters() {
    setArticleFilter("Alla");
    setArticleSearch("");
    setActivePeriod(null);

    if (periodOptions.length > 0) {
      setFromPeriod(periodOptions[0]);
      setToPeriod(periodOptions.at(-1) ?? periodOptions[0]);
    }
  }

  function clearHistory() {
    setHistoryData(null);
    setActivePeriod(null);
  }

  function openGroupEditor() {
    setGroupDraft(JSON.stringify(articleGroups, null, 2));
    setGroupEditorOpen(true);
    setErrorMessage("");
  }

  function saveGroupEditorDraft() {
    try {
      const parsed = JSON.parse(groupDraft) as ArticleGroups;
      const sanitized = sanitizeArticleGroups(parsed);

      if (Object.keys(sanitized).length === 0) {
        throw new Error("Minst en grupp med artikelnummer krävs.");
      }

      setArticleGroups(sanitized);
      setGroupEditorOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Grupperna kunde inte sparas.",
      );
    }
  }

  function resetGroupEditorDraft() {
    setGroupDraft(JSON.stringify(DEFAULT_ARTICLE_GROUPS, null, 2));
  }

  return (
    <div className="app-shell">
      <div className="backdrop backdrop-one" />
      <div className="backdrop backdrop-two" />

      <header className="hero panel">
        <div className="hero-copy">
          <span className="eyebrow">Progressive demand analysis</span>
          <h1>Rapvis</h1>
          <p>
            Ladda aktuell efterfrågan och historik, jämför perioder och installera
            analysen som en riktig app.
          </p>
        </div>

        <div className="hero-actions">
          <div className="status-badges">
            <span className={`status-badge ${isOnline ? "online" : "offline"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
            <span className="status-badge accent">
              {navigator.serviceWorker ? "PWA aktiv" : "Webbläge"}
            </span>
          </div>

          {deferredPrompt ? (
            <button className="button button-primary" onClick={() => void handleInstall()}>
              Installera appen
            </button>
          ) : null}
        </div>
      </header>

      {errorMessage ? <div className="banner error">{errorMessage}</div> : null}

      <section className="top-grid">
        <DatasetCard
          title="Nuvarande förfrågan"
          description="Importera den senaste CSV-filen som bas för analysen."
          dataset={currentData}
          busy={loadingTarget === "current"}
          onUpload={(event) => void handleUpload("current", event)}
          onClear={
            currentData
              ? () => {
                  setCurrentData(null);
                  setActivePeriod(null);
                }
              : undefined
          }
        />

        <DatasetCard
          title="Historik"
          description="Ladda en andra CSV-fil för att jämföra mot tidigare utfall."
          dataset={historyData}
          busy={loadingTarget === "history"}
          onUpload={(event) => void handleUpload("history", event)}
          onClear={historyData ? clearHistory : undefined}
        />

        <section className="panel controls-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Filter</span>
              <h2>Analyskontroller</h2>
            </div>
            <button className="button button-ghost" onClick={resetFilters}>
              Återställ
            </button>
          </div>

          <div className="control-stack">
            <label className="field">
              <span>Tidsnivå</span>
              <div className="segmented">
                {[
                  { label: "Veckor", value: "weeks" },
                  { label: "Månader", value: "months" },
                  { label: "År", value: "years" },
                ].map((option) => (
                  <button
                    key={option.value}
                    className={`segment ${timeScale === option.value ? "active" : ""}`}
                    onClick={() => {
                      setTimeScale(option.value as TimeScale);
                      setActivePeriod(null);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </label>

            <div className="field-row">
              <label className="field">
                <span>Från</span>
                <select
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

              <label className="field">
                <span>Till</span>
                <select
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
            </div>

            <label className="field">
              <span>Artikelgrupp</span>
              <select
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
            </label>

            <label className="field">
              <span>Artikelsökning</span>
              <input
                type="search"
                value={articleSearch}
                onChange={(event) => setArticleSearch(event.target.value)}
                placeholder="Sök artikelnummer"
              />
            </label>

            <label className="toggle">
              <input
                checked={showLabels}
                onChange={(event) => setShowLabels(event.target.checked)}
                type="checkbox"
              />
              <span>Visa värden direkt i grafen</span>
            </label>

            <div className="control-actions">
              <button className="button button-secondary" onClick={openGroupEditor}>
                Redigera grupper
              </button>
              <button
                className="button button-ghost"
                onClick={() => setActivePeriod(null)}
                disabled={!activePeriod}
              >
                Visa hela intervallet
              </button>
            </div>
          </div>
        </section>
      </section>

      <section className="metrics-grid">
        <MetricCard
          label="Aktuell volym"
          value={formatDemand(summary.totalCurrentDemand)}
          helper={
            currentData
              ? `${currentData.records.length} datapunkter`
              : "Ladda en CSV-fil för att börja"
          }
        />
        <MetricCard
          label="Historik"
          value={formatDemand(summary.totalHistoryDemand)}
          helper={
            historyData
              ? `${historyData.records.length} datapunkter`
              : "Ingen historik laddad"
          }
        />
        <MetricCard
          label="Toppperiod"
          value={summary.peakPeriod?.label ?? "Ingen"}
          helper={
            summary.peakPeriod
              ? `${formatDemand(summary.peakPeriod.current)} i efterfrågan`
              : "Ingen data för valt urval"
          }
        />
        <MetricCard
          label="Skillnad"
          value={formatDemand(summary.deltaDemand)}
          helper={activePeriod ? `Tabellen visar ${activePeriod}` : "Jämfört mot historiken"}
          accent={summary.deltaDemand >= 0 ? "positive" : "negative"}
        />
      </section>

      <section className="content-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Visualisering</span>
              <h2>Efterfrågan över tid</h2>
            </div>
            {activePeriod ? (
              <button className="button button-ghost" onClick={() => setActivePeriod(null)}>
                Fokuserad period: {activePeriod}
              </button>
            ) : null}
          </div>

          {periodSeries.length > 0 ? (
            <PeriodChart
              activePeriod={activePeriod}
              data={periodSeries}
              onSelectPeriod={setActivePeriod}
              showLabels={showLabels}
            />
          ) : (
            <EmptyState
              title="Ingen data för valda filter"
              description="Ladda minst en CSV-fil eller bredda filtren för att visa grafen."
            />
          )}
        </section>

        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Fördelning</span>
              <h2>Artikelmix</h2>
            </div>
            <span className="table-meta">
              {tableRows.length} artiklar
              {activePeriod ? ` i ${activePeriod}` : ""}
            </span>
          </div>

          {tableRows.length > 0 ? (
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
                      numeric
                    />
                    <SortableHeader
                      active={sortKey === "history"}
                      direction={sortDirection}
                      label="Historik"
                      onClick={() => handleSort("history")}
                      numeric
                    />
                    <SortableHeader
                      active={sortKey === "diff"}
                      direction={sortDirection}
                      label="Differens"
                      onClick={() => handleSort("diff")}
                      numeric
                    />
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.articleId}>
                      <td>{row.articleId}</td>
                      <td>{formatDemand(row.current)}</td>
                      <td>{formatDemand(row.history)}</td>
                      <td className={row.diff >= 0 ? "positive" : "negative"}>
                        {formatDemand(row.diff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Ingen artikelfördelning"
              description="När data finns i urvalet visas den uppdelad artikel för artikel här."
            />
          )}
        </section>
      </section>

      {groupEditorOpen ? (
        <div className="modal-backdrop" onClick={() => setGroupEditorOpen(false)}>
          <div
            className="modal panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">Konfiguration</span>
                <h2>Artikelgrupper</h2>
              </div>
              <button className="button button-ghost" onClick={() => setGroupEditorOpen(false)}>
                Stäng
              </button>
            </div>

            <p className="modal-copy">
              Spara grupper som JSON där nyckeln är gruppnamnet och värdet är en lista
              med artikelnummer.
            </p>

            <textarea
              className="group-editor"
              value={groupDraft}
              onChange={(event) => setGroupDraft(event.target.value)}
              spellCheck={false}
            />

            <div className="control-actions">
              <button className="button button-ghost" onClick={resetGroupEditorDraft}>
                Återställ till standard
              </button>
              <button className="button button-primary" onClick={saveGroupEditorDraft}>
                Spara grupper
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {(offlineReady || needRefresh) && (
        <div className="sw-toast panel">
          {offlineReady ? (
            <div>
              <strong>Offline-läget är klart.</strong>
              <p>Rapvis kan nu öppnas även utan nätverk.</p>
            </div>
          ) : (
            <div>
              <strong>En ny version finns.</strong>
              <p>Uppdatera för att hämta senaste bygget.</p>
            </div>
          )}

          <div className="control-actions">
            {offlineReady ? (
              <button className="button button-ghost" onClick={() => setOfflineReady(false)}>
                Stäng
              </button>
            ) : null}
            {needRefresh ? (
              <>
                <button className="button button-ghost" onClick={() => setNeedRefresh(false)}>
                  Senare
                </button>
                <button
                  className="button button-primary"
                  onClick={() => void updateServiceWorker(true)}
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

function DatasetCard({
  title,
  description,
  dataset,
  busy,
  onUpload,
  onClear,
}: {
  title: string;
  description: string;
  dataset: LoadedDataset | null;
  busy: boolean;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
}) {
  return (
    <section className="panel dataset-card">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Import</span>
          <h2>{title}</h2>
        </div>
        {onClear ? (
          <button className="button button-ghost" onClick={onClear}>
            Rensa
          </button>
        ) : null}
      </div>

      <p className="dataset-copy">{description}</p>

      <label className={`upload-dropzone ${busy ? "busy" : ""}`}>
        <input accept=".csv,text/csv" onChange={onUpload} type="file" />
        <span>{busy ? "Läser fil..." : "Välj CSV-fil"}</span>
      </label>

      {dataset ? (
        <dl className="dataset-meta">
          <div>
            <dt>Fil</dt>
            <dd>{dataset.fileName}</dd>
          </div>
          <div>
            <dt>Importerad</dt>
            <dd>{formatImportedAt(dataset.importedAt)}</dd>
          </div>
          <div>
            <dt>Volym</dt>
            <dd>{formatDemand(dataset.totalDemand)}</dd>
          </div>
        </dl>
      ) : (
        <p className="dataset-empty">Ingen fil laddad ännu.</p>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  accent?: "positive" | "negative";
}) {
  return (
    <section className={`panel metric-card ${accent ?? ""}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-helper">{helper}</span>
    </section>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  numeric,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  numeric?: boolean;
  onClick: () => void;
}) {
  return (
    <th className={numeric ? "numeric" : ""}>
      <button className="sort-button" onClick={onClick} type="button">
        <span>{label}</span>
        <span className={`sort-indicator ${active ? "active" : ""}`}>
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
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
