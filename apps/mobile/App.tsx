/**
 * GymGuide member app (Expo / React Native).
 *
 * Shares @gymguide/types with the server, calls the same API the web member
 * portal calls, and uses the same offline contract: log locally, sync when
 * possible, never duplicate.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api } from './src/lib/api';
import { drainQueue, queueLength } from './src/lib/offline-queue';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The member app must work from cache when the phone has no signal.
      staleTime: 60_000,
      gcTime: 24 * 60 * 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

const theme = {
  bg: '#08090B',
  surface: '#121417',
  border: 'rgba(246,244,240,0.09)',
  text: '#FCFBF9',
  secondary: 'rgba(246,244,240,0.74)',
  muted: 'rgba(246,244,240,0.52)',
  accent: '#C8A45C',
  success: '#2FBF87',
  danger: '#E2685C',
  warning: '#D69E2E',
};

type Tab = 'today' | 'train' | 'plan' | 'progress' | 'support';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MemberApp />
    </QueryClientProvider>
  );
}

function MemberApp() {
  const [tab, setTab] = useState<Tab>('today');
  const [pending, setPending] = useState(0);

  const sync = useCallback(async () => {
    const outcome = await drainQueue(api.syncWorkout);
    setPending(outcome.stillQueued);
    if (outcome.synced > 0) await queryClient.invalidateQueries();
  }, []);

  useEffect(() => {
    void queueLength().then(setPending);
    void sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  return (
    <View style={styles.app}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.brand}>Apex Fitness</Text>
        {pending > 0 ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{pending} to sync</Text>
          </View>
        ) : null}
      </View>

      {tab === 'today' ? <TodayScreen onSync={sync} /> : null}
      {tab === 'train' ? <Placeholder title="Train" body="Your scheduled sessions and history." /> : null}
      {tab === 'plan' ? <Placeholder title="Plan" body="Your current program, phase and week." /> : null}
      {tab === 'progress' ? <Placeholder title="Progress" body="Adherence, weight, strength and habits." /> : null}
      {tab === 'support' ? <Placeholder title="Support" body="GymGuide Coach and your gym team." /> : null}

      <View style={styles.tabbar}>
        {(
          [
            ['today', 'Today'],
            ['train', 'Train'],
            ['plan', 'Plan'],
            ['progress', 'Progress'],
            ['support', 'Support'],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={styles.tab} accessibilityRole="tab">
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TodayScreen({ onSync }: { onSync: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['today'],
    queryFn: async () => {
      const result = await api.today();
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.body}>
          We could not reach the gym right now. Anything you logged is safe on this device and will sync
          automatically.
        </Text>
      </View>
    );
  }

  const [primary, ...rest] = data.cards;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={theme.accent}
          onRefresh={async () => {
            setRefreshing(true);
            await onSync();
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={styles.greeting}>Good morning, {data.greetingName}</Text>

      {data.safetyBanner ? (
        <View style={[styles.card, styles.safety]}>
          <Text style={styles.cardTitle}>A coach is reviewing your plan</Text>
          <Text style={styles.body}>{data.safetyBanner}</Text>
        </View>
      ) : null}

      {primary ? (
        <View style={[styles.card, styles.cardAccent]}>
          <Text style={styles.eyebrow}>WHAT TO DO TODAY</Text>
          <Text style={styles.cardTitle}>{primary.title}</Text>
          <Text style={styles.body}>{primary.subtitle}</Text>
          {primary.ctaLabel ? (
            <Pressable style={styles.button} accessibilityRole="button">
              <Text style={styles.buttonText}>{primary.ctaLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.eyebrow}>ADHERENCE (4 WEEKS)</Text>
        <Text style={styles.metric}>{data.adherencePercent}%</Text>
        <Text style={styles.body}>
          {data.streak} sessions completed. Consistency is what actually moves the numbers.
        </Text>
      </View>

      {rest.map((card) => (
        <View key={`${card.kind}-${card.title}`} style={styles.card}>
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text style={styles.body}>{card.subtitle}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 58,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  brand: { color: theme.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  pill: {
    backgroundColor: 'rgba(214,158,46,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: { color: theme.warning, fontSize: 12, fontWeight: '700' },
  scroll: { padding: 18, gap: 14, paddingBottom: 96 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  greeting: { color: theme.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, marginBottom: 4 },
  eyebrow: { color: theme.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 6 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    gap: 8,
  },
  cardAccent: { borderColor: 'rgba(200,164,92,0.38)' },
  safety: { borderLeftWidth: 3, borderLeftColor: theme.warning },
  cardTitle: { color: theme.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  body: { color: theme.secondary, fontSize: 15, lineHeight: 22 },
  metric: { color: theme.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: { color: theme.bg, fontWeight: '700', fontSize: 15 },
  tabbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(8,9,11,0.96)',
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingBottom: 22,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  tabLabel: { color: theme.muted, fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: theme.accent },
});
