import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n';
import { colors, radius, spacing, surfaces } from '../theme/colors';

const brandWordmark = require('../../assets/invis-wordmark.png');

export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { signIn, configured } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    const result = await signIn(username, password);
    setBusy(false);
    if (!result.ok) setError(result.message);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.inner,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <Image
          source={brandWordmark}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel={t('appBrand')}
        />
        <Text style={styles.title}>{t('signInTitle')}</Text>
        <Text style={styles.sub}>{t('signInSub')}</Text>

        {!configured ? (
          <Text style={styles.error}>{t('signInNotConfigured')}</Text>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>{t('signInUsername')}</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              placeholder={t('signInUsernamePlaceholder')}
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              editable={!busy}
              returnKeyType="next"
            />
            <Text style={[styles.label, styles.labelGap]}>{t('signInPassword')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              placeholder={t('signInPasswordPlaceholder')}
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                pressed && styles.pressed,
                busy && styles.btnDisabled,
              ]}
              onPress={onSubmit}
              disabled={busy || !username.trim() || !password}
              accessibilityRole="button"
              accessibilityLabel={t('signInSubmit')}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>{t('signInSubmit')}</Text>
              )}
            </Pressable>
            <Text style={styles.hint}>{t('signInGuestHint')}</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  wordmark: {
    width: 280,
    height: 86,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  sub: {
    marginTop: 6,
    marginBottom: spacing.lg,
    color: colors.inkMuted,
    lineHeight: 22,
  },
  card: {
    ...surfaces.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
    letterSpacing: 0.2,
  },
  labelGap: { marginTop: spacing.md },
  input: {
    marginTop: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  btn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.9 },
  error: {
    marginTop: spacing.md,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    marginTop: spacing.md,
    color: colors.inkFaint,
    fontSize: 13,
    lineHeight: 18,
  },
});
