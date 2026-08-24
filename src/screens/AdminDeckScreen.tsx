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
import { supabase } from '../lib/supabase';
import { colors, radius, spacing, surfaces } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDeck'>;

type ProfileRow = {
  username: string;
  display_name: string;
  email: string | null;
  role: string;
  last_seen_at: string | null;
};

type SignInRow = {
  id: string;
  username: string | null;
  signed_in_at: string;
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
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [signIns, setSignIns] = useState<SignInRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [p, s, f] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, display_name, email, role, last_seen_at')
        .order('username'),
      supabase
        .from('sign_ins')
        .select('id, username, signed_in_at')
        .order('signed_in_at', { ascending: false })
        .limit(40),
      supabase
        .from('feedback')
        .select('id, username, body, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (p.error || s.error || f.error) {
      setError(p.error?.message || s.error?.message || f.error?.message || 'Load failed');
    } else {
      setProfiles(p.data ?? []);
      setSignIns(s.data ?? []);
      setFeedback(f.data ?? []);
    }
    setLoading(false);
  }, []);

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
      {loading && profiles.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
      ) : (
        profiles.map((row) => (
          <View key={row.username} style={styles.card}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{row.display_name}</Text>
              <Text style={styles.badge}>
                {row.role === 'admin' ? t('adminRoleAdmin') : t('adminRoleGuest')}
              </Text>
            </View>
            <Text style={styles.meta}>
              {row.username} · {row.email ?? '—'}
            </Text>
            <Text style={styles.meta}>
              {t('adminLastSeen')}: {formatWhen(row.last_seen_at, locale)}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.section}>{t('adminSignIns')}</Text>
      {signIns.length === 0 && !loading ? (
        <Text style={styles.empty}>{t('adminSignInsEmpty')}</Text>
      ) : (
        signIns.map((row) => (
          <View key={row.id} style={styles.slimCard}>
            <Text style={styles.slimTitle}>{row.username ?? '—'}</Text>
            <Text style={styles.meta}>{formatWhen(row.signed_in_at, locale)}</Text>
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
  slimCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slimTitle: { fontWeight: '600', color: colors.ink },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
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
