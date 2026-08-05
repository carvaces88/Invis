import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExportColumnsSheet } from '../components/ExportColumnsSheet';
import { PlaceSelect } from '../components/PlaceSelect';
import { UnitColumnLegend } from '../components/UnitColumnLegend';
import { lineTotal, sessionTotals, useInventory } from '../data/store';
import type { InventoryLine, RootStackParamList } from '../data/types';
import { useI18n } from '../i18n';
import { alertAck, alertConfirm, alertInfo } from '../lib/alertAck';
import { exportSessionDocx } from '../lib/export/docx';
import { exportSessionExcel } from '../lib/export/excel';
import { exportSessionPdf } from '../lib/export/pdf';
import {
  DEFAULT_EXPORT_PROFILE,
  cellDisplay,
  columnHeader,
  getExportProfile,
  profileTitleKey,
  type ExportCellContext,
  type ExportColumnId,
  type ExportProfileId,
} from '../lib/export/profiles';
import {
  loadViewProfile,
  saveViewProfile,
} from '../lib/export/viewProfileStorage';
import { FOOD_ALV_RATE, formatMoney } from '../lib/alv';
import { formatUpdatedLabel } from '../lib/relativeTime';
import { useUnitSystem } from '../lib/unitSystem';
import { colors, radius, spacing } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ExportKind = 'xlsx' | 'pdf' | 'docx';

/** Re-export for callers that imported from this screen */
export { FOOD_ALV_RATE } from '../lib/alv';

function money(n: number) {
  return formatMoney(n);
}

function colStyle(col: ExportColumnId) {
  switch (col) {
    case 'name':
      return styles.colName;
    case 'unit':
      return styles.colUnit;
    case 'qty':
    case 'closingStock':
      return styles.colQty;
    case 'price':
      return styles.colPrice;
    case 'total':
      return styles.colTotal;
    case 'date':
      return styles.colDate;
    case 'productCode':
      return styles.colCode;
    case 'openingStock':
    case 'purchases':
    case 'usage':
    case 'need':
    case 'variance':
      return styles.colMove;
    case 'turnover':
      return styles.colTurnover;
  }
}

