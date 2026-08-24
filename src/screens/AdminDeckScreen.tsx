import React, { useCallback, useState } from 'react';
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

export function AdminDeckScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError(t('signInNotConfigured'));
      setLoading(false);
      return;
    }
    const [e, f] = await Promise.all([
      supabase
        .from('app_entries')
        .select('id, name, venue, email, kind, created_at')
        .order('created_at', { ascending: false })
        .limit(80),
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
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

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
      <Text style={styles.lead}>{t('adminDeckSub')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

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
  meta: { marginTop: 4, color: colors.inkMuted, fontSize: 13 },
  body: { marginTop: 8, color: colors.ink, lineHeight: 21, fontSize: 15 },
  empty: { color: colors.inkFaint, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },
  refreshBtn: { alignSelf: 'center', marginTop: spacing.lg, padding: 12 },
  refreshText: { color: colors.primary, fontWeight: '700' },
});
