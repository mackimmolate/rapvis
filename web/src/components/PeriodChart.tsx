import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";

import { formatDemand } from "../lib/demand";
import type { PeriodPoint } from "../types";

interface PeriodChartProps {
  data: PeriodPoint[];
  activePeriod: string | null;
  showLabels: boolean;
  onSelectPeriod: (period: string | null) => void;
}

export function PeriodChart({
  data,
  activePeriod,
  showLabels,
  onSelectPeriod,
}: PeriodChartProps) {
  return (
    <div className="chart-shell">
      <ResponsiveContainer width="100%" height={360}>
        <LineChart
          data={data}
          margin={{ top: 18, right: 24, left: 0, bottom: 12 }}
          onClick={(state: { activeLabel?: string | number } | undefined) => {
            if (typeof state?.activeLabel === "string") {
              onSelectPeriod(state.activeLabel);
            }
          }}
        >
          <CartesianGrid stroke="rgba(16, 37, 63, 0.12)" strokeDasharray="4 6" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#41566f", fontSize: 12 }}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={formatDemand}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#41566f", fontSize: 12 }}
            width={72}
          />
          <Tooltip content={ChartTooltip} />
          <Legend verticalAlign="top" align="right" iconType="plainline" />
          {activePeriod ? (
            <ReferenceLine
              x={activePeriod}
              stroke="#c96e3c"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="current"
            name="Nuvarande"
            stroke="#10253f"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: "#f3efe6" }}
            activeDot={{ r: 6 }}
          >
            {showLabels ? (
              <LabelList
                dataKey="current"
                position="top"
                formatter={formatChartLabel}
                fill="#10253f"
                fontSize={12}
              />
            ) : null}
          </Line>
          <Line
            type="monotone"
            dataKey="history"
            name="Historik"
            stroke="#5f7f59"
            strokeWidth={3}
            strokeDasharray="8 5"
            dot={{ r: 4, strokeWidth: 2, fill: "#f3efe6" }}
            activeDot={{ r: 6 }}
          >
            {showLabels ? (
              <LabelList
                dataKey="history"
                position="bottom"
                formatter={formatChartLabel}
                fill="#5f7f59"
                fontSize={12}
              />
            ) : null}
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  label,
  payload,
}: TooltipContentProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const current =
    payload.find(
      (entry: { dataKey?: string; value?: number | string }) =>
        entry.dataKey === "current",
    )?.value ?? 0;
  const history =
    payload.find(
      (entry: { dataKey?: string; value?: number | string }) =>
        entry.dataKey === "history",
    )?.value ?? 0;

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <span>Nuvarande: {formatDemand(Number(current))}</span>
      <span>Historik: {formatDemand(Number(history))}</span>
      <span>Skillnad: {formatDemand(Number(current) - Number(history))}</span>
    </div>
  );
}

function formatChartLabel(value: unknown) {
  const numericValue = Number(value ?? 0);
  return numericValue > 0 ? formatDemand(numericValue) : "";
}
