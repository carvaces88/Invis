import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ImageZoomModal,
  type ImageZoomTarget,
} from '../components/ImageZoomModal';
import { useInventory } from '../data/store';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';

/**
 * Simple inventory photo album — browsable by place / session date.
 */
export function InventoryPhotosScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { inventoryPhotos, places, removeInventoryPhoto } = useInventory();
  const [zoom, setZoom] = useState<ImageZoomTarget>(null);

  const placeName = useMemo(() => {
    const map = new Map(places.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? id;
  }, [places]);

  const grouped = useMemo(() => {
    const byKey = new Map<string, typeof inventoryPhotos>();
    for (const photo of inventoryPhotos) {
      const key = `${photo.sessionDate}::${photo.placeId}`;
      const list = byKey.get(key) ?? [];
      list.push(photo);
      byKey.set(key, list);
    }
    return [...byKey.entries()]
      .map(([key, photos]) => {
        const [sessionDate, placeId] = key.split('::');
        return {
          key,
          sessionDate: sessionDate ?? '',
          placeId: placeId ?? '',
          photos,
        };
      })
      .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  }, [inventoryPhotos]);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + spacing.md }]}>
      <Text style={styles.sub}>{t('inventoryPhotosSub')}</Text>
      {grouped.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('inventoryPhotosEmpty')}</Text>
          <Text style={styles.emptyBody}>{t('inventoryPhotosEmptyHint')}</Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(g) => g.key}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          renderItem={({ item: group }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {placeName(group.placeId)} · {group.sessionDate}
              </Text>
              <View style={styles.grid}>
                {group.photos.map((photo) => (
                  <Pressable
                    key={photo.id}
                    style={styles.tile}
                    onPress={() =>
                      setZoom({
                        source: { uri: photo.uri },
                        label: [
                          placeName(photo.placeId),
                          photo.sessionDate,
                          photo.note,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      })
                    }
                    onLongPress={() => removeInventoryPhoto(photo.id)}
                    accessibilityRole="imagebutton"
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        />
      )}
      <ImageZoomModal target={zoom} onClose={() => setZoom(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: spacing.sm },
  sub: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkMuted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  image: { width: '100%', height: '100%' },
});
