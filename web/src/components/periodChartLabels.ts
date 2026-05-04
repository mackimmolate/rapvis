import { formatDemand } from "../lib/demand";

const LABEL_TEXT_PADDING = 14;
const LABEL_BOX_HEIGHT = 20;
const LABEL_EDGE_PADDING = 4;
const LABEL_TOP_OFFSET = 28;
const LABEL_BOTTOM_OFFSET = 10;
const LABEL_COLLISION_THRESHOLD = 42;
const LABEL_COLLISION_HORIZONTAL_GAP = 4;
const LABEL_COLLISION_VERTICAL_NUDGE = 6;

interface ValueLabelPayload {
  current?: unknown;
  history?: unknown;
}

interface ChartBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ValueLabelProps {
  value?: unknown;
  x?: unknown;
  y?: unknown;
  payload?: ValueLabelPayload | null;
  parentViewBox?: unknown;
}

interface ValueLabelLayout {
  label: string;
  boxX: number;
  boxY: number;
  textWidth: number;
  textX: number;
  textY: number;
}

export function calculateValueLabelLayout(
  rawProps: unknown,
  variant: "current" | "history",
): ValueLabelLayout | null {
  const props = readValueLabelProps(rawProps);
  const label = formatChartLabel(props.value);
  if (!label || typeof props.x !== "number" || typeof props.y !== "number") {
    return null;
  }

  const textWidth = label.length * 7 + LABEL_TEXT_PADDING;
  let textX = props.x;
  let boxY =
    variant === "current"
      ? props.y - LABEL_TOP_OFFSET
      : props.y + LABEL_BOTTOM_OFFSET;

  const collisionOffset = getCollisionOffset(props, variant, textWidth);
  if (collisionOffset) {
    textX += collisionOffset.horizontal;
    boxY += collisionOffset.vertical;
  }

  let boxX = textX - textWidth / 2;
  const bounds = getChartBounds(props.parentViewBox);
  if (bounds) {
    const minBoxX = bounds.x + LABEL_EDGE_PADDING;
    const maxBoxX = Math.max(
      minBoxX,
      bounds.x + bounds.width - textWidth - LABEL_EDGE_PADDING,
    );
    const minBoxY = bounds.y + LABEL_EDGE_PADDING;
    const maxBoxY = Math.max(
      minBoxY,
      bounds.y + bounds.height - LABEL_BOX_HEIGHT - LABEL_EDGE_PADDING,
    );

    boxX = clamp(boxX, minBoxX, maxBoxX);
    boxY = clamp(boxY, minBoxY, maxBoxY);
    textX = boxX + textWidth / 2;
  } else {
    boxY = Math.max(LABEL_EDGE_PADDING, boxY);
  }

  return {
    label,
    boxX,
    boxY,
    textWidth,
    textX,
    textY: boxY + LABEL_BOX_HEIGHT / 2,
  };
}

function formatChartLabel(value: unknown) {
  const numericValue = Number(value ?? 0);
  return numericValue > 0 ? formatDemand(numericValue) : "";
}

function getCollisionOffset(
  props: ValueLabelProps,
  variant: "current" | "history",
  ownLabelWidth: number,
) {
  if (typeof props.y !== "number") {
    return null;
  }

  const currentValue = Number(props.payload?.current ?? 0);
  const historyValue = Number(props.payload?.history ?? 0);
  const ownValue = Number(props.value ?? 0);
  if (currentValue <= 0 || historyValue <= 0 || ownValue <= 0) {
    return null;
  }

  const bounds = getChartBounds(props.parentViewBox);
  if (!bounds) {
    return null;
  }

  const pixelsPerUnit = (bounds.y + bounds.height - props.y) / ownValue;
  if (!Number.isFinite(pixelsPerUnit) || pixelsPerUnit <= 0) {
    return null;
  }

  const pointSeparation = pixelsPerUnit * Math.abs(currentValue - historyValue);
  if (pointSeparation >= LABEL_COLLISION_THRESHOLD) {
    return null;
  }

  const otherValue = variant === "current" ? historyValue : currentValue;
  const otherLabelWidth = formatChartLabel(otherValue).length * 7 + LABEL_TEXT_PADDING;
  const horizontalShift =
    Math.ceil((ownLabelWidth + otherLabelWidth) / 4) + LABEL_COLLISION_HORIZONTAL_GAP;

  return {
    horizontal: variant === "current" ? -horizontalShift : horizontalShift,
    vertical:
      variant === "current"
        ? -LABEL_COLLISION_VERTICAL_NUDGE
        : LABEL_COLLISION_VERTICAL_NUDGE,
  };
}

function readValueLabelProps(rawProps: unknown): ValueLabelProps {
  if (!isRecord(rawProps)) {
    return {};
  }

  const payload = isRecord(rawProps.payload)
    ? {
        current: rawProps.payload.current,
        history: rawProps.payload.history,
      }
    : null;

  return {
    value: rawProps.value,
    x: rawProps.x,
    y: rawProps.y,
    payload,
    parentViewBox: rawProps.parentViewBox,
  };
}

function getChartBounds(parentViewBox?: unknown): ChartBounds | null {
  if (
    !isRecord(parentViewBox) ||
    typeof parentViewBox.x !== "number" ||
    typeof parentViewBox.y !== "number" ||
    typeof parentViewBox.width !== "number" ||
    typeof parentViewBox.height !== "number"
  ) {
    return null;
  }

  return {
    x: parentViewBox.x,
    y: parentViewBox.y,
    width: parentViewBox.width,
    height: parentViewBox.height,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
