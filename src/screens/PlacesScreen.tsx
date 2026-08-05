import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventory } from '../data/store';
import { useI18n } from '../i18n';
import { alertInfo } from '../lib/alertAck';
import { colors, radius, spacing } from '../theme/colors';

export function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const {
    siteName,
    places,
    session,
    setSiteName,
    addPlace,
    renamePlace,
    deletePlace,
    activePlaceId,
    setActivePlaceId,
  } = useInventory();

  const [siteDraft, setSiteDraft] = useState(siteName);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  function saveSite() {
    const trimmed = siteDraft.trim();
    if (!trimmed) {
      setSiteDraft(siteName);
      return;
    }
    setSiteName(trimmed);
  }

  function onAdd() {
    const created = addPlace(newName);
    if (!created) {
      alertInfo(t('placesAdd'), t('placesNameRequired'));
      return;
    }
    setNewName('');
  }

  function startRename(placeId: string, current: string) {
    setEditingId(placeId);
    setEditDraft(current);
  }

  function commitRename() {
    if (!editingId) return;
    if (!editDraft.trim()) {
      alertInfo(t('placesRename'), t('placesNameRequired'));
      return;
    }
    renamePlace(editingId, editDraft);
    setEditingId(null);
    setEditDraft('');
  }

  function confirmDelete(placeId: string, name: string) {
    const run = () => {
      const err = deletePlace(placeId);
      if (err === 'last') {
        alertInfo(t('placesDelete'), t('placesDeleteLast'));
      } else if (err === 'has_stock') {
        alertInfo(t('placesDelete'), t('placesDeleteHasStock'));
      }
    };
    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined' &&
        window.confirm(`${t('placesDeleteConfirm')}\n\n${name}`);
      if (ok) run();
      return;
    }
    Alert.alert(t('placesDelete'), t('placesDeleteConfirm'), [
      { text: t('exportCancel'), style: 'cancel' },
      { text: t('placesDelete'), style: 'destructive', onPress: run },
    ]);
  }

  function stockHint(placeId: string) {
    const counted = session.lines.filter(
      (l) =>
        l.placeId === placeId && l.quantity != null && l.quantity !== 0,
    ).length;
    if (counted === 0) return t('placesEmptyStock');
    return t('placesStockCount').replace('{count}', String(counted));
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.kicker}>{t('appBrand')}</Text>
      <Text style={styles.title}>{t('placesTitle')}</Text>
      <Text style={styles.intro}>{t('placesIntro')}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('placesSiteLabel')}</Text>
        <Text style={styles.cardSub}>{t('placesSiteHint')}</Text>
        <TextInput
          value={siteDraft}
          onChangeText={setSiteDraft}
          onBlur={saveSite}
          onSubmitEditing={saveSite}
          placeholder={t('placesSitePlaceholder')}
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
          accessibilityLabel={t('placesSiteLabel')}
        />
      </View>

      <Text style={styles.section}>{t('placesList')}</Text>

      {places.map((place) => {
        const editing = editingId === place.id;
        const isActive = activePlaceId === place.id;
        return (
          <View key={place.id} style={[styles.placeCard, isActive && styles.placeCardActive]}>
            {editing ? (
              <TextInput
                value={editDraft}
                onChangeText={setEditDraft}
                onBlur={commitRename}
                onSubmitEditing={commitRename}
                autoFocus
                style={styles.input}
              />
            ) : (
              <Pressable onPress={() => setActivePlaceId(place.id)}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeMeta}>
                  {stockHint(place.id)}
                  {isActive ? ` · ${t('placesActive')}` : ''}
                </Text>
              </Pressable>
            )}
            <View style={styles.placeActions}>
              {!editing ? (
                <Pressable
                  onPress={() => startRename(place.id, place.name)}
                  style={styles.actionBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.actionText}>{t('placesRename')}</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={commitRename}
                  style={styles.actionBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.actionText}>{t('placesSave')}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => confirmDelete(place.id, place.name)}
                style={styles.actionBtnDanger}
                accessibilityRole="button"
              >
                <Text style={styles.actionTextDanger}>{t('placesDelete')}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('placesAdd')}</Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder={t('placesAddPlaceholder')}
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
          onSubmitEditing={onAdd}
        />
        <Pressable
          style={styles.addBtn}
          onPress={onAdd}
          accessibilityRole="button"
        >
          <Text style={styles.addBtnText}>{t('placesAdd')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 4,
  },
  intro: {
    marginTop: 6,
    marginBottom: spacing.lg,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  cardSub: { marginTop: 4, marginBottom: spacing.sm, color: colors.inkMuted, fontSize: 13 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkMuted,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  placeCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  placeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  placeName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  placeMeta: { marginTop: 2, fontSize: 12, color: colors.inkMuted },
  placeActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.bgElevated,
  },
  actionText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  actionBtnDanger: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  actionTextDanger: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  addBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
