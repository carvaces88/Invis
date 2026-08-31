import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

/** Matches assets/invis-logo.png charcoal + sage mark */
const INK = '#1A1A1A';
const HANDLE = '#FFFFFF';
const ITEM = '#8B9A78';
const INTERIOR = '#FFFFFF';

const SIZE = 72;
const BODY_LEFT = 30;
const BODY_WIDTH = 36;
const BODY_TOP = 8;
const BODY_HEIGHT = 56;

/** Closed → open: left-hinged swing toward camera / left. */
const OPEN_ANGLE = '-75deg';

type Props = {
  accessibilityLabel: string;
  size?: number;
};

/**
 * Brand fridge mark with a looping hinged door open/close.
 * One door panel rotates on Y with left-edge hinge — normal fridge swing.
 */
export function AnimatedFridgeLogo({
  accessibilityLabel,
  size = SIZE,
}: Props) {
  const open = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;

    const doorEase = Easing.bezier(0.45, 0.05, 0.25, 1);

    const runLoop = () => {
      loop?.stop();
      open.setValue(1);
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(2600),
          Animated.timing(open, {
            toValue: 0,
            duration: 880,
            easing: doorEase,
            useNativeDriver: true,
          }),
          Animated.delay(1600),
          Animated.timing(open, {
            toValue: 1,
            duration: 960,
            easing: doorEase,
            useNativeDriver: true,
          }),
          Animated.delay(2200),
        ]),
      );
      loop.start();
    };

    async function start() {
      const reduce = await AccessibilityInfo.isReduceMotionEnabled();
      if (cancelled) return;
      if (reduce) {
        open.setValue(1);
        return;
      }
      runLoop();
    }

    start();
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (cancelled) return;
        if (enabled) {
          loop?.stop();
          open.setValue(1);
        } else {
          runLoop();
        }
      },
    );

    return () => {
      cancelled = true;
      loop?.stop();
      sub.remove();
    };
  }, [open]);

  const doorRotateY = open.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', OPEN_ANGLE],
  });

  const handleOpacity = open.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 0.85, 1],
  });

  const scale = size / SIZE;

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={[
          styles.stage,
          scale !== 1 ? { transform: [{ scale }] } : null,
        ]}
      >
        <View style={styles.body}>
          <View style={styles.shelf} />
          <View style={[styles.shelf, styles.shelfMid]} />
          <View style={[styles.item, styles.bottle]} />
          <View style={[styles.item, styles.jar]} />
          <View style={[styles.item, styles.tub]} />
        </View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.door,
            {
              // RN 0.86+ — hinge on left edge of the door
              transformOrigin: 'left center',
              transform: [
                { perspective: 1100 },
                { rotateY: doorRotateY },
              ],
            },
          ]}
        >
          <View style={styles.doorEdge} />
          <Animated.View
            style={[styles.handle, { opacity: handleOpacity }]}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'visible',
  },
  stage: {
    width: SIZE,
    height: SIZE,
    overflow: 'visible',
    ...Platform.select({
      web: { perspective: 1100 } as object,
      default: {},
    }),
  },
  body: {
    position: 'absolute',
    left: BODY_LEFT,
    top: BODY_TOP,
    width: BODY_WIDTH,
    height: BODY_HEIGHT,
    borderRadius: 8,
    borderWidth: 3.5,
    borderColor: INK,
    backgroundColor: INTERIOR,
    overflow: 'hidden',
  },
  shelf: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 18,
    height: 2,
    backgroundColor: INK,
    opacity: 0.8,
  },
  shelfMid: {
    top: 34,
  },
  item: {
    position: 'absolute',
    backgroundColor: ITEM,
  },
  bottle: {
    left: 11,
    top: 5,
    width: 8,
    height: 11,
    borderRadius: 2,
  },
  jar: {
    left: 12,
    top: 21,
    width: 10,
    height: 9,
    borderRadius: 5,
  },
  tub: {
    left: 9,
    top: 38,
    width: 14,
    height: 9,
    borderRadius: 2,
  },
  door: {
    position: 'absolute',
    left: BODY_LEFT,
    top: BODY_TOP,
    width: BODY_WIDTH,
    height: BODY_HEIGHT,
    borderRadius: 7,
    backgroundColor: INK,
    backfaceVisibility: 'hidden',
    zIndex: 2,
    ...Platform.select({
      web: { transformStyle: 'preserve-3d' } as object,
      default: {},
    }),
  },
  doorEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
    backgroundColor: '#0D0D0D',
  },
  handle: {
    position: 'absolute',
    right: 7,
    top: 22,
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: HANDLE,
  },
});
