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

type Step = 'email' | 'otp';

export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const {
    configured,
    sendEmailOtp,
    verifyEmailOtp,
    signInWithPassword,
  } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKitchen, setShowKitchen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const onSendOtp = async () => {
    setError(null);
    setBusy(true);
    const result = await sendEmailOtp(email);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStep('otp');
    setOtp('');
  };

  const onVerifyOtp = async () => {
    setError(null);
    setBusy(true);
    const result = await verifyEmailOtp(email, otp);
    setBusy(false);
    if (!result.ok) setError(result.message);
  };

  const onKitchenSignIn = async () => {
    setError(null);
    setBusy(true);
    const result = await signInWithPassword(username, password);
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
            {step === 'email' ? (
              <>
                <Text style={styles.label}>{t('signInEmail')}</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder={t('signInEmailPlaceholder')}
                  placeholderTextColor={colors.inkFaint}
                  style={styles.input}
                  editable={!busy}
                  returnKeyType="send"
                  onSubmitEditing={onSendOtp}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    pressed && styles.pressed,
                    busy && styles.btnDisabled,
                  ]}
                  onPress={onSendOtp}
                  disabled={busy || !email.trim()}
                  accessibilityRole="button"
                  accessibilityLabel={t('signInSendCode')}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>{t('signInSendCode')}</Text>
                  )}
                </Pressable>
                <Text style={styles.hint}>{t('signInOtpHint')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.label}>{t('signInOtp')}</Text>
                <Text style={styles.otpSent}>
                  {t('signInOtpSent').replace('{email}', email.trim())}
                </Text>
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  placeholder={t('signInOtpPlaceholder')}
                  placeholderTextColor={colors.inkFaint}
                  style={styles.input}
                  editable={!busy}
                  maxLength={8}
                  returnKeyType="go"
                  onSubmitEditing={onVerifyOtp}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    pressed && styles.pressed,
                    busy && styles.btnDisabled,
                  ]}
                  onPress={onVerifyOtp}
                  disabled={busy || otp.trim().length < 6}
                  accessibilityRole="button"
                  accessibilityLabel={t('signInVerify')}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>{t('signInVerify')}</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setStep('email');
                    setOtp('');
                    setError(null);
                  }}
                  disabled={busy}
                  accessibilityRole="button"
                  style={styles.linkBtn}
                >
                  <Text style={styles.link}>{t('signInChangeEmail')}</Text>
                </Pressable>
                <Pressable
                  onPress={onSendOtp}
                  disabled={busy}
                  accessibilityRole="button"
                  style={styles.linkBtn}
                >
                  <Text style={styles.link}>{t('signInResendCode')}</Text>
                </Pressable>
              </>
            )}

            <Pressable
              onPress={() => setShowKitchen((v) => !v)}
              accessibilityRole="button"
              style={styles.kitchenToggle}
            >
              <Text style={styles.link}>{t('signInKitchenToggle')}</Text>
            </Pressable>

            {showKitchen ? (
              <View style={styles.kitchenBox}>
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
                />
                <Text style={[styles.label, styles.labelGap]}>
                  {t('signInPassword')}
                </Text>
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
                  onSubmitEditing={onKitchenSignIn}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.btnSecondary,
                    pressed && styles.pressed,
                    busy && styles.btnDisabled,
                  ]}
                  onPress={onKitchenSignIn}
                  disabled={busy || !username.trim() || !password}
                  accessibilityRole="button"
                  accessibilityLabel={t('signInSubmit')}
                >
                  <Text style={styles.btnSecondaryText}>{t('signInSubmit')}</Text>
                </Pressable>
              </View>
            ) : null}
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
  otpSent: {
    marginTop: 6,
    marginBottom: 4,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
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
  btnSecondary: {
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
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
  linkBtn: { marginTop: spacing.sm, alignItems: 'center' },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  kitchenToggle: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  kitchenBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
