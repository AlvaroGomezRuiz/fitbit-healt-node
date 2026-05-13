import * as React from "react";

interface MiniSparklineProps {
  readonly values: readonly (number | null)[];
  readonly ariaLabel: string;
}

/**
 * Sparkline mínima para tendencias en el panel de telemetría (sin datos externos).
 */
export function MiniSparkline(props: MiniSparklineProps): React.ReactElement {
  const { values, ariaLabel } = props;
  const nums = values.filter((x): x is number => x !== null && !Number.isNaN(x));
  const w = 120;
  const h = 32;
  if (nums.length === 0) {
    return (
      <div
        className="h-8 w-full max-w-[120px] rounded bg-muted/50"
        role="img"
        aria-label={ariaLabel}
      />
    );
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min === 0 ? 1 : max - min;
  const denom = Math.max(1, values.length - 1);
  const pts: string[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v === null || v === undefined || Number.isNaN(v)) {
      continue;
    }
    const x = (i / denom) * w;
    const y = h - ((v - min) / span) * h;
    pts.push(`${String(x)},${String(y)}`);
  }
  if (pts.length === 0) {
    return (
      <div
        className="h-8 w-full max-w-[120px] rounded bg-muted/50"
        role="img"
        aria-label={ariaLabel}
      />
    );
  }
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${String(w)} ${String(h)}`}
      className="max-w-full text-primary"
      role="img"
      aria-label={ariaLabel}
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts.join(" ")} />
    </svg>
  );
}
