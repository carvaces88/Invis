import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

/** Short teaching bubble for product photo capture. */
export function PhotoCaptureTip({ text }: { text: string }) {
  return (
    <View style={styles.bubble} accessibilityRole="text">
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkMuted,
  },
});
