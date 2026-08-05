import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { productImageSource } from '../data/seedKruoka';
import type { Product } from '../data/types';
import { colors, radius } from '../theme/colors';

type Props = {
  product: Product;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Official catalog / K-Ruoka packshot when available. */
export function ProductThumb({ product, size = 72, style }: Props) {
  const source = productImageSource(product);
  if (!source) {
    return (
      <View
        style={[
          styles.box,
          { width: size, height: size, backgroundColor: colors.primarySoft },
          style,
        ]}
      />
    );
  }
  return (
    <View style={[styles.box, { width: size, height: size }, style]}>
      <Image source={source} style={{ width: size, height: size }} resizeMode="cover" />
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
  },
});
