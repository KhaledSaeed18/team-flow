import { type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Hand-written SVG charts for the sprint report. One y-axis per chart, recessive grid, 2px lines with ≥8px
 * markers, a hover layer on every chart, and a legend whenever there are two series. Series colors come from the
 * validated `--color-chart-*` tokens; text always uses ink tokens.
 */

const MARGIN = { top: 12, right: 64, bottom: 28, left: 36 };
const HEIGHT = 220;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Round the axis maximum up to a tidy number and return ~4 ticks. */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const step = 10 ** Math.floor(Math.log10(max));
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => max / s <= 4) ?? step * 10;
  const top = Math.ceil(max / nice) * nice;
  return Array.from({ length: top / nice + 1 }, (_, i) => i * nice);
}

export function Legend({ items }: { items: { label: string; swatch: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-ink-muted text-xs">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.swatch}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export const LineSwatch = ({ dashed = false, color }: { dashed?: boolean; color: string }) => (
  <svg width="16" height="8" aria-hidden>
    <line
      x1="0"
      y1="4"
      x2="16"
      y2="4"
      stroke={color}
      strokeWidth="2"
      strokeDasharray={dashed ? '4 3' : undefined}
    />
  </svg>
);

export const BlockSwatch = ({ color }: { color: string }) => (
  <span
    aria-hidden
    className="inline-block size-2.5 rounded-[2px]"
    style={{ backgroundColor: color }}
  />
);

function Tooltip({
  x,
  y,
  width,
  children,
}: {
  x: number;
  y: number;
  width: number;
  children: ReactNode;
}) {
  const left = Math.min(Math.max(x - 70, 0), width - 150);
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 w-[150px] rounded-control border border-line bg-surface px-2.5 py-2 text-xs shadow-lifted"
      style={{ left, top: Math.max(0, y - 72) }}
    >
      {children}
    </div>
  );
}

export interface BurndownDatum {
  label: string;
  remaining: number;
  ideal: number;
}

export function BurndownChart({ data, title }: { data: BurndownDatum[]; title: string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const innerW = Math.max(100, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const axis = ticks(Math.max(1, ...data.map((d) => Math.max(d.remaining, d.ideal))));
  const max = axis.at(-1) ?? 1;
  const x = (i: number) =>
    MARGIN.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => MARGIN.top + innerH - (v / max) * innerH;
  const path = (key: 'remaining' | 'ideal') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d[key])}`).join('');
  const last = data.at(-1);
  const hovered = hover === null ? null : data[hover];

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={title}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = event.clientX - box.left - MARGIN.left;
          const i = Math.round((px / innerW) * Math.max(1, data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
      >
        {axis.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + innerW}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-line"
              strokeWidth="1"
            />
            <text
              x={MARGIN.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="fill-ink-faint text-[10px]"
            >
              {tick}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 8) === 0 || i === data.length - 1 ? (
            <text
              key={d.label}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-ink-faint text-[10px]"
            >
              {d.label}
            </text>
          ) : null,
        )}
        <path
          d={path('ideal')}
          fill="none"
          stroke="var(--color-ink-faint)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <path
          d={path('remaining')}
          fill="none"
          stroke="var(--color-chart-1)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {data.map((d, i) => (
          <circle
            key={d.label}
            cx={x(i)}
            cy={y(d.remaining)}
            r={hover === i ? 5 : 4}
            fill="var(--color-chart-1)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
        ))}
        {last && (
          <text
            x={x(data.length - 1) + 10}
            y={y(last.remaining)}
            dy="0.32em"
            className="fill-ink-muted text-[11px]"
          >
            {last.remaining} left
          </text>
        )}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={MARGIN.top}
            y2={MARGIN.top + innerH}
            className="stroke-ink-faint"
            strokeWidth="1"
          />
        )}
      </svg>
      {hovered && hover !== null && (
        <Tooltip x={x(hover)} y={y(hovered.remaining)} width={width}>
          <p className="font-medium text-ink">{hovered.label}</p>
          <p className="mt-1 flex justify-between text-ink-muted">
            Remaining <span className="text-ink">{hovered.remaining}</span>
          </p>
          <p className="flex justify-between text-ink-muted">
            Ideal <span className="text-ink">{hovered.ideal}</span>
          </p>
        </Tooltip>
      )}
    </div>
  );
}

export interface VelocityDatum {
  label: string;
  committed: number;
  completed: number;
}

export function VelocityChart({ data, title }: { data: VelocityDatum[]; title: string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const innerW = Math.max(100, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const axis = ticks(Math.max(1, ...data.map((d) => Math.max(d.committed, d.completed))));
  const max = axis.at(-1) ?? 1;
  const y = (v: number) => MARGIN.top + innerH - (v / max) * innerH;
  const group = innerW / Math.max(1, data.length);
  const bar = Math.min(28, (group - 16) / 2);
  const gap = 2;

  /** A bar with a 4px rounded data end and a square baseline. */
  const barPath = (x0: number, value: number) => {
    const top = y(value);
    const bottom = y(0);
    const r = Math.min(4, (bottom - top) / 2, bar / 2);
    return `M${x0},${bottom}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bar - r}Q${x0 + bar},${top} ${x0 + bar},${top + r}V${bottom}Z`;
  };
  const hovered = hover === null ? null : data[hover];

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={title}
        onPointerLeave={() => setHover(null)}
      >
        {axis.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + innerW}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-line"
              strokeWidth="1"
            />
            <text
              x={MARGIN.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="fill-ink-faint text-[10px]"
            >
              {tick}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const center = MARGIN.left + group * i + group / 2;
          return (
            <g key={d.label} onPointerEnter={() => setHover(i)}>
              {/* An invisible hit target larger than the bars. */}
              <rect
                x={center - group / 2}
                y={MARGIN.top}
                width={group}
                height={innerH}
                fill="transparent"
              />
              <path
                d={barPath(center - bar - gap / 2, d.committed)}
                fill="var(--color-chart-1)"
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
              <path
                d={barPath(center + gap / 2, d.completed)}
                fill="var(--color-chart-2)"
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
              <text
                x={center}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-ink-faint text-[10px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hovered && hover !== null && (
        <Tooltip
          x={MARGIN.left + group * hover + group / 2}
          y={y(Math.max(hovered.committed, hovered.completed))}
          width={width}
        >
          <p className="font-medium text-ink">{hovered.label}</p>
          <p className="mt-1 flex justify-between text-ink-muted">
            Committed <span className="text-ink">{hovered.committed}</span>
          </p>
          <p className="flex justify-between text-ink-muted">
            Completed <span className="text-ink">{hovered.completed}</span>
          </p>
        </Tooltip>
      )}
    </div>
  );
}

export interface FlowDatum {
  label: string;
  todo: number;
  inProgress: number;
  done: number;
}

/** Bottom to top: finished work at the base, so a widening middle band reads as work piling up. */
const BANDS = [
  { key: 'done', label: 'Done', color: 'var(--color-chart-2)' },
  { key: 'inProgress', label: 'In progress', color: 'var(--color-chart-1)' },
  { key: 'todo', label: 'To do', color: 'var(--color-chart-3)' },
] as const;
export const FLOW_BANDS = BANDS;

export function CumulativeFlowChart({ data, title }: { data: FlowDatum[]; title: string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  // Room on the right for the band names; In progress is the longest.
  const right = 88;
  const innerW = Math.max(100, width - MARGIN.left - right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const total = (d: FlowDatum) => d.todo + d.inProgress + d.done;
  const axis = ticks(Math.max(1, ...data.map(total)));
  const max = axis.at(-1) ?? 1;
  const x = (i: number) =>
    MARGIN.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => MARGIN.top + innerH - (v / max) * innerH;

  // Cumulative tops per band: done, done + in progress, everything.
  const top = (d: FlowDatum, band: number) =>
    BANDS.slice(0, band + 1).reduce((sum, b) => sum + d[b.key], 0);
  const area = (band: number) => {
    const upper = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(top(d, band))}`).join('');
    const lower = data
      .map((d, i) => ({ i, v: band === 0 ? 0 : top(d, band - 1) }))
      .reverse()
      .map(({ i, v }) => `L${x(i)},${y(v)}`)
      .join('');
    return `${upper}${lower}Z`;
  };
  const last = data.at(-1);
  const hovered = hover === null ? null : data[hover];

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={title}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = event.clientX - box.left - MARGIN.left;
          const i = Math.round((px / innerW) * Math.max(1, data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
      >
        {axis.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + innerW}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-line"
              strokeWidth="1"
            />
            <text
              x={MARGIN.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="fill-ink-faint text-[10px]"
            >
              {tick}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 8) === 0 || i === data.length - 1 ? (
            <text
              key={d.label}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-ink-faint text-[10px]"
            >
              {d.label}
            </text>
          ) : null,
        )}
        {BANDS.map((band, b) => (
          <path
            key={band.key}
            d={area(b)}
            fill={band.color}
            fillOpacity="0.85"
            // A 2px surface seam keeps neighbouring bands apart.
            stroke="var(--color-surface)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
        {last &&
          BANDS.map((band, b) =>
            last[band.key] > 0 ? (
              <text
                key={band.key}
                x={x(data.length - 1) + 8}
                y={y(top(last, b) - last[band.key] / 2)}
                dy="0.32em"
                className="fill-ink-muted text-[11px]"
              >
                {band.label}
              </text>
            ) : null,
          )}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={MARGIN.top}
            y2={MARGIN.top + innerH}
            className="stroke-ink"
            strokeWidth="1"
          />
        )}
      </svg>
      {hovered && hover !== null && (
        <Tooltip x={x(hover)} y={y(total(hovered))} width={width}>
          <p className="font-medium text-ink">{hovered.label}</p>
          {[...BANDS].reverse().map((band) => (
            <p key={band.key} className="mt-1 flex items-center justify-between text-ink-muted">
              <span className="flex items-center gap-1.5">
                <BlockSwatch color={band.color} />
                {band.label}
              </span>
              <span className="text-ink">{hovered[band.key]}</span>
            </p>
          ))}
        </Tooltip>
      )}
    </div>
  );
}
