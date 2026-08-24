import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../data/types';
import { useI18n } from '../i18n';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { colors, radius, spacing, surfaces } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

export function FeedbackScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { profile } = useAuth();
  const nudged = route.params?.nudged === true;
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    if (!isSupabaseConfigured) {
      setBusy(false);
      setError(t('signInNotConfigured'));
      return;
    }
    const { error: insertError } = await supabase.from('feedback').insert({
      user_id: null,
      username: profile?.displayName ?? profile?.username ?? null,
      body: trimmed,
    });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSent(true);
    setTimeout(() => navigation.goBack(), 700);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.content,
          {
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <Text style={styles.title}>
          {nudged ? t('feedbackNudgeTitle') : t('feedbackTitle')}
        </Text>
        <Text style={styles.sub}>
          {nudged ? t('feedbackNudgeSub') : t('feedbackSub')}
        </Text>

        <View style={styles.card}>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            placeholder={t('feedbackPlaceholder')}
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            editable={!busy && !sent}
            textAlignVertical="top"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {sent ? <Text style={styles.thanks}>{t('feedbackThanks')}</Text> : null}
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              pressed && styles.pressed,
              (busy || !body.trim() || sent) && styles.btnDisabled,
            ]}
            onPress={submit}
            disabled={busy || !body.trim() || sent}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t('feedbackSend')}</Text>
            )}
          </Pressable>
          {nudged ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.skip}
              accessibilityRole="button"
            >
              <Text style={styles.skipText}>{t('feedbackSkip')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  sub: { marginTop: 6, color: colors.inkMuted, lineHeight: 21 },
  card: {
    ...surfaces.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  input: {
    minHeight: 140,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.ink,
    lineHeight: 22,
  },
  btn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.9 },
  skip: { marginTop: spacing.md, alignItems: 'center', padding: 8 },
  skipText: { color: colors.inkMuted, fontWeight: '600' },
  error: { marginTop: spacing.sm, color: colors.danger },
  thanks: { marginTop: spacing.sm, color: colors.success, fontWeight: '600' },
});
