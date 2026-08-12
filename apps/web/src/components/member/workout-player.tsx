'use client';
/**
 * The guided workout player.
 *
 * Designed for one hand, on a phone, on a gym floor with poor signal:
 *   • the whole payload is cached in localStorage the moment it loads,
 *   • every logged set is written to that cache immediately,
 *   • the session syncs when the device is online, and queues when it is not,
 *   • a queued session replays with the same clientSessionId, so a duplicate
 *     sync updates the same row instead of creating a second workout.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkoutPlayerPayload, WorkoutPlayerItem, SetLogInput } from '@gymguide/types';

interface LoggedSet extends SetLogInput {
  blockId: string;
}

interface CachedSession {
  payload: WorkoutPlayerPayload;
  sets: LoggedSet[];
  startedAt: string;
  updatedAt: string;
}

const CACHE_PREFIX = 'gymguide:session:';
const QUEUE_KEY = 'gymguide:sync-queue';

function readCache(clientSessionId: string): CachedSession | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + clientSessionId);
    return raw ? (JSON.parse(raw) as CachedSession) : null;
  } catch {
    return null;
  }
}

function writeCache(session: CachedSession): void {
  try {
    localStorage.setItem(CACHE_PREFIX + session.payload.clientSessionId, JSON.stringify(session));
  } catch {
    /* Storage full or blocked — the session still works in memory. */
  }
}

function enqueue(body: unknown): void {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as unknown[];
    queue.push(body);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* ignore */
  }
}

