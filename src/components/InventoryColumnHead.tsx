import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ExportColumnId } from '../lib/export/profiles';
import { colors, radius } from '../theme/colors';

type Props = {
  col: ExportColumnId;
  style?: StyleProp<ViewStyle>;
  /** Visual drop-target highlight while dragging over this header. */
  dropTarget?: boolean;
  /** Native: this column is armed for ◂/▸ nudges. */
  armed?: boolean;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMoveBy?: (delta: -1 | 1) => void;
  onDragStartCol?: (col: ExportColumnId) => void;
  onDragOverCol?: (col: ExportColumnId) => void;
  onDropOnCol?: (to: ExportColumnId, from?: ExportColumnId) => void;
  onDragEnd?: () => void;
  onArm?: (col: ExportColumnId | null) => void;
  dragHint: string;
  moveLeftLabel: string;
  moveRightLabel: string;
  children: React.ReactNode;
};

/**
 * Inventory sheet column header shell — grab handle + optional native nudge.
 * Web uses HTML5 drag-and-drop; native uses long-press then ◂/▸.
 * Handle sits above the label so fixed column widths still match body cells.
 */
export function InventoryColumnHead({
  col,
  style,
  dropTarget,
  armed,
  canMoveLeft,
  canMoveRight,
  onMoveBy,
  onDragStartCol,
  onDragOverCol,
  onDropOnCol,
  onDragEnd,
  onArm,
  dragHint,
  moveLeftLabel,
  moveRightLabel,
  children,
}: Props) {
  const isWeb = Platform.OS === 'web';

  const dropProps = isWeb
    ? ({
        onDragOver: (e: {
          preventDefault?: () => void;
          dataTransfer?: { dropEffect?: string };
        }) => {
          e.preventDefault?.();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          onDragOverCol?.(col);
        },
        onDrop: (e: {
          preventDefault?: () => void;
          dataTransfer?: { getData?: (type: string) => string };
        }) => {
          e.preventDefault?.();
          const fromRaw = e.dataTransfer?.getData?.('text/plain');
          onDropOnCol?.(
            col,
            fromRaw ? (fromRaw as ExportColumnId) : undefined,
          );
        },
        onDragEnter: (e: { preventDefault?: () => void }) => {
          e.preventDefault?.();
          onDragOverCol?.(col);
        },
      } as object)
    : null;

  const handleDragProps = isWeb
    ? ({
        draggable: true,
        onDragStart: (e: {
          stopPropagation?: () => void;
          dataTransfer?: {
            setData?: (type: string, value: string) => void;
            effectAllowed?: string;
          };
        }) => {
          e.stopPropagation?.();
          e.dataTransfer?.setData?.('text/plain', col);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
          onDragStartCol?.(col);
        },
        onDragEnd: () => {
          onDragEnd?.();
        },
      } as object)
    : null;

  return (
    <View
      style={[
        styles.wrap,
        style,
        dropTarget && styles.dropTarget,
        armed && styles.armed,
      ]}
      {...dropProps}
    >
      <View style={styles.handleRow}>
        {armed && !isWeb ? (
          <Pressable
            onPress={() => onMoveBy?.(-1)}
            disabled={!canMoveLeft}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={moveLeftLabel}
            style={({ pressed }) => [
              styles.nudge,
              (!canMoveLeft || pressed) && styles.nudgeDim,
            ]}
          >
            <Text style={styles.nudgeText}>◂</Text>
          </Pressable>
        ) : null}
        <Pressable
          {...handleDragProps}
          onLongPress={() => {
            if (!isWeb) onArm?.(armed ? null : col);
          }}
          delayLongPress={280}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={dragHint}
          accessibilityHint={dragHint}
          style={({ pressed }) => [
            styles.handle,
            pressed && styles.handlePressed,
            isWeb ? ({ cursor: 'grab' } as object) : null,
          ]}
        >
          <Text style={styles.handleGlyph} accessible={false}>
            ⠿
          </Text>
        </Pressable>
        {armed && !isWeb ? (
          <Pressable
            onPress={() => onMoveBy?.(1)}
            disabled={!canMoveRight}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={moveRightLabel}
            style={({ pressed }) => [
              styles.nudge,
              (!canMoveRight || pressed) && styles.nudgeDim,
            ]}
          >
            <Text style={styles.nudgeText}>▸</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  dropTarget: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    ...(Platform.OS === 'web'
      ? ({
          outlineWidth: 1,
          outlineColor: colors.primary,
          outlineStyle: 'solid',
        } as object)
      : null),
  },
  armed: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 12,
    marginBottom: 1,
  },
  handle: {
    paddingHorizontal: 1,
    paddingVertical: 0,
    borderRadius: radius.sm,
  },
  handlePressed: {
    backgroundColor: colors.bgElevated,
  },
  handleGlyph: {
    fontSize: 10,
    lineHeight: 12,
    color: colors.primary,
    opacity: 0.65,
    fontWeight: '700',
  },
  nudge: {
    paddingHorizontal: 2,
    minWidth: 14,
    alignItems: 'center',
  },
  nudgeDim: { opacity: 0.35 },
  nudgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 12,
  },
  body: {
    minWidth: 0,
  },
});
