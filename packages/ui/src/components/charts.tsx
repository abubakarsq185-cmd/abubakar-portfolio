/**
 * Charts.
 *
 * Inline SVG, no charting dependency, no canvas. Every chart carries a text
 * summary for screen readers and a visible axis — a chart nobody can read is
 * decoration, not information.
 */
import { chartSeries } from '../tokens';

export interface Point {
  label: string;
  value: number;
}

function niceBounds(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { min: min - 1, max: max + 1 };
  const padding = (max - min) * 0.12;
  return { min: min - padding, max: max + padding };
}

export function LineChart({
  data,
  height = 200,
  color = chartSeries[0],
  valueSuffix = '',
  ariaLabel,
}: {
  data: Point[];
  height?: number;
  color?: string;
  valueSuffix?: string;
  ariaLabel: string;
}) {
  if (data.length < 2) {
    return (
      <p className="small muted" style={{ padding: '1.5rem 0' }}>
        Not enough data yet — this fills in as you log sessions.
      </p>
    );
  }

  const width = 640;
  const padding = { top: 14, right: 12, bottom: 26, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const { min, max } = niceBounds(data.map((d) => d.value));

  const x = (index: number) => padding.left + (index / (data.length - 1)) * innerW;
  const y = (value: number) => padding.top + innerH - ((value - min) / (max - min)) * innerH;

  const linePath = data.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(data.length - 1).toFixed(1)} ${padding.top + innerH} L ${x(0).toFixed(1)} ${padding.top + innerH} Z`;

  const ticks = [min, (min + max) / 2, max];
  const first = data[0]!;
  const last = data[data.length - 1]!;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label={ariaLabel} preserveAspectRatio="none" style={{ height }}>
        <g className="chart-grid">
          {ticks.map((tick) => (
            <line key={tick} x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} />
          ))}
        </g>
        {ticks.map((tick) => (
          <text key={`label-${tick}`} x={padding.left - 8} y={y(tick) + 4} textAnchor="end" className="chart-axis">
            {Math.round(tick)}
          </text>
        ))}
        <path d={areaPath} fill={color} className="chart-area" />
        <path d={linePath} stroke={color} className="chart-line" />
        <circle cx={x(data.length - 1)} cy={y(last.value)} r={4.5} fill={color} className="chart-point" />
        <text x={padding.left} y={height - 6} className="chart-axis">
          {first.label}
        </text>
        <text x={width - padding.right} y={height - 6} textAnchor="end" className="chart-axis">
          {last.label}
        </text>
      </svg>
      <figcaption className="sr-only">
        {ariaLabel}. From {first.value}
        {valueSuffix} on {first.label} to {last.value}
        {valueSuffix} on {last.label}.
      </figcaption>
    </figure>
  );
}

export function BarChart({
  data,
  height = 190,
  color = chartSeries[1],
  target,
  ariaLabel,
}: {
  data: Point[];
  height?: number;
  color?: string;
  target?: number;
  ariaLabel: string;
}) {
  if (data.length === 0) {
    return (
      <p className="small muted" style={{ padding: '1.5rem 0' }}>
        Nothing logged in this period yet.
      </p>
    );
  }

  const width = 640;
  const padding = { top: 14, right: 12, bottom: 26, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((d) => d.value), target ?? 0, 1);
  const barWidth = Math.max(6, (innerW / data.length) * 0.62);

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label={ariaLabel} style={{ height }}>
        <g className="chart-grid">
          <line x1={padding.left} x2={width - padding.right} y1={padding.top + innerH} y2={padding.top + innerH} />
        </g>
        {target !== undefined ? (
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + innerH - (target / max) * innerH}
            y2={padding.top + innerH - (target / max) * innerH}
            stroke="var(--accent)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
        ) : null}
        {data.map((point, index) => {
          const barHeight = (point.value / max) * innerH;
          const cx = padding.left + (index + 0.5) * (innerW / data.length);
          return (
            <g key={`${point.label}-${index}`}>
              <rect
                x={cx - barWidth / 2}
                y={padding.top + innerH - barHeight}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx={4}
                fill={color}
                className="chart-bar"
              >
                <title>
                  {point.label}: {point.value}
                </title>
              </rect>
              {index % Math.ceil(data.length / 6) === 0 ? (
                <text x={cx} y={height - 6} textAnchor="middle" className="chart-axis">
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {ariaLabel}. Values: {data.map((d) => `${d.label} ${d.value}`).join(', ')}.
      </figcaption>
    </figure>
  );
}

export function Sparkline({ data, color = chartSeries[0], width = 120, height = 34 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const { min, max } = niceBounds(data);
  const path = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / (max - min)) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} stroke={color} className="chart-line" strokeWidth={2} fill="none" />
    </svg>
  );
}
