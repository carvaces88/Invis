import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColumnReorderSheet } from '../components/ColumnReorderSheet';
import { ExportColumnsSheet } from '../components/ExportColumnsSheet';
import { InventoryColumnHead } from '../components/InventoryColumnHead';
import { PlaceSelect } from '../components/PlaceSelect';
import {
  StorageTypeSelect,
  storageTypeLabelKey,
} from '../components/StorageTypeSelect';
import { UnitColumnLegend } from '../components/UnitColumnLegend';
import { lineTotal, sessionTotals, useInventory } from '../data/store';
import { resolveStorageType } from '../data/storageTypes';
import type {
  InventoryLine,
  RootStackParamList,
  StorageType,
} from '../data/types';
import { useI18n } from '../i18n';
import { alertAck, alertConfirm, alertInfo } from '../lib/alertAck';
import {
  applyColumnOrder,
  columnOrdersEqual,
  moveColumnBy,
  moveColumnTo,
} from '../lib/export/columnOrder';
import { exportSessionDocx } from '../lib/export/docx';
import { exportSessionExcel } from '../lib/export/excel';
import { exportSessionPdf } from '../lib/export/pdf';
import {
  DEFAULT_VIEW_PROFILE,
  cellDisplay,
  columnHeader,
  getExportProfile,
  profileTitleKey,
  RESTOLUTION_FI_HEADERS,
  type ExportCellContext,
  type ExportColumnId,
  type ExportProfileId,
} from '../lib/export/profiles';
import {
  clearColumnOrder,
  loadColumnOrders,
  loadViewProfile,
  saveColumnOrder,
  saveViewProfile,
  type ColumnOrderByProfile,
} from '../lib/export/viewProfileStorage';
import { FOOD_ALV_RATE, formatMoney } from '../lib/alv';
import { formatUpdatedLabel } from '../lib/relativeTime';
import {
  isDictationAvailable,
  startDictation,
  type DictationSession,
} from '../lib/speechDictation';
import { useUnitSystem } from '../lib/unitSystem';
import { colors, radius, shadows, spacing, surfaces } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/** Matches App.tsx tabBar height so last rows clear the bottom tabs. */
const TAB_BAR_CLEARANCE = 72;

type ExportKind = 'xlsx' | 'pdf' | 'docx';

/** Re-export for callers that imported from this screen */
export { FOOD_ALV_RATE } from '../lib/alv';

function money(n: number) {
  return formatMoney(n);
}

/** Product code column — collapsed by default to save sheet width. */
const PRODUCT_CODE_W_EXPANDED = 110;
const PRODUCT_CODE_W_COLLAPSED = 36;

/** Restolution export keeps its fixed import columns; on-screen view adds Storage. */
function withViewStorageColumn(columns: ExportColumnId[]): ExportColumnId[] {
  if (columns.includes('storage')) return columns;
  const nameIdx = columns.indexOf('name');
  if (nameIdx >= 0) {
    return [
      ...columns.slice(0, nameIdx + 1),
      'storage',
      ...columns.slice(nameIdx + 1),
    ];
  }
  return ['storage', ...columns];
}

function colStyle(
  col: ExportColumnId,
  opts?: { productCodeOpen?: boolean },
) {
  switch (col) {
    case 'name':
      return styles.colName;
    case 'unit':
      return styles.colUnit;
    case 'storage':
      return styles.colStorage;
    case 'qty':
      return styles.colQty;
    case 'price':
      return styles.colPrice;
    case 'total':
      return styles.colTotal;
    case 'date':
      return styles.colDate;
    case 'productCode':
      return opts?.productCodeOpen ? styles.colCode : styles.colCodeCollapsed;
    case 'openingStock':
    case 'purchases':
    case 'closingStock':
    case 'usage':
    case 'need':
    case 'variance':
      return styles.colMove;
    case 'turnover':
      return styles.colTurnover;
  }
}

/** Header label alignment only — column width lives on InventoryColumnHead. */
function colHeadAlign(col: ExportColumnId) {
  switch (col) {
    case 'unit':
      return styles.headAlignCenter;
    case 'qty':
    case 'price':
    case 'total':
    case 'openingStock':
    case 'purchases':
    case 'closingStock':
    case 'usage':
    case 'need':
    case 'variance':
    case 'turnover':
      return styles.headAlignRight;
    default:
      return styles.headAlignLeft;
  }
}

function tableMinWidth(
  columns: ExportColumnId[],
  productCodeOpen = false,
): number {
  return columns.reduce((sum, col) => {
    switch (col) {
      case 'name':
        return sum + 200;
      case 'unit':
        return sum + 64;
      case 'storage':
        return sum + 100;
      case 'qty':
        return sum + 48;
      case 'price':
      case 'total':
        return sum + 52;
      case 'date':
        return sum + 88;
      case 'productCode':
        return (
          sum +
          (productCodeOpen ? PRODUCT_CODE_W_EXPANDED : PRODUCT_CODE_W_COLLAPSED)
        );
      case 'openingStock':
      case 'purchases':
      case 'closingStock':
      case 'usage':
      case 'need':
      case 'variance':
        return sum + 96;
      case 'turnover':
        return sum + 112;
      default:
        return sum + 56;
    }
  }, 24);
}

