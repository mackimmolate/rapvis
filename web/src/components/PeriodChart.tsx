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
import { calculateValueLabelLayout, formatPeriodAxisTick } from "./periodChartLabels";

const LABEL_BOX_HEIGHT = 20;

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
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 28, right: 24, left: 0, bottom: 14 }}
          onClick={(state: { activeLabel?: string | number } | undefined) => {
            if (typeof state?.activeLabel === "string") {
              onSelectPeriod(state.activeLabel);
            }
          }}
        >
          <CartesianGrid stroke="rgba(16, 37, 63, 0.12)" strokeDasharray="4 6" />
          <XAxis
            dataKey="label"
            interval={0}
            tickFormatter={formatPeriodAxisTick}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#41566f", fontSize: 12 }}
          />
          <YAxis
            domain={[0, "auto"]}
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
              stroke="#f0ad4e"
              strokeDasharray="5 5"
              strokeWidth={2}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="current"
            name="Nuvarande"
            stroke="#5b9bd5"
            strokeWidth={3}
            isAnimationActive={false}
            dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
            activeDot={{ r: 6 }}
          >
            {showLabels ? (
              <LabelList
                content={(props) => renderValueLabel(props, "current")}
                dataKey="current"
              />
            ) : null}
          </Line>
          <Line
            type="monotone"
            dataKey="history"
            name="Historik"
            stroke="#70ad47"
            strokeWidth={3}
            strokeDasharray="8 5"
            isAnimationActive={false}
            dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
            activeDot={{ r: 6 }}
          >
            {showLabels ? (
              <LabelList
                content={(props) => renderValueLabel(props, "history")}
                dataKey="history"
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

function renderValueLabel(
  props: unknown,
  variant: "current" | "history",
) {
  const layout = calculateValueLabelLayout(props, variant);
  if (!layout) {
    return <g />;
  }

  const fill = variant === "current" ? "#e7d7b8" : "#e1edd0";
  const stroke = variant === "current" ? "#b69f78" : "#8fad67";
  const textColor = variant === "current" ? "#2f200d" : "#2b4d19";

  return (
    <g>
      <rect
        fill={fill}
        height={LABEL_BOX_HEIGHT}
        opacity={0.96}
        rx={5}
        ry={5}
        stroke={stroke}
        strokeWidth={1}
        width={layout.textWidth}
        x={layout.boxX}
        y={layout.boxY}
      />
      <text
        dominantBaseline="middle"
        fill={textColor}
        fontSize={12}
        textAnchor="middle"
        x={layout.textX}
        y={layout.textY}
      >
        {layout.label}
      </text>
    </g>
  );
}
