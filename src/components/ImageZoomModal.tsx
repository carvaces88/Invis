import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { colors, spacing } from '../theme/colors';

export type ImageZoomTarget = {
  source: ImageSourcePropType;
  label?: string;
} | null;

type Props = {
  target: ImageZoomTarget;
  onClose: () => void;
};

/**
 * Full-screen lightbox for shelf crops / catalog packshots.
 * Tap backdrop or × to close. Pinch-zoom via ScrollView on iOS; large contain on web.
 */
export function ImageZoomModal({ target, onClose }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const open = target != null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.root} accessibilityRole="image">
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('imageZoomClose')}
        />
        <View
          style={[
            styles.chrome,
            { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md },
          ]}
          pointerEvents="box-none"
        >
          {target?.label ? (
            <Text style={styles.label} numberOfLines={2}>
              {target.label}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t('imageZoomClose')}
            hitSlop={12}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        {target ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              {
                minWidth: width,
                minHeight: height * 0.7,
                paddingBottom: insets.bottom + spacing.lg,
              },
            ]}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            bouncesZoom
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={target.source}
              style={{
                width: Math.min(width - spacing.lg * 2, 720),
                height: Math.min(height * 0.72, 720),
              }}
              resizeMode="contain"
              accessibilityLabel={target.label ?? t('imageZoomTitle')}
            />
          </ScrollView>
        ) : null}
        <Text
          style={[styles.hint, { paddingBottom: insets.bottom + spacing.sm }]}
        >
          {t('imageZoomHint')}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  scroll: { flex: 1, zIndex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    paddingHorizontal: spacing.lg,
  },
});
