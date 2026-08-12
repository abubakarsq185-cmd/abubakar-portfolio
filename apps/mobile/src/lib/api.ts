/**
 * API client for the member app.
 *
 * The mobile app talks to exactly the same routes the web member portal uses.
 * There is no second backend and no privileged mobile API — a stolen device
 * token can do nothing a signed-in member could not already do.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ApiResult, TodayCard, WorkoutPlayerPayload, WorkoutSessionSyncInput } from '@gymguide/types';

const TOKEN_KEY = 'gymguide:session-token';

export interface ApiConfig {
  baseUrl: string;
}

let config: ApiConfig = { baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000' };

export function configureApi(next: ApiConfig): void {
  config = next;
}

export async function setToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Cookie: `gg_session=${token}` } : {}),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: { ...(await authHeaders()), ...(init.headers ?? {}) },
    });
    const body = (await response.json()) as ApiResult<T>;
    return body;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'network',
        message: error instanceof Error ? error.message : 'You appear to be offline.',
      },
    };
  }
}

export interface TodayResponse {
  greetingName: string;
  cards: TodayCard[];
  streak: number;
  adherencePercent: number;
  safetyBanner: string | null;
}

export const api = {
  today: () => request<TodayResponse>('/api/v1/today'),
  workout: (sessionId: string) => request<WorkoutPlayerPayload>(`/api/v1/workouts/${sessionId}`),

  /** Returns the raw status so the offline queue can decide retry vs. drop. */
  syncWorkout: async (body: WorkoutSessionSyncInput): Promise<{ status: number }> => {
    const response = await fetch(`${config.baseUrl}/api/v1/workouts/sync`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    });
    return { status: response.status };
  },

  reportRisk: (body: { kind: string; detail?: string; workoutSessionId?: string | null }) =>
    request<{ memberNotice: { title: string; body: string } | null; caseReference: string | null }>(
      '/api/v1/safety/report',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  askCoach: (message: string) =>
    request<{ reply: { body: string; isAiAssisted: boolean } }>('/api/v1/coach', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
