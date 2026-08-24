import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth/AuthProvider';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';

type Mode = 'signin' | 'signup';

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { signIn, signUp, enterGuestMode, configured } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [venueName, setVenueName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || password.length < 6) {
      setError(t('authErrorCredentials'));
      return;
    }
    if (mode === 'signup' && !venueName.trim()) {
      setError(t('authErrorVenueName'));
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === 'signin'
          ? await signIn(email, password)
          : await signUp({ email, password, venueName });
      if (result.error) setError(result.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>{t('appBrand')}</Text>
        <Text style={styles.title}>
          {mode === 'signup' ? t('authSignUpTitle') : t('authSignInTitle')}
        </Text>
        <Text style={styles.sub}>
          {mode === 'signup' ? t('authSignUpSub') : t('authSignInSub')}
        </Text>

        {!configured ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>{t('authCloudNotConfigured')}</Text>
          </View>
        ) : null}

        {mode === 'signup' ? (
          <>
            <Text style={styles.label}>{t('authVenueName')}</Text>
            <TextInput
              style={styles.input}
              value={venueName}
              onChangeText={setVenueName}
              placeholder={t('authVenuePlaceholder')}
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="words"
            />
          </>
        ) : null}

        <Text style={styles.label}>{t('authEmail')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="chef@kitchen.fi"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t('authPassword')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.inkFaint}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={() => void onSubmit()}
          disabled={busy || !configured}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {mode === 'signup' ? t('authSignUp') : t('authSignIn')}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setError(null);
            setMode((m) => (m === 'signup' ? 'signin' : 'signup'));
          }}
          style={styles.switchBtn}
        >
          <Text style={styles.switchText}>
            {mode === 'signup' ? t('authHaveAccount') : t('authNeedAccount')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void enterGuestMode()}
          style={styles.guestBtn}
          accessibilityRole="button"
        >
          <Text style={styles.guestText}>{t('authContinueGuest')}</Text>
        </Pressable>

        <Text style={styles.footnote}>{t('authQuotaNote')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  brand: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
  },
  sub: {
    fontSize: 15,
    color: colors.inkMuted,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
    fontSize: 14,
  },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  switchText: { color: colors.primaryMid, fontWeight: '600' },
  guestBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: spacing.sm,
  },
  guestText: { color: colors.inkMuted, fontWeight: '600' },
  footnote: {
    fontSize: 12,
    color: colors.inkFaint,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  warnBox: {
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  warnText: { color: colors.warning, fontSize: 13, lineHeight: 18 },
});
