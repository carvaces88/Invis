import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../data/types';
import { useI18n } from '../i18n';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { colors, radius, spacing, surfaces } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDeck'>;

type EntryRow = {
  id: string;
  name: string;
  venue: string | null;
  email: string | null;
  kind: string;
  created_at: string;
};

type FeedbackRow = {
  id: string;
  username: string | null;
  body: string;
  created_at: string;
};

type LocationRow = {
  venue: string;
  visits: number;
  lastSeen: string;
  people: string[];
};

function formatWhen(iso: string | null, locale: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'fi' ? 'fi-FI' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function buildLocations(entries: EntryRow[]): LocationRow[] {
  const map = new Map<
    string,
    { venue: string; visits: number; lastSeen: string; people: Set<string> }
  >();
  for (const row of entries) {
    const venue = row.venue?.trim();
    if (!venue) continue;
    const key = venue.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        venue,
        visits: 1,
        lastSeen: row.created_at,
        people: new Set([row.name]),
      });
      continue;
    }
    existing.visits += 1;
    existing.people.add(row.name);
    if (row.created_at > existing.lastSeen) existing.lastSeen = row.created_at;
  }
  return [...map.values()]
    .map((v) => ({
      venue: v.venue,
      visits: v.visits,
      lastSeen: v.lastSeen,
      people: [...v.people].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.visits - a.visits || a.venue.localeCompare(b.venue));
}

function uniqueUserCount(entries: EntryRow[]): number {
  const keys = new Set(
    entries.map((e) => e.name.trim().toLowerCase()).filter(Boolean),
  );
  return keys.size;
}

export function AdminDeckScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { isMaster, isInvestor } = useAuth();
  const tractionOnly = isInvestor && !isMaster;
  const canView = isMaster || isInvestor;
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const locations = useMemo(() => buildLocations(entries), [entries]);
  const users = useMemo(() => uniqueUserCount(entries), [entries]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: tractionOnly ? t('tractionDeckTitle') : t('masterDeckTitle'),
    });
  }, [navigation, t, tractionOnly]);

  const load = useCallback(async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError(t('signInNotConfigured'));
      setLoading(false);
      return;
    }
    if (!canView) {
      setError(t('masterDeckDenied'));
      setLoading(false);
      return;
    }

    if (tractionOnly) {
      const e = await supabase
        .from('app_entries')
        .select('id, name, venue, email, kind, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (e.error) {
        setError(e.error.message || 'Load failed');
        setEntries([]);
      } else {
        setEntries(e.data ?? []);
      }
      setFeedback([]);
      setLoading(false);
      return;
    }

    const [e, f] = await Promise.all([
      supabase
        .from('app_entries')
        .select('id, name, venue, email, kind, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('feedback')
        .select('id, username, body, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (e.error || f.error) {
      setError(e.error?.message || f.error?.message || 'Load failed');
    } else {
      setEntries(e.data ?? []);
      setFeedback(f.data ?? []);
    }
    setLoading(false);
  }, [canView, tractionOnly, t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  if (tractionOnly) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <Text style={styles.lead}>{t('tractionDeckSub')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.tractionCard}>
          {loading && entries.length === 0 ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
          ) : (
            <>
              <Text style={styles.tractionNum}>{users}</Text>
              <Text style={styles.tractionLabel}>{t('tractionUsersLabel')}</Text>
              <Text style={styles.tractionMeta}>
                {t('tractionEntriesMeta').replace(
                  '{n}',
                  String(entries.length),
                )}
              </Text>
            </>
          )}
        </View>

        <Pressable onPress={() => void load()} style={styles.refreshBtn}>
          <Text style={styles.refreshTextAccent}>{t('adminRefresh')}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
      }}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} />
      }
    >
      <Text style={styles.lead}>{t('masterDeckSub')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>{t('masterLocations')}</Text>
      {loading && locations.length === 0 ? (
        <ActivityIndicator color={colors.warning} style={{ marginVertical: 16 }} />
      ) : locations.length === 0 ? (
        <Text style={styles.empty}>{t('masterLocationsEmpty')}</Text>
      ) : (
        locations.map((loc) => (
          <View key={loc.venue.toLowerCase()} style={styles.locationCard}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{loc.venue}</Text>
              <Text style={styles.orangeBadge}>
                {t('masterLocationVisits').replace('{n}', String(loc.visits))}
              </Text>
            </View>
            <Text style={styles.meta}>
              {t('masterLocationPeople')}: {loc.people.join(', ')}
            </Text>
            <Text style={styles.meta}>
              {t('masterLocationLast')}: {formatWhen(loc.lastSeen, locale)}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.section}>{t('adminPeople')}</Text>
      {loading && entries.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>{t('adminEntriesEmpty')}</Text>
      ) : (
        entries.map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{row.name}</Text>
              <Text style={styles.badge}>
                {row.kind === 'kitchen'
                  ? t('adminRoleKitchen')
                  : row.kind === 'investor'
                    ? t('adminRoleInvestor')
                    : t('adminRoleTester')}
              </Text>
            </View>
            {row.venue ? (
              <Text style={styles.meta}>
                {t('adminVenue')}: {row.venue}
              </Text>
            ) : null}
            {row.email ? <Text style={styles.meta}>{row.email}</Text> : null}
            <Text style={styles.meta}>{formatWhen(row.created_at, locale)}</Text>
          </View>
        ))
      )}

      <Text style={styles.section}>{t('adminFeedback')}</Text>
      {feedback.length === 0 && !loading ? (
        <Text style={styles.empty}>{t('adminFeedbackEmpty')}</Text>
      ) : (
        feedback.map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{row.username ?? '—'}</Text>
              <Text style={styles.meta}>{formatWhen(row.created_at, locale)}</Text>
            </View>
            <Text style={styles.body}>{row.body}</Text>
          </View>
        ))
      )}

      <Pressable onPress={() => void load()} style={styles.refreshBtn}>
        <Text style={styles.refreshText}>{t('adminRefresh')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  lead: { color: colors.inkMuted, marginBottom: spacing.lg, lineHeight: 21 },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  card: {
    ...surfaces.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  locationCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#F0D9A8',
  },
  tractionCard: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  tractionNum: {
    fontSize: 64,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -2,
  },
  tractionLabel: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  tractionMeta: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  orangeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
    backgroundColor: '#FFE4B8',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  meta: { marginTop: 4, color: colors.inkMuted, fontSize: 13 },
  body: { marginTop: 8, color: colors.ink, lineHeight: 21, fontSize: 15 },
  empty: { color: colors.inkFaint, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },
  refreshBtn: { alignSelf: 'center', marginTop: spacing.lg, padding: 12 },
  refreshText: { color: colors.warning, fontWeight: '700' },
  refreshTextAccent: { color: colors.accent, fontWeight: '700' },
});
