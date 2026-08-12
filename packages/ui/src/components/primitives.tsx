import type { ReactNode } from 'react';
import type { Tone } from '../tokens';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const TONE_BADGE: Record<Tone, string> = {
  neutral: 'badge',
  primary: 'badge badge-accent',
  success: 'badge badge-success',
  warning: 'badge badge-warning',
  danger: 'badge badge-danger',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={TONE_BADGE[tone]}>{children}</span>;
}

export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={cx('avatar', large && 'avatar-lg')} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

export function Stat({
  label,
  value,
  delta,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  delta?: string | null;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning';
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {delta ? <span className={cx('stat-delta', tone === 'positive' && 'positive', tone === 'negative' && 'negative')}>{delta}</span> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'primary',
  label,
}: {
  value: number;
  max?: number;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  label?: string;
}) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
    >
      <div
        className={cx('progress-fill', tone !== 'primary' && tone)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * The workout completion ring. Animated by CSS transition on stroke-dashoffset,
 * which is automatically neutralised under prefers-reduced-motion.
 */
export function ProgressRing({
  value,
  max = 100,
  size = 132,
  label,
  caption,
}: {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  caption?: string;
}) {
  const percent = Math.max(0, Math.min(1, value / Math.max(max, 1)));
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? 'Progress'}: ${Math.round(percent * 100)}%`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-sunken)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
      <text x="50%" y="47%" textAnchor="middle" className="ring-value">
        {Math.round(percent * 100)}%
      </text>
      {caption ? (
        <text x="50%" y="63%" textAnchor="middle" className="ring-label">
          {caption}
        </text>
      ) : null}
    </svg>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty stack stack-3" style={{ alignItems: 'center' }}>
      <strong style={{ color: 'var(--text)' }}>{title}</strong>
      <p className="small" style={{ maxWidth: '46ch' }}>
        {body}
      </p>
      {action}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  flush = false,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{title}</h3>
        {action}
      </header>
      <div className={flush ? 'panel-body-flush' : 'panel-body'}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  required,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true" style={{ color: 'var(--danger)' }}> *</span> : null}
      </label>
      {children}
      {error ? (
        <span className="error-text" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function SafetyBanner({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'stop';
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('safety-banner', tone === 'info' && 'info', tone === 'warning' && 'warning')} role="status">
      <strong>{title}</strong>
      <p className="small secondary" style={{ marginTop: '0.375rem' }}>
        {children}
      </p>
    </div>
  );
}

/**
 * The outcome of an action the user just took.
 *
 * `role` follows the tone rather than being a prop: a failure has to interrupt a
 * screen reader, a confirmation must not.
 */
export function Notice({ tone, children }: { tone: 'success' | 'danger' | 'warning' | 'info'; children: ReactNode }) {
  return (
    <p className={cx('notice', `notice-${tone}`)} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

export function AiLabel() {
  return (
    <span className="ai-label">
      <span aria-hidden="true">◆</span> AI-assisted
    </span>
  );
}