export function InventaarioScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    session,
    products,
    places,
    siteName,
    movements,
    recipes,
    periodSnapshot,
    updateLineQuantity,
    clearAllInventory,
    getOpeningQuantity,
  } = useInventory();
  const { t, strings, locale } = useI18n();
  const { displayUnit, toDisplayQty, toStorageQty, formatQty } = useUnitSystem();
  const [storageFilter, setStorageFilter] = useState<StorageType | 'all'>(
    'all',
  );
  const [placeFilter, setPlaceFilter] = useState<string | 'all'>('all');
  const [compareMonths, setCompareMonths] = useState(false);
  /** nameAsc / nameDesc = A–Z / Z–A (keeps qty+price on the row); place = default */
  const [nameSort, setNameSort] = useState<'place' | 'az' | 'za'>('place');
  const placesForFilter = useMemo(() => {
    if (storageFilter === 'all') return places;
    return places.filter((p) => resolveStorageType(p) === storageFilter);
  }, [places, storageFilter]);

  useEffect(() => {
    if (placeFilter === 'all') return;
    if (!placesForFilter.some((p) => p.id === placeFilter)) {
      setPlaceFilter('all');
    }
  }, [placeFilter, placesForFilter]);

  const placeIdForTotals = placeFilter === 'all' ? null : placeFilter;
  const totals = useMemo(
    () => sessionTotals(session, placeIdForTotals),
    [session, placeIdForTotals],
  );
  const placeById = useMemo(
    () => new Map(places.map((p) => [p.id, p])),
    [places],
  );
  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const exportCtx = useMemo(
    () => ({ movements, products, recipes, periodSnapshot }),
    [movements, products, recipes, periodSnapshot],
  );
  const cellCtx: ExportCellContext = useMemo(
    () => ({ session, ...exportCtx }),
    [session, exportCtx],
  );
  /** Product code values hidden until the column header is tapped. */
  const [productCodeOpen, setProductCodeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportKind, setExportKind] = useState<ExportKind | null>(null);
  const [columnsSheetOpen, setColumnsSheetOpen] = useState(false);
  const [reorderSheetOpen, setReorderSheetOpen] = useState(false);
  const [viewProfileId, setViewProfileId] = useState<ExportProfileId>(
    DEFAULT_VIEW_PROFILE,
  );
  /** Per-profile on-screen column order overrides (export profiles stay fixed). */
  const [columnOrders, setColumnOrders] = useState<ColumnOrderByProfile>({});
  const [draggingCol, setDraggingCol] = useState<ExportColumnId | null>(null);
  const [dropTargetCol, setDropTargetCol] = useState<ExportColumnId | null>(
    null,
  );
  /** Long-press / tap grab handle arms ◂/▸ nudges for this column. */
  const [armedCol, setArmedCol] = useState<ExportColumnId | null>(null);
  const draggingColRef = useRef<ExportColumnId | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState('');
  const [showFullSheet, setShowFullSheet] = useState(false);
  /** false = 0% ALV (stored), true = display with food ALV */
  const [showWithAlv, setShowWithAlv] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  /** Extra actions (verify / scratch) stay collapsed so the sheet gets height. */
  const [toolsOpen, setToolsOpen] = useState(false);
  /** Explicit pixel height — nested H-ScrollView + FlatList needs a bound on web. */
  const [listHeight, setListHeight] = useState(0);
  const [micListening, setMicListening] = useState(false);
  const micSessionRef = useRef<DictationSession | null>(null);
  const dictationOk = isDictationAvailable();

  useEffect(() => {
    return () => {
      const s = micSessionRef.current;
      micSessionRef.current = null;
      if (s?.active) void s.stop().catch(() => {});
    };
  }, []);

  async function toggleSearchMic() {
    if (!dictationOk) {
      alertInfo(t('voiceDictateLabel'), t('voiceUnsupported'));
      return;
    }
    if (micListening && micSessionRef.current) {
      try {
        const text = await micSessionRef.current.stop();
        micSessionRef.current = null;
        setMicListening(false);
        if (text.trim()) setSearchQuery(text.trim());
      } catch (e) {
        micSessionRef.current = null;
        setMicListening(false);
        alertInfo(
          t('voiceDictateLabel'),
          e instanceof Error ? e.message : t('voiceFailed'),
        );
      }
      return;
    }
    try {
      const session = await startDictation({
        language: locale === 'fi' ? 'fi' : 'en',
        onPartial: (text) => {
          if (text) setSearchQuery(text);
        },
      });
      micSessionRef.current = session;
      setMicListening(true);
    } catch (e) {
      alertInfo(
        t('voiceDictateLabel'),
        e instanceof Error ? e.message : t('voiceFailed'),
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadViewProfile(), loadColumnOrders()]).then(
      ([id, orders]) => {
        if (cancelled) return;
        setViewProfileId(id);
        setColumnOrders(orders);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const viewProfile = useMemo(
    () => getExportProfile(viewProfileId),
    [viewProfileId],
  );
  /** Profile default on-screen columns (Storage always injected). */
  const defaultColumns = useMemo(
    () => withViewStorageColumn(viewProfile.columns),
    [viewProfile.columns],
  );
  /** On-screen columns — profile defaults + optional user drag order. */
  const columns = useMemo(
    () => applyColumnOrder(defaultColumns, columnOrders[viewProfileId]),
    [defaultColumns, columnOrders, viewProfileId],
  );
  const columnOrderCustomized = !columnOrdersEqual(columns, defaultColumns);
  const showPriceCols =
    columns.includes('price') || columns.includes('total');
  const needsHScroll = viewProfileId === 'restolution' || columns.length > 5;
  const minTableWidth = tableMinWidth(columns, productCodeOpen);
  const colOpts = useMemo(
    () => ({ productCodeOpen }),
    [productCodeOpen],
  );

  const alvFactor = showWithAlv && showPriceCols ? 1 + FOOD_ALV_RATE : 1;
  const alvPercentLabel = String(Math.round(FOOD_ALV_RATE * 100));

  const recordedCount = useMemo(() => {
    let lines = session.lines;
    if (storageFilter !== 'all') {
      const ids = new Set(placesForFilter.map((p) => p.id));
      lines = lines.filter((l) => ids.has(l.placeId));
    }
    if (placeFilter !== 'all') {
      lines = lines.filter((l) => l.placeId === placeFilter);
    }
    return lines.filter((l) => l.quantity != null).length;
  }, [session.lines, placeFilter, storageFilter, placesForFilter]);

  const visibleLines = useMemo(() => {
    let lines = session.lines;
    if (storageFilter !== 'all') {
      const ids = new Set(placesForFilter.map((p) => p.id));
      lines = lines.filter((l) => ids.has(l.placeId));
    }
    if (placeFilter !== 'all') {
      lines = lines.filter((l) => l.placeId === placeFilter);
    }
    const sorted = [...lines].sort((a, b) => {
      const aSet = a.quantity != null ? 0 : 1;
      const bSet = b.quantity != null ? 0 : 1;
      if (aSet !== bSet) return aSet - bSet;
      if (nameSort === 'az') {
        return a.officialName.localeCompare(b.officialName, 'fi', {
          sensitivity: 'base',
        });
      }
      if (nameSort === 'za') {
        return b.officialName.localeCompare(a.officialName, 'fi', {
          sensitivity: 'base',
        });
      }
      if (placeFilter === 'all' && a.placeId !== b.placeId) {
        const ao = placeById.get(a.placeId)?.sortOrder ?? 0;
        const bo = placeById.get(b.placeId)?.sortOrder ?? 0;
        if (ao !== bo) return ao - bo;
      }
      return a.officialName.localeCompare(b.officialName, 'fi', {
        sensitivity: 'base',
      });
    });
    const modeFiltered = showFullSheet
      ? sorted
      : sorted.filter((l) => l.quantity != null);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return modeFiltered;
    return modeFiltered.filter((l) => {
      if (l.officialName.toLowerCase().includes(q)) return true;
      const code = productById.get(l.productId);
      const productCode = (
        code?.productCode ?? code?.ean ?? ''
      ).toLowerCase();
      if (productCode && productCode.includes(q)) return true;
      const aliases = code?.aliases;
      return (
        aliases?.some((a) => a.toLowerCase().includes(q)) ?? false
      );
    });
  }, [
    session.lines,
    showFullSheet,
    placeFilter,
    storageFilter,
    placesForFilter,
    placeById,
    productById,
    searchQuery,
    nameSort,
  ]);

  const needsHScrollEffective =
    needsHScroll || compareMonths || columns.length > 4;
  const minTableWidthEffective =
    minTableWidth + (compareMonths ? 200 : 0);

  const searchActive = searchQuery.trim().length > 0;

  function productAliases(
    productId: string,
    officialName: string,
  ): string[] {
    const product = productById.get(productId);
    if (!product?.aliases?.length) return [];
    const officialLower = officialName.toLowerCase();
    return product.aliases.filter(
      (a) => a.trim() && a.toLowerCase() !== officialLower,
    );
  }

  /** One-line list preview (capped); full string for tooltip / long-press. */
  function aliasesLabels(
    productId: string,
    officialName: string,
  ): { preview: string; full: string } | null {
    const aliases = productAliases(productId, officialName);
    if (!aliases.length) return null;
    const shown = aliases.slice(0, 4);
    const more = aliases.length > shown.length ? '…' : '';
    return {
      preview: `${t('alsoAs')} ${shown.join(', ')}${more}`,
      full: `${t('alsoAs')} ${aliases.join(', ')}`,
    };
  }

  function webTitleProps(title: string | undefined) {
    if (Platform.OS !== 'web' || !title) return undefined;
    return { title } as { title: string };
  }

  function applyViewProfile(profileId: ExportProfileId) {
    setViewProfileId(profileId);
    setArmedCol(null);
    draggingColRef.current = null;
    setDraggingCol(null);
    setDropTargetCol(null);
    setColumnsSheetOpen(false);
    void saveViewProfile(profileId);
  }

  function persistColumnOrder(next: ExportColumnId[]) {
    setColumnOrders((prev) => ({ ...prev, [viewProfileId]: next }));
    void saveColumnOrder(viewProfileId, next);
  }

  function reorderColumn(from: ExportColumnId, to: ExportColumnId) {
    const next = moveColumnTo(columns, from, to);
    if (columnOrdersEqual(next, columns)) return;
    persistColumnOrder(next);
  }

  function nudgeColumn(col: ExportColumnId, delta: -1 | 1) {
    const next = moveColumnBy(columns, col, delta);
    if (columnOrdersEqual(next, columns)) return;
    persistColumnOrder(next);
  }

  function resetColumnOrder() {
    setArmedCol(null);
    setColumnOrders((prev) => {
      const next = { ...prev };
      delete next[viewProfileId];
      return next;
    });
    void clearColumnOrder(viewProfileId);
  }

  async function runExport(kind: ExportKind, profileId: ExportProfileId) {
    try {
      setExporting(true);
      if (kind === 'xlsx') {
        await exportSessionExcel(session, strings, profileId, exportCtx);
      } else if (kind === 'pdf') {
        await exportSessionPdf(session, strings, profileId, exportCtx);
      } else {
        await exportSessionDocx(session, strings, profileId, exportCtx);
      }
      setExportKind(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : t('exportFailed');
      alertInfo(
        t('export'),
        kind === 'docx'
          ? `${t('exportDocxFailed')} (${message})`
          : message,
      );
    } finally {
      setExporting(false);
    }
  }

  function formatLineQty(unit: InventoryLine['unit'], qty: number | null | undefined) {
    if (qty == null) return '—';
    return formatQty(toDisplayQty(unit, qty)).replace('.', ',');
  }

  function renderQtyEditor(
    item: InventoryLine,
    editing: boolean,
    wide = false,
  ) {
    return (
      <View style={wide ? styles.colMove : styles.colQty}>
        {editing ? (
          <TextInput
            value={draftQty}
            onChangeText={setDraftQty}
            keyboardType="decimal-pad"
            autoFocus
            onBlur={() => {
              const n =
                draftQty.trim() === ''
                  ? null
                  : Number(draftQty.replace(',', '.'));
              const stored =
                n == null || Number.isNaN(n)
                  ? null
                  : toStorageQty(item.unit, n);
              updateLineQuantity(item.id, stored);
              setEditingId(null);
            }}
            style={styles.qtyInput}
          />
        ) : (
          <Text style={[styles.td, styles.num]}>
            {formatLineQty(item.unit, item.quantity)}
          </Text>
        )}
      </View>
    );
  }

  function renderLastMonthQty(item: InventoryLine, wide = false) {
    const opening = getOpeningQuantity(item.productId, item.placeId);
    return (
      <View style={wide ? styles.colMove : styles.colQty}>
        <Text style={[styles.td, styles.num, styles.lastMonthQty]}>
          {formatLineQty(item.unit, opening ?? null)}
        </Text>
      </View>
    );
  }

  function renderCell(col: ExportColumnId, item: InventoryLine, editing: boolean) {
    switch (col) {
      case 'name': {
        const alsoAs = aliasesLabels(item.productId, item.officialName);
        const uncounted = item.quantity == null;
        const placeName =
          placeFilter === 'all'
            ? placeById.get(item.placeId)?.name
            : undefined;
        return (
          <View key={col} style={styles.colName}>
            <Text
              style={styles.td}
              numberOfLines={2}
              accessibilityLabel={item.officialName}
              {...webTitleProps(item.officialName)}
            >
              {item.officialName}
            </Text>
            {placeName ? (
              <Text
                style={styles.placeTag}
                numberOfLines={1}
                {...webTitleProps(placeName)}
              >
                {placeName}
              </Text>
            ) : null}
            {alsoAs ? (
              <Pressable
                onLongPress={
                  Platform.OS !== 'web'
                    ? () => alertInfo(item.officialName, alsoAs.full)
                    : undefined
                }
                delayLongPress={350}
                accessibilityRole="text"
                accessibilityLabel={alsoAs.full}
                accessibilityHint={
                  Platform.OS !== 'web' ? alsoAs.full : undefined
                }
                {...webTitleProps(alsoAs.full)}
              >
                <Text style={styles.alias} numberOfLines={1}>
                  {alsoAs.preview}
                </Text>
              </Pressable>
            ) : null}
            {uncounted ? (
              <Text style={styles.uncounted}>{t('notCountedYet')}</Text>
            ) : null}
            {!uncounted
              ? (() => {
                  const updated = formatUpdatedLabel(
                    item.lastUpdatedAt ?? item.countedAt,
                    locale,
                  );
                  return updated ? (
                    <Text style={styles.updatedAt} numberOfLines={1}>
                      {updated}
                    </Text>
                  ) : null;
                })()
              : null}
          </View>
        );
      }
      case 'unit':
        return (
          <Text key={col} style={[styles.td, styles.colUnit]}>
            {displayUnit(item.unit)}
          </Text>
        );
      case 'storage': {
        const place = placeById.get(item.placeId);
        const label = place
          ? t(storageTypeLabelKey(resolveStorageType(place)))
          : '—';
        return (
          <Text
            key={col}
            style={[styles.td, styles.colStorage, styles.storageCell]}
            numberOfLines={2}
            {...webTitleProps(label)}
          >
            {label}
          </Text>
        );
      }
      case 'qty':
      case 'closingStock': {
        const wideQty = col === 'closingStock';
        if (compareMonths) {
          return (
            <React.Fragment key={col}>
              {renderLastMonthQty(item, wideQty)}
              {renderQtyEditor(item, editing, wideQty)}
            </React.Fragment>
          );
        }
        return (
          <View key={col}>{renderQtyEditor(item, editing, wideQty)}</View>
        );
      }
      case 'price':
        return (
          <Text key={col} style={[styles.td, styles.colPrice, styles.num]}>
            {money(item.unitPriceAlv0 * alvFactor)}
          </Text>
        );
      case 'total':
        return (
          <Text key={col} style={[styles.td, styles.colTotal, styles.num]}>
            {item.quantity == null
              ? '—'
              : money(lineTotal(item) * alvFactor)}
          </Text>
        );
      case 'date':
        return (
          <Text key={col} style={[styles.td, colStyle(col, colOpts)]} numberOfLines={2}>
            {cellDisplay(col, item, cellCtx) || '—'}
          </Text>
        );
      case 'productCode': {
        const code = cellDisplay(col, item, cellCtx);
        if (!productCodeOpen) {
          return (
            <View
              key={col}
              style={colStyle(col, colOpts)}
              accessibilityLabel={
                code && code !== '—'
                  ? t('colProductCodeCollapsedA11y').replace('{code}', code)
                  : t('colProductCode')
              }
            />
          );
        }
        return (
          <Text
            key={col}
            style={[styles.td, colStyle(col, colOpts)]}
            numberOfLines={2}
          >
            {code || '—'}
          </Text>
        );
      }
      case 'openingStock':
      case 'purchases':
      case 'usage':
      case 'need':
      case 'variance':
      case 'turnover':
        return (
          <Text
            key={col}
            style={[styles.td, colStyle(col), styles.num]}
            numberOfLines={1}
          >
            {cellDisplay(col, item, cellCtx)}
          </Text>
        );
    }
  }

  const listPadBottom = TAB_BAR_CLEARANCE + Math.max(insets.bottom, 8);

  function wrapColumnHead(
    col: ExportColumnId,
    body: React.ReactNode,
    headStyle?: object,
  ) {
    const colIdx = columns.indexOf(col);
    return (
      <InventoryColumnHead
        key={col}
        col={col}
        style={[colStyle(col, colOpts), headStyle]}
        dropTarget={
          dropTargetCol === col && draggingCol != null && draggingCol !== col
        }
        dragging={draggingCol === col}
        armed={armedCol === col}
        canMoveLeft={colIdx > 0}
        canMoveRight={colIdx >= 0 && colIdx < columns.length - 1}
        onMoveBy={(delta) => nudgeColumn(col, delta)}
        onDragStartCol={(c) => {
          draggingColRef.current = c;
          setDraggingCol(c);
          setArmedCol(null);
        }}
        onDragOverCol={(c) => {
          if (draggingColRef.current && c !== draggingColRef.current) {
            setDropTargetCol(c);
          }
        }}
        onDropOnCol={(to, from) => {
          const src = from ?? draggingColRef.current;
          if (src) reorderColumn(src, to);
          draggingColRef.current = null;
          setDraggingCol(null);
          setDropTargetCol(null);
        }}
        onDragEnd={() => {
          draggingColRef.current = null;
          setDraggingCol(null);
          setDropTargetCol(null);
        }}
        onArm={setArmedCol}
        dragHint={t('columnDragToReorder')}
        moveLeftLabel={t('columnMoveLeft')}
        moveRightLabel={t('columnMoveRight')}
      >
        {body}
      </InventoryColumnHead>
    );
  }

  const tableHead = (
    <View style={styles.tableHead}>
      {columns.map((col) => {
        if (col === 'unit') {
          return wrapColumnHead(col, <UnitColumnLegend />);
        }
        if (col === 'productCode') {
          return wrapColumnHead(
            col,
            <Pressable
              onPress={() => setProductCodeOpen((open) => !open)}
              style={[styles.colCodeToggle]}
              accessibilityRole="button"
              accessibilityState={{ expanded: productCodeOpen }}
              accessibilityLabel={
                productCodeOpen
                  ? t('colProductCodeCollapse')
                  : t('colProductCodeExpand')
              }
            >
              <Text style={styles.colCodeToggleLabel} numberOfLines={2}>
                {productCodeOpen
                  ? t('colProductCode')
                  : t('colProductCodeShort')}
              </Text>
              <Text style={styles.colCodeToggleChevron}>
                {productCodeOpen ? '◂' : '▸'}
              </Text>
            </Pressable>,
          );
        }
        if (compareMonths && (col === 'qty' || col === 'closingStock')) {
          // Body renders two cells; header must span the same total width.
          return (
            <InventoryColumnHead
              key={col}
              col={col}
              style={styles.compareHeadShell}
              dropTarget={
                dropTargetCol === col &&
                draggingCol != null &&
                draggingCol !== col
              }
              dragging={draggingCol === col}
              armed={armedCol === col}
              canMoveLeft={columns.indexOf(col) > 0}
              canMoveRight={
                columns.indexOf(col) >= 0 &&
                columns.indexOf(col) < columns.length - 1
              }
              onMoveBy={(delta) => nudgeColumn(col, delta)}
              onDragStartCol={(c) => {
                draggingColRef.current = c;
                setDraggingCol(c);
                setArmedCol(null);
              }}
              onDragOverCol={(c) => {
                if (draggingColRef.current && c !== draggingColRef.current) {
                  setDropTargetCol(c);
                }
              }}
              onDropOnCol={(to, from) => {
                const src = from ?? draggingColRef.current;
                if (src) reorderColumn(src, to);
                draggingColRef.current = null;
                setDraggingCol(null);
                setDropTargetCol(null);
              }}
              onDragEnd={() => {
                draggingColRef.current = null;
                setDraggingCol(null);
                setDropTargetCol(null);
              }}
              onArm={setArmedCol}
              dragHint={t('columnDragToReorder')}
              moveLeftLabel={t('columnMoveLeft')}
              moveRightLabel={t('columnMoveRight')}
            >
              <View style={styles.compareHeadPair}>
                <Text
                  style={[styles.th, styles.headAlignRight]}
                  numberOfLines={2}
                  accessibilityLabel={t('inventoryLastMonth')}
                >
                  {t('inventoryLastMonth')}
                </Text>
                <Text
                  style={[styles.th, styles.headAlignRight]}
                  numberOfLines={2}
                  accessibilityLabel={t('inventoryThisMonth')}
                >
                  {t('inventoryThisMonth')}
                </Text>
              </View>
            </InventoryColumnHead>
          );
        }
        // Locale labels on-screen (not bilingual FI/EN) so mobile headers
        // stay legible; exports keep RESTOLUTION_FI_HEADERS.
        const label = columnHeader(col, strings);
        const a11y =
          viewProfile.finnishExportHeaders && RESTOLUTION_FI_HEADERS[col]
            ? RESTOLUTION_FI_HEADERS[col]!
            : label;
        return wrapColumnHead(
          col,
          <Text
            style={[styles.th, colHeadAlign(col)]}
            numberOfLines={2}
            accessibilityLabel={a11y}
          >
            {label}
          </Text>,
        );
      })}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.chrome}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.kicker}>{t('appBrand')}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {t('currentInventory')}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {t('currentInventorySub').replace(
                '{count}',
                String(recordedCount),
              )}
              {' · '}
              {session.date.split('-').reverse().join('.')}
              {siteName ? ` · ${siteName}` : ''}
              {showPriceCols
                ? ` · ${showWithAlv ? t('alvWith') : t('alvZero')}`
                : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => setToolsOpen((v) => !v)}
            style={({ pressed }) => [
              styles.toolsToggle,
              toolsOpen && styles.toolsToggleOn,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ expanded: toolsOpen }}
            accessibilityLabel={t('inventoryToolsToggle')}
            hitSlop={8}
          >
            <Text style={styles.toolsToggleText}>{toolsOpen ? '▾' : '⋯'}</Text>
          </Pressable>
        </View>

        {toolsOpen ? (
          <View style={styles.toolsRow}>
            <Pressable
              onPress={() => navigation.navigate('SheetImport')}
              style={({ pressed }) => [
                styles.toolLink,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('sheetImportOpen')}
            >
              <Text style={styles.toolLinkText}>{t('sheetImportOpen')}</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('MonthWrapUp')}
              style={({ pressed }) => [
                styles.toolLink,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('monthWrapUpOpen')}
            >
              <Text style={styles.toolLinkText}>{t('monthWrapUpOpen')}</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                navigation.navigate('VerifyAmounts', { mode: 'pending' })
              }
              style={({ pressed }) => [
                styles.toolLink,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('verifyAmountsOpen')}
            >
              <Text style={styles.toolLinkText}>{t('verifyAmountsOpen')}</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('RecentActivity')}
              style={({ pressed }) => [
                styles.toolLink,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.toolLinkText}>{t('recentActivityOpen')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                alertConfirm(
                  t('startInventoryScratch'),
                  t('startInventoryScratchConfirm'),
                  {
                    destructive: true,
                    confirmLabel: t('startInventoryScratch'),
                    cancelLabel: t('cancel'),
                    onConfirm: () => {
                      clearAllInventory();
                      alertAck(
                        t('startInventoryScratch'),
                        t('startInventoryScratchDone'),
                      );
                    },
                  },
                );
              }}
              style={({ pressed }) => [
                styles.toolLinkDanger,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('startInventoryScratch')}
            >
              <Text style={styles.toolLinkDangerText}>
                {t('startInventoryScratch')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {places.length > 0 ? (
          <View style={styles.filterSelects}>
            <View style={styles.filterSelectHalf}>
              <StorageTypeSelect
                selected={storageFilter}
                onSelect={setStorageFilter}
                flush
                compact
              />
            </View>
            {placesForFilter.length > 1 || storageFilter !== 'all' ? (
              <View style={styles.filterSelectHalf}>
                <PlaceSelect
                  places={placesForFilter}
                  selectedId={placeFilter}
                  onSelect={setPlaceFilter}
                  includeAll
                  allLabel={t('placesAll')}
                  label={t('placesFilter')}
                  flush
                  compact
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.filterRow}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => setShowFullSheet(false)}
            style={[styles.filterChip, !showFullSheet && styles.filterChipOn]}
          >
            <Text
              style={[
                styles.filterChipText,
                !showFullSheet && styles.filterChipTextOn,
              ]}
            >
              {t('showRecordedOnly')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowFullSheet(true)}
            style={[styles.filterChip, showFullSheet && styles.filterChipOn]}
          >
            <Text
              style={[
                styles.filterChipText,
                showFullSheet && styles.filterChipTextOn,
              ]}
            >
              {t('showFullSheet')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setCompareMonths((v) => !v)}
            style={[styles.filterChip, compareMonths && styles.filterChipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: compareMonths }}
            accessibilityHint={t('inventoryCompareHint')}
          >
            <Text
              style={[
                styles.filterChipText,
                compareMonths && styles.filterChipTextOn,
              ]}
            >
              {t('inventoryCompareMonths')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              setNameSort((v) =>
                v === 'place' ? 'az' : v === 'az' ? 'za' : 'place',
              )
            }
            style={[
              styles.filterChip,
              nameSort !== 'place' && styles.filterChipOn,
            ]}
            accessibilityRole="button"
            accessibilityHint={t('inventorySortHint')}
          >
            <Text
              style={[
                styles.filterChipText,
                nameSort !== 'place' && styles.filterChipTextOn,
              ]}
            >
              {nameSort === 'az'
                ? t('inventorySortAz')
                : nameSort === 'za'
                  ? t('inventorySortZa')
                  : t('inventorySortDefault')}
            </Text>
          </Pressable>
          {showPriceCols ? (
            <>
              <Pressable
                onPress={() => setShowWithAlv(false)}
                style={[styles.filterChip, !showWithAlv && styles.filterChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: !showWithAlv }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    !showWithAlv && styles.filterChipTextOn,
                  ]}
                >
                  {t('alvZero')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowWithAlv(true)}
                style={[styles.filterChip, showWithAlv && styles.filterChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: showWithAlv }}
                accessibilityHint={t('alvToggleHint').replace(
                  '{rate}',
                  alvPercentLabel,
                )}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    showWithAlv && styles.filterChipTextOn,
                  ]}
                >
                  {t('alvWith')}
                </Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('inventorySearchPlaceholder')}
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
            style={styles.searchInput}
            accessibilityLabel={t('inventorySearchPlaceholder')}
          />
          {dictationOk ? (
            <Pressable
              onPress={() => void toggleSearchMic()}
              style={({ pressed }) => [
                styles.searchMic,
                micListening && styles.searchMicOn,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                micListening
                  ? t('inventorySearchMicStop')
                  : t('inventorySearchMic')
              }
              hitSlop={8}
            >
              <Text
                style={[
                  styles.searchMicText,
                  micListening && styles.searchMicTextOn,
                ]}
              >
                {micListening ? t('voiceStop') : t('voiceMic')}
              </Text>
            </Pressable>
          ) : null}
          {searchActive ? (
            <Pressable
              onPress={() => setSearchQuery('')}
              style={({ pressed }) => [
                styles.searchClear,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('inventorySearchClear')}
              hitSlop={8}
            >
              <Text style={styles.searchClearText}>×</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.exportRow}>
          <Pressable
            onPress={() => navigation.navigate('SheetImport')}
            style={({ pressed }) => [
              styles.finalizeBtn,
              { backgroundColor: colors.accent },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('sheetImportOpen')}
          >
            <Text style={styles.finalizeBtnText}>{t('sheetImportOpen')}</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('MonthWrapUp')}
            style={({ pressed }) => [
              styles.finalizeBtn,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('monthWrapUpOpen')}
            accessibilityHint={t('monthWrapUpOpenSub')}
          >
            <Text style={styles.finalizeBtnText}>{t('monthWrapUpOpen')}</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('ExportPreview')}
            style={({ pressed }) => [
              styles.previewBtn,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('exportPreviewOpen')}
          >
            <Text style={styles.previewBtnText}>{t('exportPreviewOpen')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setColumnsSheetOpen(true)}
            style={({ pressed }) => [
              styles.columnsBtn,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('spreadsheetChooseColumns')}
          >
            <Text style={styles.columnsBtnText}>
              {t('spreadsheetColumnsBtn')}
            </Text>
            <Text style={styles.columnsBtnHint} numberOfLines={1}>
              {t(profileTitleKey(viewProfileId))}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setArmedCol(null);
              setReorderSheetOpen(true);
            }}
            style={({ pressed }) => [
              styles.reorderBtn,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('columnReorderBtn')}
          >
            <Text style={styles.reorderBtnText}>{t('columnReorderBtn')}</Text>
          </Pressable>
          <Text style={styles.columnDragHint} numberOfLines={1}>
            {t('columnDragHintNearColumns')}
          </Text>
          {columnOrderCustomized ? (
            <Pressable
              onPress={resetColumnOrder}
              style={({ pressed }) => [
                styles.resetOrderBtn,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('columnResetOrder')}
            >
              <Text style={styles.resetOrderBtnText}>
                {t('columnResetOrder')}
              </Text>
            </Pressable>
          ) : null}
          {(['xlsx', 'pdf', 'docx'] as const).map((kind) => (
            <Pressable
              key={kind}
              disabled={exporting}
              onPress={() => setExportKind(kind)}
              style={({ pressed }) => [
                styles.exportBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.exportBtnText}>
                {kind === 'xlsx' ? 'Excel' : kind === 'pdf' ? 'PDF' : 'Word'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ExportColumnsSheet
        visible={exportKind != null}
        purpose="export"
        format={exportKind}
        initialProfile={viewProfileId}
        busy={exporting}
        onClose={() => {
          if (!exporting) setExportKind(null);
        }}
        onConfirm={(profileId) => {
          if (exportKind) void runExport(exportKind, profileId);
        }}
      />

      <ExportColumnsSheet
        visible={columnsSheetOpen}
        purpose="view"
        initialProfile={viewProfileId}
        onClose={() => setColumnsSheetOpen(false)}
        onConfirm={applyViewProfile}
      />

      <ColumnReorderSheet
        visible={reorderSheetOpen}
        columns={columns}
        canReset={columnOrderCustomized}
        onClose={() => setReorderSheetOpen(false)}
        onMoveBy={(col, delta) => nudgeColumn(col, delta)}
        onReset={() => {
          resetColumnOrder();
        }}
      />

      {/*
        Measure listWrap height so the nested horizontal ScrollView + FlatList
        get a hard pixel bound (web VirtualizedList absolute-fill needs this).
      */}
      <View
        style={styles.listWrap}
        onLayout={(e) => {
          const h = Math.floor(e.nativeEvent.layout.height);
          if (h > 0 && Math.abs(h - listHeight) > 1) setListHeight(h);
        }}
      >
        <ScrollView
          horizontal={needsHScrollEffective}
          nestedScrollEnabled
          showsHorizontalScrollIndicator={needsHScrollEffective}
          style={[
            styles.tableScroll,
            listHeight > 0 ? { height: listHeight } : null,
          ]}
          contentContainerStyle={[
            styles.tableScrollContent,
            needsHScrollEffective
              ? { minWidth: minTableWidthEffective }
              : { flexGrow: 1 },
            listHeight > 0 ? { height: listHeight } : null,
            Platform.OS === 'web' && listHeight <= 0
              ? ({ height: '100%' } as object)
              : null,
          ]}
        >
          <View
            style={[
              styles.tableInner,
              needsHScrollEffective
                ? { minWidth: minTableWidthEffective }
                : { flex: 1 },
              listHeight > 0 ? { height: listHeight } : null,
            ]}
          >
            {tableHead}
            <FlatList
              data={visibleLines}
              keyExtractor={(item) => item.id}
              style={styles.tableList}
              nestedScrollEnabled
              contentContainerStyle={{ paddingBottom: listPadBottom }}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {searchActive
                    ? t('inventorySearchEmpty')
                    : t('currentInventoryEmpty')}
                </Text>
              }
              renderItem={({ item }) => {
                const editing = editingId === item.id;
                const uncounted = item.quantity == null;
                return (
                  <Pressable
                    style={[styles.row, uncounted && styles.rowMuted]}
                    onPress={() => {
                      setEditingId(item.id);
                      setDraftQty(
                        item.quantity == null
                          ? ''
                          : formatQty(toDisplayQty(item.unit, item.quantity)),
                      );
                    }}
                  >
                    {columns.map((col) => renderCell(col, item, editing))}
                  </Pressable>
                );
              }}
              ListFooterComponent={
                visibleLines.length > 0 && viewProfile.includeTotals ? (
                  <View style={styles.footer}>
                    {columns.map((col) => {
                      switch (col) {
                        case 'name':
                          return (
                            <Text key={col} style={styles.footerLabel}>
                              {t('foodTotal')}
                            </Text>
                          );
                        case 'qty':
                        case 'closingStock': {
                          const qtyStyle =
                            col === 'closingStock'
                              ? styles.footerQtyWide
                              : styles.footerQty;
                          if (compareMonths) {
                            return (
                              <React.Fragment key={col}>
                                <View
                                  style={
                                    col === 'closingStock'
                                      ? styles.colMove
                                      : styles.colQty
                                  }
                                />
                                <Text
                                  key={`${col}-this`}
                                  style={qtyStyle}
                                >
                                  {String(totals.quantity).replace('.', ',')}
                                </Text>
                              </React.Fragment>
                            );
                          }
                          return (
                            <Text key={col} style={qtyStyle}>
                              {String(totals.quantity).replace('.', ',')}
                            </Text>
                          );
                        }
                        case 'total':
                          return (
                            <Text key={col} style={styles.footerValue}>
                              {money(totals.value * alvFactor)}
                            </Text>
                          );
                        default:
                          return <View key={col} style={colStyle(col, colOpts)} />;
                      }
                    })}
                  </View>
                ) : null
              }
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  chrome: {
    flexGrow: 0,
    flexShrink: 0,
    zIndex: 2,
    backgroundColor: colors.bg,
    paddingBottom: spacing.xs,
  },
  filterSelects: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  filterSelectHalf: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  kicker: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 1,
  },
  meta: { color: colors.inkMuted, marginTop: 2, fontSize: 12 },
  toolsToggle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    ...shadows.soft,
  },
  toolsToggleOn: {
    backgroundColor: colors.primarySoft,
  },
  toolsToggleText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 20,
  },
  toolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  toolLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  toolLinkText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  toolLinkDanger: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
  },
  toolLinkDangerText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  chipScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    ...shadows.soft,
  },
  filterChipOn: {
    backgroundColor: colors.primarySoft,
  },
  filterChipText: { fontSize: 11, fontWeight: '600', color: colors.inkMuted },
  filterChipTextOn: { color: colors.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...surfaces.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 15,
    color: colors.ink,
  },
  searchClear: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  searchClearText: {
    fontSize: 20,
    lineHeight: 22,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  searchMic: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  searchMicOn: {
    backgroundColor: colors.dangerSoft,
  },
  searchMicText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  searchMicTextOn: {
    color: colors.danger,
  },
  exportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  previewBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  previewBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  finalizeBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  finalizeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  columnsBtn: {
    flexGrow: 1,
    flexBasis: '36%',
    minWidth: 120,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    ...shadows.soft,
  },
  reorderBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryMid,
  },
  reorderBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  columnDragHint: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  columnsBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  columnsBtnHint: {
    marginTop: 1,
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '500',
  },
  resetOrderBtn: {
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    ...shadows.soft,
  },
  resetOrderBtnText: {
    color: colors.inkMuted,
    fontWeight: '600',
    fontSize: 11,
  },
  compareHeadShell: {
    flexGrow: 0,
    flexShrink: 0,
  },
  compareHeadPair: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  exportBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  exportBtnText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  listWrap: {
    flex: 1,
    minHeight: 0,
    zIndex: 0,
    position: 'relative',
  },
  tableScroll: { flex: 1 },
  tableScrollContent: {
    flexGrow: 1,
  },
  tableInner: {
    flex: 1,
    minHeight: 0,
  },
  tableList: {
    flex: 1,
    minHeight: 0,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.primarySoft,
    zIndex: 20,
    // Keep visible — do not clip grab handles / ◂▸ nudges.
    overflow: 'visible',
  },
  th: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
    lineHeight: 13,
    overflow: 'hidden',
  },
  headAlignLeft: { textAlign: 'left' },
  headAlignCenter: { textAlign: 'center' },
  headAlignRight: { textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  rowMuted: { opacity: 0.72 },
  td: { fontSize: 12, color: colors.ink },
  alias: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkMuted,
    fontStyle: 'italic',
  },
  placeTag: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  uncounted: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkFaint,
  },
  updatedAt: {
    marginTop: 2,
    fontSize: 10,
    color: colors.inkFaint,
  },
  empty: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  // Cap name growth so Storage (and following cols) sit beside content
  // instead of after a wide empty flex void on wide screens.
  colName: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 180,
    minWidth: 160,
    maxWidth: 340,
    paddingRight: spacing.sm,
  },
  colUnit: { width: 64, textAlign: 'center', paddingTop: 1 },
  colStorage: {
    width: 100,
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'left',
    paddingTop: 1,
    paddingRight: spacing.sm,
  },
  storageCell: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  colQty: { width: 56, alignItems: 'flex-end', paddingTop: 1 },
  lastMonthQty: { color: colors.inkMuted },
  colPrice: { width: 52, textAlign: 'right', paddingTop: 1 },
  colTotal: { width: 52, textAlign: 'right', paddingTop: 1 },
  colDate: { width: 88, textAlign: 'left', paddingTop: 1, paddingRight: 4 },
  colCode: {
    width: PRODUCT_CODE_W_EXPANDED,
    textAlign: 'left',
    paddingTop: 1,
    paddingRight: 4,
  },
  colCodeCollapsed: {
    width: PRODUCT_CODE_W_COLLAPSED,
    flexGrow: 0,
    flexShrink: 0,
    paddingTop: 1,
  },
  colCodeToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 2,
  },
  colCodeToggleLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  colCodeToggleChevron: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 14,
  },
  colMove: {
    width: 96,
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'right',
    paddingTop: 1,
    paddingLeft: 4,
  },
  colTurnover: {
    width: 112,
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'right',
    paddingTop: 1,
    paddingLeft: 4,
  },
  num: { fontVariant: ['tabular-nums'], textAlign: 'right' },
  qtyInput: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 40,
    textAlign: 'right',
    fontSize: 12,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.primarySoft,
    marginTop: spacing.sm,
  },
  footerLabel: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 180,
    minWidth: 160,
    maxWidth: 340,
    fontWeight: '700',
    color: colors.ink,
    fontSize: 13,
  },
  footerQty: {
    width: 48,
    textAlign: 'right',
    fontWeight: '700',
    color: colors.ink,
  },
  footerQtyWide: {
    width: 96,
    textAlign: 'right',
    fontWeight: '700',
    color: colors.ink,
  },
  footerValue: {
    width: 52,
    textAlign: 'right',
    fontWeight: '700',
    color: colors.ink,
  },
});
