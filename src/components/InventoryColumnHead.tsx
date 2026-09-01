import React, { useEffect, useRef, useState } from 'react';
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
  /** This column is the active HTML5 drag source. */
  dragging?: boolean;
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

/** Desktop web: hover + fine pointer (vs touch / coarse). */
function useDesktopPointer() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return desktop;
}

/** Small pill ghost instead of the browser’s default translucent DOM clone. */
function setCleanDragGhost(
  dataTransfer: {
    setDragImage?: (image: Element, x: number, y: number) => void;
  },
  label: string,
) {
  if (typeof document === 'undefined' || !dataTransfer.setDragImage) return;
  const ghost = document.createElement('div');
  ghost.textContent = `⠿  ${label}`;
  ghost.setAttribute(
    'style',
    [
      'position:fixed',
      'top:-1000px',
      'left:-1000px',
      'padding:6px 10px',
      'border-radius:8px',
      `background:${colors.bgElevated}`,
      `color:${colors.primary}`,
      `border:1px solid ${colors.primaryMid}`,
      'font:600 12px/1.2 system-ui,sans-serif',
      'box-shadow:0 6px 18px rgba(11,31,51,0.14)',
      'opacity:0.95',
      'pointer-events:none',
      'white-space:nowrap',
      'z-index:99999',
    ].join(';'),
  );
  document.body.appendChild(ghost);
  dataTransfer.setDragImage(ghost, 16, 14);
  requestAnimationFrame(() => {
    ghost.remove();
  });
}

/**
 * Inventory sheet column header — discreet grab handle + optional ◂/▸.
 * Desktop web: hover-revealed handle, custom drag ghost, subtle drop target.
 * Touch / mobile web / native: visible handle; tap/long-press → ◂/▸.
 * Handle sits inline with the label so the header reads as one row.
 */
export function InventoryColumnHead({
  col,
  style,
  dropTarget,
  dragging,
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
  const desktop = useDesktopPointer();
  const [hovered, setHovered] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  /** Skip arming onPress after an HTML5 drag (mouseup still fires press). */
  const skippedPressAfterDrag = useRef(false);
  const wrapRef = useRef<View>(null);

  const handleEmphasis =
    !desktop || hovered || armed || dragging || grabbing;

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
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
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
            setDragImage?: (image: Element, x: number, y: number) => void;
          };
        }) => {
          e.stopPropagation?.();
          skippedPressAfterDrag.current = true;
          setGrabbing(true);
          e.dataTransfer?.setData?.('text/plain', col);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
          // Prefer a short readable ghost from the header label when possible.
          let ghostLabel: string = col;
          try {
            const node = wrapRef.current as unknown as {
              textContent?: string;
            } | null;
            const raw = (node?.textContent ?? '')
              .replace(/[⠿◂▸]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (raw) ghostLabel = raw.length > 22 ? `${raw.slice(0, 20)}…` : raw;
          } catch {
            /* ignore */
          }
          if (e.dataTransfer) setCleanDragGhost(e.dataTransfer, ghostLabel);
          onDragStartCol?.(col);
        },
        onDragEnd: () => {
          setGrabbing(false);
          onDragEnd?.();
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
      ref={wrapRef}
      style={[
        styles.wrap,
        style,
        dropTarget && styles.dropTarget,
        (dragging || grabbing) && styles.draggingSource,
        armed && styles.armed,
        isWeb && desktop
          ? ({
              // Soft hover wash so the handle “belongs” to the header.
              ...(hovered && !dragging && !dropTarget
                ? { backgroundColor: 'rgba(11, 79, 138, 0.06)' }
                : null),
            } as object)
          : null,
      ]}
      {...dropProps}
    >
      <View style={styles.inner}>
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
            // Desktop already has HTML5 drag — skip ◂/▸ arming on click
            // so headers don’t jump. Touch / coarse pointer still arms.
            if (desktop) return;
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
            handleEmphasis && styles.handleReady,
            (pressed || armed || grabbing) && styles.handleActive,
            isWeb
              ? ({
                  cursor: grabbing || dragging ? 'grabbing' : 'grab',
                } as object)
              : null,
          ]}
        >
          <Text
            style={[
              styles.handleGlyph,
              !handleEmphasis && styles.handleGlyphQuiet,
            ]}
            accessible={false}
          >
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
        <View style={styles.body}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          transitionProperty: 'background-color, opacity, box-shadow',
          transitionDuration: '120ms',
          userSelect: 'none',
        } as object)
      : null),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 2,
  },
  dropTarget: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `inset 3px 0 0 ${colors.primary}`,
        } as object)
      : {
          borderLeftWidth: 3,
          borderLeftColor: colors.primary,
        }),
  },
  draggingSource: {
    opacity: 0.4,
  },
  armed: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
  },
  handle: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    // Reserved footprint so hover emphasis never jumps layout.
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  handleReady: {
    backgroundColor: 'rgba(11, 79, 138, 0.08)',
    borderColor: 'rgba(26, 107, 176, 0.35)',
  },
  handleActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  handleGlyph: {
    fontSize: 12,
    lineHeight: 14,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: -1,
    opacity: 0.9,
  },
  handleGlyphQuiet: {
    opacity: 0.28,
  },
  nudge: {
    paddingHorizontal: 2,
    minWidth: 16,
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  nudgeDim: { opacity: 0.35 },
  nudgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    lineHeight: 14,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
});
