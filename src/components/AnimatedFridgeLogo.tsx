import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
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
const DOOR_W = 28;

type Props = {
  accessibilityLabel: string;
  size?: number;
};

/**
 * Brand fridge mark with a subtle looping door open/close.
 * View-composed (RN Animated only) so web + native stay light.
 */
export function AnimatedFridgeLogo({
  accessibilityLabel,
  size = SIZE,
}: Props) {
  const open = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;

    const runLoop = () => {
      loop?.stop();
      open.setValue(1);
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(2800),
          Animated.timing(open, {
            toValue: 0,
            duration: 920,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(1200),
          Animated.timing(open, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(3400),
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

  // Cover door: hinged at body left — scaleX 1 closed over interior, ~0 open.
  const coverScaleX = open.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.04],
  });

  // Open door panel sits left of the hinge (brand pose); fades as it closes.
  const openDoorOpacity = open.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.15, 1],
  });
  const openDoorX = open.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const openDoorRotate = open.interpolate({
    inputRange: [0, 1],
    outputRange: ['-4deg', '-12deg'],
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

        {/* Closing cover — pivot from left edge of body */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.cover,
            {
              // Pivot from left edge (hinge at body left)
              transform: [
                { translateX: BODY_WIDTH / 2 },
                { scaleX: coverScaleX },
                { translateX: -BODY_WIDTH / 2 },
              ],
            },
          ]}
        />

        {/* Brand open-door silhouette */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.openDoor,
            {
              opacity: openDoorOpacity,
              transform: [
                { translateX: openDoorX },
                { rotate: openDoorRotate },
              ],
            },
          ]}
        >
          <View style={styles.openHandle} />
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
  cover: {
    position: 'absolute',
    left: BODY_LEFT,
    top: BODY_TOP,
    width: BODY_WIDTH,
    height: BODY_HEIGHT,
    borderRadius: 7,
    backgroundColor: INK,
  },
  openDoor: {
    position: 'absolute',
    left: BODY_LEFT - DOOR_W + 2,
    top: BODY_TOP,
    width: DOOR_W,
    height: BODY_HEIGHT,
    borderRadius: 7,
    backgroundColor: INK,
  },
  openHandle: {
    position: 'absolute',
    right: 7,
    top: 22,
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: HANDLE,
  },
});
