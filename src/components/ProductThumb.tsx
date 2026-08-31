import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { productImageSource } from '../data/seedKruoka';
import type { Product } from '../data/types';
import { useI18n } from '../i18n';
import { colors, radius } from '../theme/colors';

type Props = {
  product: Product;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Show “Beta” badge + hover/a11y disclaimer (default true when image exists) */
  showBeta?: boolean;
};

/**
 * Catalog / K-Ruoka packshot when available.
 * Beta badge: retail web photos may not match the kitchen’s exact SKU.
 */
export function ProductThumb({
  product,
  size = 72,
  style,
  showBeta = true,
}: Props) {
  const { t } = useI18n();
  const source = productImageSource(product);
  const disclaimer = t('catalogImageBetaDisclaimer');

  if (!source) {
    return (
      <View
        style={[
          styles.box,
          { width: size, height: size, backgroundColor: colors.primarySoft },
          style,
        ]}
        accessibilityLabel={t('catalogImageMissing')}
      />
    );
  }

  const badgeSize = size < 56 ? 14 : 18;
  const webHoverProps =
    Platform.OS === 'web'
      ? ({ title: disclaimer } as Record<string, string>)
      : {};

  return (
    <View
      style={[styles.box, { width: size, height: size }, style]}
      accessibilityLabel={`${product.officialName}. ${disclaimer}`}
      {...webHoverProps}
    >
      <Image
        source={source}
        style={{ width: size, height: size, backgroundColor: '#fff' }}
        resizeMode="contain"
      />
      {showBeta ? (
        <View
          style={[
            styles.betaBadge,
            {
              minHeight: badgeSize,
              paddingHorizontal: size < 56 ? 3 : 5,
            },
          ]}
          {...webHoverProps}
          accessibilityLabel={disclaimer}
        >
          <Text
            style={[
              styles.betaText,
              { fontSize: size < 56 ? 8 : 10 },
            ]}
          >
            {t('catalogImageBeta')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    position: 'relative',
  },
  betaBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    backgroundColor: 'rgba(11, 31, 51, 0.72)',
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  betaText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
