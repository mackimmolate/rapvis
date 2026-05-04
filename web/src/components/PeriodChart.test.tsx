import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PeriodChart, formatPeriodAxisTick } from "./PeriodChart";
import { calculateValueLabelLayout } from "./periodChartLabels";

vi.mock("recharts", async () => {
  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Line: ({
      children,
      dataKey,
      isAnimationActive,
    }: {
      children?: ReactNode;
      dataKey: string;
      isAnimationActive?: boolean;
    }) => (
      <div
        data-animation-active={String(isAnimationActive)}
        data-testid={`line-${dataKey}`}
      >
        {children}
      </div>
    ),
    LabelList: ({ dataKey }: { dataKey: string }) => (
      <div data-testid={`label-list-${dataKey}`} />
    ),
  };
});

describe("PeriodChart", () => {
  it("formats weekly X-axis labels without the year", () => {
    expect(formatPeriodAxisTick("2026-W20")).toBe("W20");
    expect(formatPeriodAxisTick("2026-05")).toBe("2026-05");
    expect(formatPeriodAxisTick("2026")).toBe("2026");
  });

  it("splits close value bubbles apart when the two series nearly overlap", () => {
    const parentViewBox = { x: 0, y: 0, width: 240, height: 240 };

    const currentLayout = calculateValueLabelLayout(
      {
        value: 381,
        x: 100,
        y: 87.6,
        payload: { current: 381, history: 414 },
        parentViewBox,
      },
      "current",
    );
    const historyLayout = calculateValueLabelLayout(
      {
        value: 414,
        x: 100,
        y: 74.4,
        payload: { current: 381, history: 414 },
        parentViewBox,
      },
      "history",
    );

    expect(currentLayout?.textX).toBeLessThan(100);
    expect(historyLayout?.textX).toBeGreaterThan(100);
    expect(currentLayout?.boxY).toBeLessThan(87.6 - 28);
    expect(historyLayout?.boxY).toBeGreaterThan(74.4 + 10);
  });

  it("keeps bubble positions centered when the values are already far apart", () => {
    const parentViewBox = { x: 0, y: 0, width: 240, height: 240 };

    const currentLayout = calculateValueLabelLayout(
      {
        value: 100,
        x: 100,
        y: 200,
        payload: { current: 100, history: 400 },
        parentViewBox,
      },
      "current",
    );
    const historyLayout = calculateValueLabelLayout(
      {
        value: 400,
        x: 100,
        y: 80,
        payload: { current: 100, history: 400 },
        parentViewBox,
      },
      "history",
    );

    expect(currentLayout?.textX).toBe(100);
    expect(historyLayout?.textX).toBe(100);
    expect(currentLayout?.boxY).toBe(200 - 28);
    expect(historyLayout?.boxY).toBe(80 + 10);
  });

  it("keeps line animations disabled so value bubbles stay visible on selection", () => {
    render(
      <PeriodChart
        activePeriod="2026-W11"
        data={[{ label: "2026-W11", current: 10, history: 8 }]}
        onSelectPeriod={() => {}}
        showLabels
      />,
    );

    expect(screen.getByTestId("line-current").getAttribute("data-animation-active")).toBe(
      "false",
    );
    expect(screen.getByTestId("line-history").getAttribute("data-animation-active")).toBe(
      "false",
    );
    expect(screen.getByTestId("label-list-current")).toBeTruthy();
    expect(screen.getByTestId("label-list-history")).toBeTruthy();
  });
});