export function WorkoutPlayer({ payload }: { payload: WorkoutPlayerPayload }) {
  const router = useRouter();
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [online, setOnline] = useState(true);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'queued' | 'error'>('idle');
  const [summary, setSummary] = useState<null | { volumeKg: number; sets: number; records: string[] }>(null);
  const [painOpen, setPainOpen] = useState(false);
  const startedAt = useRef(new Date().toISOString());

  const items = useMemo(
    () => payload.blocks.flatMap((block) => block.items.map((item) => ({ block, item }))),
    [payload],
  );
  const current = items[activeIndex];

  // Restore anything logged before a refresh or a lost connection.
  useEffect(() => {
    const cached = readCache(payload.clientSessionId);
    if (cached) {
      setSets(cached.sets);
      startedAt.current = cached.startedAt;
    }
    writeCache({
      payload,
      sets: cached?.sets ?? [],
      startedAt: cached?.startedAt ?? startedAt.current,
      updatedAt: new Date().toISOString(),
    });
  }, [payload]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (restSeconds === null) return;
    if (restSeconds <= 0) {
      setRestSeconds(null);
      return;
    }
    const timer = setTimeout(() => setRestSeconds((value) => (value === null ? null : value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [restSeconds]);

  const logSet = useCallback(
    (item: WorkoutPlayerItem, blockId: string, setNumber: number, values: { reps: number | null; weight: number | null; rpe: number | null }) => {
      const entry: LoggedSet = {
        blockId,
        clientSetId: `${payload.clientSessionId}:${item.workoutItemId}:${setNumber}`,
        workoutItemId: item.workoutItemId,
        exerciseId: item.exercise.id,
        setNumber,
        repsCompleted: values.reps,
        weightKg: values.weight,
        rpe: values.rpe,
        isWarmup: blockId === 'warmup',
        skipped: false,
        loggedAt: new Date().toISOString(),
      };

      setSets((previous) => {
        const next = [...previous.filter((s) => s.clientSetId !== entry.clientSetId), entry];
        writeCache({ payload, sets: next, startedAt: startedAt.current, updatedAt: new Date().toISOString() });
        return next;
      });
      setRestSeconds(item.restSeconds);
    },
    [payload],
  );

  const finish = useCallback(async () => {
    setSyncState('saving');
    const body = {
      clientSessionId: payload.clientSessionId,
      programAssignmentId: payload.programAssignmentId,
      programDayId: payload.programDayId,
      workoutId: payload.workoutId,
      title: payload.title,
      scheduledFor: payload.scheduledFor,
      startedAt: startedAt.current,
      completedAt: new Date().toISOString(),
      state: 'completed' as const,
      durationSeconds: Math.round((Date.now() - new Date(startedAt.current).getTime()) / 1000),
      sets: sets.map(({ blockId: _blockId, ...set }) => set),
      clientRecordedAt: new Date().toISOString(),
    };

    if (!navigator.onLine) {
      enqueue(body);
      setSyncState('queued');
      setSummary({
        volumeKg: sets.reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.repsCompleted ?? 0), 0),
        sets: sets.length,
        records: [],
      });
      return;
    }

    try {
      const response = await fetch('/api/v1/workouts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(String(response.status));
      const result = (await response.json()) as {
        data?: { totals?: { volumeKg: number; completedSets: number }; personalRecords?: Array<{ exerciseName: string; kind: string }> };
      };
      setSyncState('saved');
      setSummary({
        volumeKg: result.data?.totals?.volumeKg ?? 0,
        sets: result.data?.totals?.completedSets ?? sets.length,
        records: (result.data?.personalRecords ?? []).map((record) => `${record.exerciseName} — ${record.kind.replace(/_/g, ' ')}`),
      });
      localStorage.removeItem(CACHE_PREFIX + payload.clientSessionId);
      router.refresh();
    } catch {
      enqueue(body);
      setSyncState('queued');
      setSummary({
        volumeKg: sets.reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.repsCompleted ?? 0), 0),
        sets: sets.length,
        records: [],
      });
    }
  }, [payload, router, sets]);

  const completedSets = sets.length;
  const totalSets = items.reduce((sum, entry) => sum + entry.item.targetSets, 0);
  const progress = totalSets === 0 ? 0 : Math.round((completedSets / totalSets) * 100);

  if (summary) {
    return (
      <SessionSummary
        title={payload.title}
        volumeKg={summary.volumeKg}
        sets={summary.sets}
        records={summary.records}
        queued={syncState === 'queued'}
      />
    );
  }

  if (!current) {
    return <p className="secondary">This workout has no exercises yet. Please tell a coach.</p>;
  }

  return (
    <div className="stack stack-4">
      <header className="player-header stack stack-3">
        <div className="row-between">
          <div className="stack" style={{ gap: 0 }}>
            <span className="micro muted">
              {current.block.label.toUpperCase()} · {activeIndex + 1} of {items.length}
            </span>
            <strong>{payload.title}</strong>
          </div>
          <span className="badge badge-accent numeric">{progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {!online ? (
        <p className="offline-banner" role="status">
          <span aria-hidden="true">◍</span> You are offline. Your workout is saved on this device and will sync
          automatically.
        </p>
      ) : null}

      {payload.safety.banner ? (
        <div className="safety-banner info" role="status">
          <strong>Automatic progression is paused</strong>
          <p className="small secondary" style={{ marginTop: '0.375rem' }}>
            {payload.safety.banner}
          </p>
        </div>
      ) : null}

      {restSeconds !== null ? (
        <div className="rest-timer">
          <span className="rest-time numeric">
            {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')}
          </span>
          <span className="micro muted">REST</span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setRestSeconds(null)}>
            Skip rest
          </button>
        </div>
      ) : null}

      <ExerciseCard
        entry={current}
        logged={sets.filter((set) => set.workoutItemId === current.item.workoutItemId)}
        onLogSet={(setNumber, values) => logSet(current.item, current.block.kind, setNumber, values)}
      />

      <div className="row" style={{ gap: '0.625rem' }}>
        <button
          className="btn btn-secondary grow"
          type="button"
          onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
          disabled={activeIndex === 0}
        >
          Back
        </button>
        {activeIndex < items.length - 1 ? (
          <button className="btn btn-primary grow" type="button" onClick={() => setActiveIndex((index) => index + 1)}>
            Next exercise
          </button>
        ) : (
          <button className="btn btn-success grow" type="button" onClick={finish} disabled={syncState === 'saving'}>
            {syncState === 'saving' ? 'Saving…' : 'Finish workout'}
          </button>
        )}
      </div>

      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPainOpen((open) => !open)}>
        Something hurts
      </button>

      {painOpen ? <PainReport sessionId={payload.sessionId} exerciseId={current.item.exercise.id} /> : null}
    </div>
  );
}

