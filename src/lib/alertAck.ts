import { Alert, Platform } from 'react-native';

/**
 * Show an OK acknowledgment. On react-native-web, Alert.alert is a no-op,
 * so use window.alert and then run `onOk`.
 */
export function alertAck(
  title: string,
  message: string,
  onOk?: () => void,
) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    onOk?.();
    return;
  }
  Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
}

/** Error / info alert — on web falls back to window.alert so the user still sees it. */
export function alertInfo(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    return;
  }
  Alert.alert(title, message);
}

/** Confirm / cancel. On web uses window.confirm. */
export function alertConfirm(
  title: string,
  message: string,
  opts: {
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  },
) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`${title}\n\n${message}`);
      if (ok) opts.onConfirm();
      else opts.onCancel?.();
    } else {
      opts.onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    {
      text: opts.cancelLabel ?? 'Cancel',
      style: 'cancel',
      onPress: opts.onCancel,
    },
    {
      text: opts.confirmLabel ?? 'OK',
      style: opts.destructive ? 'destructive' : 'default',
      onPress: opts.onConfirm,
    },
  ]);
}
