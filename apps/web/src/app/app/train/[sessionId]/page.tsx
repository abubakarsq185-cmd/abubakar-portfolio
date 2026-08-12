import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireMember } from '@/server/auth/session';
import { loadWorkoutPlayer } from '@/server/services/training';
import { WorkoutPlayer } from '@/components/member/workout-player';

export const metadata: Metadata = { title: 'Workout' };

export default async function WorkoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const [{ actor }, { sessionId }] = await Promise.all([requireMember(), params]);
  const payload = await loadWorkoutPlayer(actor, sessionId);
  if (!payload) notFound();
  return <WorkoutPlayer payload={payload} />;
}
