import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';
import { useCloudSync } from './CloudSyncProvider';

/** Compact cloud sync row for More / settings surfaces. */
export function CloudSyncStatus() {
  const { t } = useI18n();
  const { status, lastSyncedAt, syncNow, configured, email } = useCloudSync();

  if (!configured) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('cloudSyncTitle')}</Text>
        <Text style={styles.body}>{t('cloudSyncOffline')}</Text>
      </View>
    );
  }

  if (!email) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('cloudSyncTitle')}</Text>
        <Text style={styles.body}>{t('cloudSyncNeedsEmail')}</Text>
      </View>
    );
  }

  const statusLabel =
    status === 'pulling' || status === 'pushing'
      ? t('cloudSyncWorking')
      : status === 'error'
        ? t('cloudSyncError')
        : status === 'synced'
          ? t('cloudSyncSynced')
          : t('cloudSyncIdle');

  const when = lastSyncedAt
    ? t('cloudSyncLastAt').replace(
        '{time}',
        new Date(lastSyncedAt).toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
      )
    : t('cloudSyncNever');

  const busy = status === 'pulling' || status === 'pushing';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('cloudSyncTitle')}</Text>
          <Text style={styles.body}>{t('cloudSyncSub')}</Text>
          <Text style={styles.meta}>{email}</Text>
          <Text style={styles.meta}>{statusLabel}</Text>
          <Text style={styles.meta}>{when}</Text>
        </View>
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            onPress={() => void syncNow()}
          >
            <Text style={styles.btnText}>{t('cloudSyncNow')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
