import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n';
import { isKitchenName } from '../lib/authAccounts';
import { colors, radius, spacing, surfaces } from '../theme/colors';

const brandWordmark = require('../../assets/invis-wordmark.png');

export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { enter } = useAuth();
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kitchen = useMemo(() => isKitchenName(name), [name]);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await enter({ name, venue, email });
      if (!result.ok) setError(result.message);
    } catch {
      setError(t('gateEnterFailed'));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = name.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={brandWordmark}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel={t('appBrand')}
        />
        <Text style={styles.title}>{t('gateTitle')}</Text>
        <Text style={styles.sub}>{t('gateSub')}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t('gateName')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="name"
            placeholder={t('gateNamePlaceholder')}
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            editable={!busy}
            returnKeyType="next"
          />

          {!kitchen ? (
            <>
              <Text style={[styles.label, styles.labelGap]}>{t('gateVenue')}</Text>
              <TextInput
                value={venue}
                onChangeText={setVenue}
                autoCapitalize="words"
                autoCorrect={false}
                placeholder={t('gateVenuePlaceholder')}
                placeholderTextColor={colors.inkFaint}
                style={styles.input}
                editable={!busy}
                returnKeyType="next"
              />

              <Text style={[styles.label, styles.labelGap]}>
                {t('gateEmail')}
                <Text style={styles.recommended}> {t('gateEmailRecommended')}</Text>
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                placeholder={t('gateEmailPlaceholder')}
                placeholderTextColor={colors.inkFaint}
                style={styles.input}
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
              <Text style={styles.fieldHint}>{t('gateTesterHint')}</Text>
            </>
          ) : (
            <Text style={styles.kitchenHint}>{t('gateKitchenHint')}</Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.btn,
              pressed && styles.pressed,
              (busy || !canSubmit) && styles.btnDisabled,
            ]}
            onPress={onSubmit}
            disabled={busy || !canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t('gateSubmit')}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t('gateSubmit')}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: {
    flexGrow: 1,
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
  recommended: {
    fontWeight: '500',
    color: colors.inkFaint,
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
  fieldHint: {
    marginTop: 8,
    color: colors.inkFaint,
    fontSize: 13,
    lineHeight: 18,
  },
  kitchenHint: {
    marginTop: spacing.md,
    color: colors.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
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
});
