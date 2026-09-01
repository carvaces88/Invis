import React, { useRef } from 'react';
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
  /** This column is armed for ◂/▸ nudges (long-press / tap handle). */
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
 * Inventory sheet column header shell — grab handle + ◂/▸ nudges.
 * Web desktop: HTML5 drag-and-drop on the handle.
 * Touch / mobile web / native: long-press (or tap) handle → ◂/▸.
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
  /** Skip arming onPress after an HTML5 drag (mouseup still fires press). */
  const skippedPressAfterDrag = useRef(false);

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
          skippedPressAfterDrag.current = true;
          e.dataTransfer?.setData?.('text/plain', col);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
          onDragStartCol?.(col);
        },
        onDragEnd: () => {
          onDragEnd?.();
          // Clear after the trailing click/press event.
          setTimeout(() => {
            skippedPressAfterDrag.current = false;
          }, 0);
        },
      } as object)
    : null;

  function toggleArm() {
    onArm?.(armed ? null : col);
  }

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
        {armed ? (
          <Pressable
            onPress={() => onMoveBy?.(-1)}
            disabled={!canMoveLeft}
            hitSlop={8}
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
          onPress={() => {
            if (skippedPressAfterDrag.current) return;
            // Tap/click arms ◂/▸ — works on mobile web where HTML5 drag fails.
            toggleArm();
          }}
          onLongPress={() => {
            if (skippedPressAfterDrag.current) return;
            toggleArm();
          }}
          delayLongPress={280}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={dragHint}
          accessibilityHint={dragHint}
          style={({ pressed }) => [
            styles.handle,
            (pressed || armed) && styles.handleActive,
            isWeb ? ({ cursor: 'grab' } as object) : null,
          ]}
        >
          <Text style={styles.handleGlyph} accessible={false}>
            ⠿
          </Text>
        </Pressable>
        {armed ? (
          <Pressable
            onPress={() => onMoveBy?.(1)}
            disabled={!canMoveRight}
            hitSlop={8}
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
          outlineWidth: 2,
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
    minHeight: 18,
    marginBottom: 2,
    gap: 1,
  },
  handle: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.primaryMid,
    minWidth: 22,
    alignItems: 'center',
  },
  handleActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  handleGlyph: {
    fontSize: 13,
    lineHeight: 15,
    color: colors.primary,
    opacity: 1,
    fontWeight: '800',
    letterSpacing: -1,
  },
  nudge: {
    paddingHorizontal: 3,
    minWidth: 18,
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  nudgeDim: { opacity: 0.35 },
  nudgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    lineHeight: 14,
  },
  body: {
    minWidth: 0,
  },
});