function tableMinWidth(columns: ExportColumnId[]): number {
  return columns.reduce((sum, col) => {
    switch (col) {
      case 'name':
        return sum + 160;
      case 'unit':
        return sum + 64;
      case 'qty':
      case 'closingStock':
        return sum + 48;
      case 'price':
      case 'total':
        return sum + 52;
      case 'date':
        return sum + 88;
      case 'productCode':
        return sum + 100;
      case 'turnover':
        return sum + 72;
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
    updateLineQuantity,
    clearAllInventory,
  } = useInventory();
  const { t, strings, locale } = useI18n();
  const { displayUnit, toDisplayQty, toStorageQty, formatQty } = useUnitSystem();
  const [placeFilter, setPlaceFilter] = useState<string | 'all'>('all');
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
    () => ({ movements, products, recipes }),
    [movements, products, recipes],
  );
  const cellCtx: ExportCellContext = useMemo(
    () => ({ session, ...exportCtx }),
    [session, exportCtx],
  );
  const [exporting, setExporting] = useState(false);
  const [exportKind, setExportKind] = useState<ExportKind | null>(null);
  const [columnsSheetOpen, setColumnsSheetOpen] = useState(false);
  const [viewProfileId, setViewProfileId] = useState<ExportProfileId>(
    DEFAULT_EXPORT_PROFILE,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState('');
  const [showFullSheet, setShowFullSheet] = useState(false);
  /** false = 0% ALV (stored), true = display with food ALV */
  const [showWithAlv, setShowWithAlv] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadViewProfile().then((id) => {
      if (!cancelled) setViewProfileId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const viewProfile = useMemo(
    () => getExportProfile(viewProfileId),
    [viewProfileId],
  );
  const columns = viewProfile.columns;
  const showPriceCols =
    columns.includes('price') || columns.includes('total');
  const needsHScroll = viewProfileId === 'restolution' || columns.length > 5;
  const minTableWidth = tableMinWidth(columns);

  const alvFactor = showWithAlv && showPriceCols ? 1 + FOOD_ALV_RATE : 1;
  const alvPercentLabel = String(Math.round(FOOD_ALV_RATE * 100));

  const recordedCount = useMemo(() => {
    const lines =
      placeFilter === 'all'
        ? session.lines
        : session.lines.filter((l) => l.placeId === placeFilter);
    return lines.filter((l) => l.quantity != null).length;
  }, [session.lines, placeFilter]);

  const visibleLines = useMemo(() => {
    const lines =
      placeFilter === 'all'
        ? session.lines
        : session.lines.filter((l) => l.placeId === placeFilter);
    const sorted = [...lines].sort((a, b) => {
      const aSet = a.quantity != null ? 0 : 1;
      const bSet = b.quantity != null ? 0 : 1;
      if (aSet !== bSet) return aSet - bSet;
      if (placeFilter === 'all' && a.placeId !== b.placeId) {
        const ao = placeById.get(a.placeId)?.sortOrder ?? 0;
        const bo = placeById.get(b.placeId)?.sortOrder ?? 0;
        if (ao !== bo) return ao - bo;
      }
      return a.officialName.localeCompare(b.officialName);
    });
    const modeFiltered = showFullSheet
      ? sorted
      : sorted.filter((l) => l.quantity != null);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return modeFiltered;
    return modeFiltered.filter((l) => {
      if (l.officialName.toLowerCase().includes(q)) return true;
      const aliases = productById.get(l.productId)?.aliases;
      return (
        aliases?.some((a) => a.toLowerCase().includes(q)) ?? false
      );
    });
  }, [
    session.lines,
    showFullSheet,
    placeFilter,
    placeById,
    productById,
    searchQuery,
  ]);

  const searchActive = searchQuery.trim().length > 0;

  function aliasesLabel(productId: string, officialName: string): string | null {
    const product = productById.get(productId);
    if (!product?.aliases?.length) return null;
    const officialLower = officialName.toLowerCase();
    const shown = product.aliases
      .filter((a) => a.trim() && a.toLowerCase() !== officialLower)
      .slice(0, 4);
    if (!shown.length) return null;
    const more = product.aliases.length > shown.length ? '…' : '';
    return `${t('alsoAs')} ${shown.join(', ')}${more}`;
  }

  function applyViewProfile(profileId: ExportProfileId) {
    setViewProfileId(profileId);
    setColumnsSheetOpen(false);
    void saveViewProfile(profileId);
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

  function renderQtyEditor(item: InventoryLine, editing: boolean) {
    return (
      <View style={styles.colQty}>
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
            {item.quantity == null
              ? '—'
              : formatQty(toDisplayQty(item.unit, item.quantity)).replace(
                  '.',
                  ',',
                )}
          </Text>
        )}
      </View>
    );
  }

  function renderCell(col: ExportColumnId, item: InventoryLine, editing: boolean) {
    switch (col) {
      case 'name': {
        const alsoAs = aliasesLabel(item.productId, item.officialName);
        const uncounted = item.quantity == null;
        const placeName =
          placeFilter === 'all'
            ? placeById.get(item.placeId)?.name
            : undefined;
        return (
          <View key={col} style={styles.colName}>
            <Text style={styles.td} numberOfLines={2}>
              {item.officialName}
            </Text>
            {placeName ? (
              <Text style={styles.placeTag} numberOfLines={1}>
                {placeName}
              </Text>
            ) : null}
            {alsoAs ? (
              <Text style={styles.alias} numberOfLines={2}>
                {alsoAs}
              </Text>
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
      case 'qty':
        return <View key={col}>{renderQtyEditor(item, editing)}</View>;
      case 'closingStock':
        return <View key={col}>{renderQtyEditor(item, editing)}</View>;
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
      case 'productCode':
        return (
          <Text key={col} style={[styles.td, colStyle(col)]} numberOfLines={2}>
            {cellDisplay(col, item, cellCtx) || '—'}
          </Text>
        );
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

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>{t('appBrand')}</Text>
        <Text style={styles.title}>{t('currentInventory')}</Text>
        <Text style={styles.meta}>
          {t('currentInventorySub').replace('{count}', String(recordedCount))}
        </Text>
        <Text style={styles.meta}>
          {t('date')}: {session.date.split('-').reverse().join('.')}
          {siteName ? ` · ${siteName}` : ''}
          {showPriceCols
            ? ` · ${showWithAlv ? t('alvWith') : t('alvZero')}`
            : ''}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate('RecentActivity')}
            style={({ pressed }) => [
              styles.headerLink,
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.headerLinkText}>{t('recentActivityOpen')}</Text>
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
              styles.scratchBtn,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('startInventoryScratch')}
          >
            <Text style={styles.scratchBtnText}>
              {t('startInventoryScratch')}
            </Text>
          </Pressable>
        </View>
      </View>

      {places.length > 1 ? (
        <PlaceSelect
          places={places}
          selectedId={placeFilter}
          onSelect={setPlaceFilter}
          includeAll
          allLabel={t('placesAll')}
          label={t('placesFilter')}
        />
      ) : null}

      <View style={styles.filterRow}>
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
      </View>

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

      {showPriceCols ? (
        <>
          <View style={styles.filterRow}>
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
          </View>
          <Text style={styles.alvHint}>
            {t('alvToggleHint').replace('{rate}', alvPercentLabel)}
          </Text>
        </>
      ) : null}

      <View style={styles.exportRow}>
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

      <ScrollView
        horizontal={needsHScroll}
        nestedScrollEnabled
        showsHorizontalScrollIndicator={needsHScroll}
        style={styles.tableScroll}
        contentContainerStyle={
          needsHScroll ? { minWidth: minTableWidth } : undefined
        }
      >
        <View style={needsHScroll ? { minWidth: minTableWidth } : { flex: 1 }}>
          <View style={styles.tableHead}>
            {columns.map((col) =>
              col === 'unit' ? (
                <UnitColumnLegend key={col} />
              ) : (
                <Text key={col} style={[styles.th, colStyle(col)]}>
                  {columnHeader(col, strings)}
                </Text>
              ),
            )}
          </View>

          <FlatList
            data={visibleLines}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
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
                        return (
                          <Text key={col} style={styles.footerQty}>
                            {String(totals.quantity).replace('.', ',')}
                          </Text>
                        );
                      case 'total':
                        return (
                          <Text key={col} style={styles.footerValue}>
                            {money(totals.value * alvFactor)}
                          </Text>
                        );
                      default:
                        return (
                          <View key={col} style={colStyle(col)} />
                        );
                    }
                  })}
                </View>
              ) : null
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 4,
  },
  meta: { color: colors.inkMuted, marginTop: 4, fontSize: 13 },
  headerActions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  headerLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  headerLinkText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  scratchBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  scratchBtnText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  filterChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  filterChipTextOn: { color: colors.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  searchClear: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  alvHint: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: 11,
    color: colors.inkFaint,
  },
  exportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  columnsBtn: {
    flexGrow: 1,
    flexBasis: '42%',
    minWidth: 140,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  columnsBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  columnsBtnHint: {
    marginTop: 2,
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  exportBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  exportBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  tableScroll: { flex: 1 },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.primarySoft,
    zIndex: 20,
    overflow: 'visible',
  },
  th: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  colName: { flex: 1.6, minWidth: 140, paddingRight: 4 },
  colUnit: { width: 64, textAlign: 'center', paddingTop: 1 },
  colQty: { width: 48, alignItems: 'flex-end', paddingTop: 1 },
  colPrice: { width: 52, textAlign: 'right', paddingTop: 1 },
  colTotal: { width: 52, textAlign: 'right', paddingTop: 1 },
  colDate: { width: 88, textAlign: 'left', paddingTop: 1, paddingRight: 4 },
  colCode: { width: 100, textAlign: 'left', paddingTop: 1, paddingRight: 4 },
  colMove: { width: 56, textAlign: 'right', paddingTop: 1 },
  colTurnover: { width: 72, textAlign: 'right', paddingTop: 1 },
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
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.primarySoft,
    marginTop: spacing.sm,
  },
  footerLabel: { flex: 1.6, fontWeight: '700', color: colors.ink, fontSize: 13 },
  footerQty: {
    width: 48,
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
