import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';

export type ChefNudgeKind = 'yes' | 'thinking';

type ChefNudgeApi = {
  /** Quick ack bubble — “Yes chef!” */
  yesChef: () => void;
  /** Loading nudge — “I'm thinking, chef” */
  thinkingChef: (visible?: boolean) => void;
};

const ChefNudgeContext = createContext<ChefNudgeApi | null>(null);

export function ChefNudgeProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<ChefNudgeKind | null>(null);
  const [thinkingSticky, setThinkingSticky] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateIn = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  const animateOut = useCallback(
    (after?: () => void) => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) after?.();
      });
    },
    [opacity],
  );

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const yesChef = useCallback(() => {
    clearHideTimer();
    setThinkingSticky(false);
    setKind('yes');
    opacity.setValue(0);
    animateIn();
    hideTimer.current = setTimeout(() => {
      animateOut(() => setKind(null));
    }, 1200);
  }, [animateIn, animateOut, clearHideTimer, opacity]);

  const thinkingChef = useCallback(
    (visible = true) => {
      clearHideTimer();
      if (visible) {
        setThinkingSticky(true);
        setKind('thinking');
        opacity.setValue(0);
        animateIn();
      } else {
        setThinkingSticky(false);
        animateOut(() => setKind(null));
      }
    },
    [animateIn, animateOut, clearHideTimer, opacity],
  );

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const api = useMemo(
    () => ({ yesChef, thinkingChef }),
    [yesChef, thinkingChef],
  );

  const label =
    kind === 'yes'
      ? t('chefYes')
      : kind === 'thinking'
        ? t('chefThinking')
        : '';

  const showBubble = kind != null && (kind === 'yes' || thinkingSticky);

  return (
    <ChefNudgeContext.Provider value={api}>
      {children}
      {showBubble ? (
        <View pointerEvents="none" style={styles.host}>
          <Animated.View
            style={[
              styles.bubble,
              kind === 'thinking' && styles.bubbleThinking,
              { opacity },
            ]}
          >
            <Text style={styles.bubbleText}>{label}</Text>
          </Animated.View>
        </View>
      ) : null}
    </ChefNudgeContext.Provider>
  );
}

export function useChefNudge() {
  const ctx = useContext(ChefNudgeContext);
  if (!ctx) {
    return {
      yesChef: () => undefined,
      thinkingChef: () => undefined,
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  bubble: {
    maxWidth: '86%',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    shadowColor: '#0B1F33',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bubbleThinking: {
    backgroundColor: colors.primaryMid,
  },
  bubbleText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
