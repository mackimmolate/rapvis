import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import App from "./App";

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    offlineReady: [false, vi.fn()],
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

vi.mock("./components/PeriodChart", () => ({
  PeriodChart: ({
    activePeriod,
    data,
    onSelectPeriod,
  }: {
    activePeriod: string | null;
    data: Array<{ label: string }>;
    onSelectPeriod: (period: string | null) => void;
  }) => (
    <div data-testid="period-chart">
      <div>Aktiv period: {activePeriod ?? "ingen"}</div>
      {data.map((point) => (
        <button key={point.label} onClick={() => onSelectPeriod(point.label)} type="button">
          {point.label}
        </button>
      ))}
    </div>
  ),
}));

function createCsvFile(name: string, rows: string[]) {
  return new File([rows.join("\n")], name, { type: "text/csv" });
}

async function uploadDatasets() {
  const currentFile = createCsvFile("current.csv", [
    "Article number buyer,2026-03-09 - 2026-03-15,2026-03-16 - 2026-03-22",
    "8Y 185 3189 D,10,5",
    "5H0 867 439 B,3,7",
    "9X 000 000 001,4,0",
  ]);
  const historyFile = createCsvFile("history.csv", [
    "Article number buyer,2026-03-09 - 2026-03-15,2026-03-16 - 2026-03-22",
    "8Y 185 3189 D,8,6",
    "5H0 867 439 B,1,2",
    "9X 000 000 001,2,0",
  ]);

  const currentInput = screen.getByLabelText("Ladda förfrågan CSV");
  const historyInput = screen.getByLabelText("Ladda historik CSV");

  await userEvent.upload(currentInput, currentFile);
  await userEvent.upload(historyInput, historyFile);

  await screen.findByText("Förfrågan: current.csv | Historik: history.csv");
}

describe("App", () => {
  it("starts a fresh session with Alla even if a category was saved previously", () => {
    window.localStorage.setItem(
      "rapvis.preferences.v1",
      JSON.stringify({
        timeScale: "weeks",
        showLabels: true,
        articleFilter: "VW 380R",
        articleGroups: {
          "Audi AU38": ["8Y1853189D"],
          "VW 380R": ["5H0867439B"],
        },
      }),
    );

    render(<App />);

    const articleSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(articleSelect.value).toBe("Alla");
  });

  it("loads datasets and updates the active period from the chart", async () => {
    render(<App />);

    await uploadDatasets();

    const chart = screen.getByTestId("period-chart");
    const periodButtons = within(chart).getAllByRole("button");
    const firstPeriod = periodButtons[0].textContent ?? "";

    expect(firstPeriod).toMatch(/^2026-W\d{2}$/);

    await userEvent.click(periodButtons[0]);

    await screen.findByText(`Tabellen visar vald period: ${firstPeriod}`);
    expect(screen.getByText(`Aktiv period: ${firstPeriod}`)).toBeTruthy();
  });

  it("filters to ctrl-selected rows and resets with Visa alla", async () => {
    render(<App />);

    await uploadDatasets();

    const firstArticleCell = await screen.findByText("8Y 185 3189 D");
    const secondArticleCell = await screen.findByText("5H0 867 439 B");
    const thirdArticleCell = await screen.findByText("9X 000 000 001");

    const firstRow = firstArticleCell.closest("tr");
    const secondRow = secondArticleCell.closest("tr");
    const thirdRow = thirdArticleCell.closest("tr");

    expect(firstRow).toBeTruthy();
    expect(secondRow).toBeTruthy();
    expect(thirdRow).toBeTruthy();

    fireEvent.click(firstRow!);
    fireEvent.click(secondRow!, { ctrlKey: true });
    fireEvent.contextMenu(secondRow!, { clientX: 100, clientY: 100 });

    await userEvent.click(screen.getByRole("button", { name: "Visa endast valda" }));

    await screen.findByText("Visar endast 2 valda artiklar.");
    await waitFor(() => {
      expect(screen.queryByText("9X 000 000 001")).toBeNull();
    });

    await userEvent.click(screen.getByRole("button", { name: "Visa alla" }));

    await screen.findByText("Förfrågan: current.csv | Historik: history.csv");
    expect(await screen.findByText("9X 000 000 001")).toBeTruthy();
  });

  it("keeps the selected category when Visa alla resets an active period", async () => {
    render(<App />);

    await uploadDatasets();

    const articleSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    await userEvent.selectOptions(articleSelect, "Audi AU38");

    expect(await screen.findByText("8Y 185 3189 D")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("5H0 867 439 B")).toBeNull();
      expect(screen.queryByText("9X 000 000 001")).toBeNull();
    });

    const periodButtons = within(screen.getByTestId("period-chart")).getAllByRole("button");
    await userEvent.click(periodButtons[0]);

    await screen.findByText(/Tabellen visar vald period: 2026-W\d{2}/);

    await userEvent.click(screen.getByRole("button", { name: "Visa alla" }));

    await screen.findByText(/current\.csv \| Historik: history\.csv/);
    expect(articleSelect.value).toBe("Audi AU38");
    expect(await screen.findByText("8Y 185 3189 D")).toBeTruthy();
    expect(screen.queryByText("5H0 867 439 B")).toBeNull();
    expect(screen.queryByText("9X 000 000 001")).toBeNull();
  });
});