function ExerciseCard({
  entry,
  logged,
  onLogSet,
}: {
  entry: { block: { label: string; kind: string; instructions: string | null }; item: WorkoutPlayerItem };
  logged: LoggedSet[];
  onLogSet: (setNumber: number, values: { reps: number | null; weight: number | null; rpe: number | null }) => void;
}) {
  const { item } = entry;
  const [showHowTo, setShowHowTo] = useState(false);
  const targetLabel = item.targetSeconds
    ? `${item.targetSets} × ${item.targetSeconds}s`
    : `${item.targetSets} × ${item.targetRepsMin ?? '?'}${item.targetRepsMax && item.targetRepsMax !== item.targetRepsMin ? `–${item.targetRepsMax}` : ''}`;

  return (
    <article className="card stack stack-4">
      <div className="stack stack-2">
        <div className="row-between">
          <h2 style={{ fontSize: '1.25rem' }}>{item.exercise.name}</h2>
          <span className="badge">{targetLabel}</span>
        </div>
        <p className="micro muted">
          {item.exercise.primaryMuscles.join(' · ')}
          {item.suggestedLoadKg ? ` · suggested ${item.suggestedLoadKg} kg` : ''}
        </p>
        {item.memberNote ? <p className="small secondary">{item.memberNote}</p> : null}
      </div>

      {item.previous?.lastPerformedOn ? (
        <p className="micro muted">
          Last time: {item.previous.bestWeightKg ? `${item.previous.bestWeightKg} kg × ` : ''}
          {item.previous.bestReps ?? '—'} reps
        </p>
      ) : null}

      <div className="stack stack-2">
        {Array.from({ length: item.targetSets }, (_, index) => index + 1).map((setNumber) => (
          <SetRow
            key={setNumber}
            setNumber={setNumber}
            suggestedLoad={item.suggestedLoadKg}
            targetReps={item.targetRepsMax ?? item.targetRepsMin}
            done={logged.some((set) => set.setNumber === setNumber)}
            onLog={(values) => onLogSet(setNumber, values)}
          />
        ))}
      </div>

      <div className="row row-wrap">
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowHowTo((value) => !value)}>
          {showHowTo ? 'Hide' : 'How to do it'}
        </button>
        {item.substitutions.length > 0 ? (
          <details>
            <summary className="btn btn-ghost btn-sm">Swap exercise ({item.substitutions.length})</summary>
            <ul className="stack stack-2" style={{ listStyle: 'none', padding: '0.75rem 0 0' }}>
              {item.substitutions.map((substitution) => (
                <li key={substitution.exerciseId} className="small">
                  <strong>{substitution.name}</strong>{' '}
                  <span className="muted">— approved for {substitution.reason.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {showHowTo ? (
        <div className="stack stack-3 card-sunken card card-flat">
          {item.exercise.primaryMediaUrl ? (
            <p className="micro muted">Technique video loads from your gym’s library.</p>
          ) : null}
          <div className="stack stack-2">
            <strong className="small">Setup</strong>
            <p className="small secondary">{item.exercise.setupInstructions}</p>
          </div>
          <div className="stack stack-2">
            <strong className="small">Steps</strong>
            <ol className="small secondary" style={{ paddingLeft: '1.125rem' }}>
              {item.exercise.executionSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          {item.exercise.formCues.length > 0 ? (
            <div className="stack stack-2">
              <strong className="small">Form cues</strong>
              <p className="small secondary">{item.exercise.formCues.join(' · ')}</p>
            </div>
          ) : null}
          {item.exercise.commonMistakes.length > 0 ? (
            <div className="stack stack-2">
              <strong className="small">Common mistakes</strong>
              <p className="small secondary">{item.exercise.commonMistakes.join(' · ')}</p>
            </div>
          ) : null}
          {item.exercise.safetyNotes.length > 0 ? (
            <div className="safety-banner info">
              <strong>Safety</strong>
              <p className="small secondary" style={{ marginTop: '0.375rem' }}>
                {item.exercise.safetyNotes.join(' ')}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function SetRow({
  setNumber,
  suggestedLoad,
  targetReps,
  done,
  onLog,
}: {
  setNumber: number;
  suggestedLoad: number | null;
  targetReps: number | null;
  done: boolean;
  onLog: (values: { reps: number | null; weight: number | null; rpe: number | null }) => void;
}) {
  const [weight, setWeight] = useState(suggestedLoad ? String(suggestedLoad) : '');
  const [reps, setReps] = useState(targetReps ? String(targetReps) : '');

  return (
    <div className={done ? 'set-row done' : 'set-row'}>
      <span className="set-index">{setNumber}</span>
      <input
        className="input set-input"
        inputMode="decimal"
        aria-label={`Set ${setNumber} weight in kilograms`}
        value={weight}
        onChange={(event) => setWeight(event.target.value)}
        placeholder="kg"
      />
      <input
        className="input set-input"
        inputMode="numeric"
        aria-label={`Set ${setNumber} repetitions`}
        value={reps}
        onChange={(event) => setReps(event.target.value)}
        placeholder="reps"
      />
      <button
        className={done ? 'btn btn-success btn-sm' : 'btn btn-primary btn-sm'}
        type="button"
        onClick={() =>
          onLog({
            reps: reps ? Number(reps) : null,
            weight: weight ? Number(weight) : null,
            rpe: null,
          })
        }
      >
        {done ? '✓' : 'Log'}
      </button>
    </div>
  );
}

function PainReport({ sessionId, exerciseId }: { sessionId: string | null; exerciseId: string }) {
  const [sent, setSent] = useState<null | { title: string; body: string }>(null);
  const [busy, setBusy] = useState(false);

  if (sent) {
    return (
      <div className="safety-banner" role="alert">
        <strong>{sent.title}</strong>
        <p className="small secondary" style={{ marginTop: '0.375rem' }}>
          {sent.body}
        </p>
      </div>
    );
  }

  return (
    <form
      className="card stack stack-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const formData = new FormData(event.currentTarget);
        const response = await fetch('/api/v1/safety/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: formData.get('kind'),
            detail: formData.get('detail'),
            workoutSessionId: sessionId,
            exerciseId,
          }),
        });
        const result = (await response.json()) as { data?: { memberNotice?: { title: string; body: string } } };
        setBusy(false);
        setSent(
          result.data?.memberNotice ?? {
            title: 'Thank you for telling us',
            body: 'We have paused automatic changes to your plan and asked the gym team to contact you.',
          },
        );
      }}
    >
      <strong className="small">What are you feeling?</strong>
      <select className="select" name="kind" required defaultValue="sharp_or_worsening_pain">
        <option value="sharp_or_worsening_pain">Sharp or worsening pain</option>
        <option value="new_injury">I think I have injured something</option>
        <option value="severe_dizziness">Dizziness</option>
        <option value="chest_pain">Chest pain</option>
        <option value="breathing_difficulty">Trouble breathing</option>
        <option value="joint_limitation">A joint is uncomfortable</option>
      </select>
      <textarea className="textarea" name="detail" placeholder="Where is it, and when did it start?" />
      <button className="btn btn-danger" type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Tell the gym team'}
      </button>
      <p className="micro muted">
        If you have chest pain, feel faint, or cannot breathe properly, stop now and get medical help immediately.
      </p>
    </form>
  );
}

function SessionSummary({
  title,
  volumeKg,
  sets,
  records,
  queued,
}: {
  title: string;
  volumeKg: number;
  sets: number;
  records: string[];
  queued: boolean;
}) {
  return (
    <div className="stack stack-6 celebrate">
      <div className="card card-accent stack stack-4" style={{ textAlign: 'center', alignItems: 'center' }}>
        <span className="eyebrow">Session complete</span>
        <h1 style={{ fontSize: '1.5rem' }}>{title}</h1>
        <div className="row" style={{ gap: '2rem', justifyContent: 'center' }}>
          <div className="stat">
            <span className="stat-label">Volume</span>
            <span className="stat-value">{Math.round(volumeKg).toLocaleString('en-PK')} kg</span>
          </div>
          <div className="stat">
            <span className="stat-label">Sets</span>
            <span className="stat-value">{sets}</span>
          </div>
        </div>
      </div>

      {records.length > 0 ? (
        <div className="card stack stack-3">
          <strong>New personal records</strong>
          {records.map((record) => (
            <p key={record} className="small secondary">
              ★ {record}
            </p>
          ))}
        </div>
      ) : null}

      {queued ? (
        <p className="offline-banner">
          <span aria-hidden="true">◍</span> Saved on this device. It will sync the next time you have signal.
        </p>
      ) : null}

      <a className="btn btn-primary btn-block" href="/app">
        Back to today
      </a>
    </div>
  );
}
