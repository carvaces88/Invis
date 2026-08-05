import type { RecentAddWarning } from '../data/store';
import type { MessageKey } from '../i18n';
import { alertConfirm } from './alertAck';

type TFn = (key: MessageKey) => string;

/** Soft-confirm when the same product+place was added within the recent window. */
export function confirmIfRecentAdd(
  warning: RecentAddWarning | null,
  t: TFn,
  onProceed: () => void,
) {
  if (!warning) {
    onProceed();
    return;
  }
  alertConfirm(
    t('recentAddWarnTitle'),
    t('recentAddWarnBody')
      .replace('{minutes}', String(warning.minutesAgo))
      .replace('{delta}', String(warning.lastDelta).replace('.', ',')),
    {
      confirmLabel: t('recentAddWarnYes'),
      cancelLabel: t('cancel'),
      onConfirm: onProceed,
    },
  );
}
