import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UnitCode } from '../data/types';

export type UnitSystem = 'metric' | 'imperial';

const STORAGE_KEY = 'invis.unitSystem';

/** POS stores metric; convert for display / input when imperial. */
export const KG_PER_LB = 0.45359237;
export const LB_PER_KG = 2.2046226218;
export const L_PER_FLOZ = 0.0295735295625;
export const FLOZ_PER_L = 33.814022701;

type UnitSystemApi = {
  unitSystem: UnitSystem;
  setUnitSystem: (next: UnitSystem) => void;
  ready: boolean;
  /** Label for a POS unit in the active system */
  displayUnit: (code: UnitCode | string | null | undefined) => string;
  /** Convert stored metric qty → display qty for this unit */
  toDisplayQty: (
    code: UnitCode | string | null | undefined,
    qty: number,
  ) => number;
  /** Convert display qty → stored metric qty for this unit */
  toStorageQty: (
    code: UnitCode | string | null | undefined,
    displayQty: number,
  ) => number;
  /** Format a number for UI (1–3 decimals) */
  formatQty: (n: number) => string;
};

const UnitSystemContext = createContext<UnitSystemApi | null>(null);

function isWeight(code: string) {
  return code === 'KG';
}

function isVolume(code: string) {
  return code === 'L';
}

export function UnitSystemProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (
          !cancelled &&
          (stored === 'metric' || stored === 'imperial')
        ) {
          setUnitSystemState(stored);
        }
      } catch {
        // keep default
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setUnitSystem = useCallback((next: UnitSystem) => {
    setUnitSystemState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const displayUnit = useCallback(
    (code: UnitCode | string | null | undefined) => {
      if (!code) return '';
      if (unitSystem === 'imperial') {
        if (isWeight(code)) return 'lb';
        if (isVolume(code)) return 'fl oz';
      }
      return code;
    },
    [unitSystem],
  );

  const toDisplayQty = useCallback(
    (code: UnitCode | string | null | undefined, qty: number) => {
      if (!code || unitSystem === 'metric') return qty;
      if (isWeight(code)) return qty * LB_PER_KG;
      if (isVolume(code)) return qty * FLOZ_PER_L;
      return qty;
    },
    [unitSystem],
  );

  const toStorageQty = useCallback(
    (code: UnitCode | string | null | undefined, displayQty: number) => {
      if (!code || unitSystem === 'metric') return displayQty;
      if (isWeight(code)) return displayQty * KG_PER_LB;
      if (isVolume(code)) return displayQty * L_PER_FLOZ;
      return displayQty;
    },
    [unitSystem],
  );

  const formatQty = useCallback((n: number) => {
    const rounded = Math.round(n * 1000) / 1000;
    // Keep integer trailing zeros (50 ≠ "5"). String() already drops fractional .0s.
    return String(rounded);
  }, []);

  const value = useMemo(
    () => ({
      unitSystem,
      setUnitSystem,
      ready,
      displayUnit,
      toDisplayQty,
      toStorageQty,
      formatQty,
    }),
    [
      unitSystem,
      setUnitSystem,
      ready,
      displayUnit,
      toDisplayQty,
      toStorageQty,
      formatQty,
    ],
  );

  return (
    <UnitSystemContext.Provider value={value}>
      {children}
    </UnitSystemContext.Provider>
  );
}

export function useUnitSystem(): UnitSystemApi {
  const ctx = useContext(UnitSystemContext);
  if (!ctx) {
    throw new Error('useUnitSystem must be used within UnitSystemProvider');
  }
  return ctx;
}
