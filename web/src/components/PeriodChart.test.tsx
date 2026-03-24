import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PeriodChart } from "./PeriodChart";

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
