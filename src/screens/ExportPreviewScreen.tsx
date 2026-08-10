import React, { useMemo, useState } from 'react';
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
import { useInventory } from '../data/store';
import type { InventoryLine } from '../data/types';
import { useI18n } from '../i18n';
import { alertInfo } from '../lib/alertAck';
import { exportSessionDocx } from '../lib/export/docx';
import { exportSessionExcel } from '../lib/export/excel';
import { exportSessionPdf } from '../lib/export/pdf';
import {
  cellDisplay,
  columnHeader,
  DEFAULT_EXPORT_PROFILE,
  getExportProfile,
  isNumericColumn,
  profileTitleKey,
  type ExportCellContext,
  type ExportColumnId,
  type ExportProfileId,
} from '../lib/export/profiles';
import { productCodeForLine } from '../lib/export/restolutionMetrics';
import { colors, radius, spacing } from '../theme/colors';

type ExportKind = 'xlsx' | 'pdf' | 'docx';

function colWidth(col: ExportColumnId): number {
  switch (col) {
    case 'productCode':
      return 100;
    case 'name':
      return 200;
    case 'openingStock':
    case 'purchases':
    case 'closingStock':
    case 'usage':
    case 'need':
    case 'variance':
      return 72;
    case 'turnover':
      return 88;
    case 'unit':
      return 56;
    case 'qty':
      return 48;
    case 'price':
    case 'total':
      return 64;
    case 'date':
      return 88;
    default:
      return 64;
  }
}

function tableMinWidth(columns: ExportColumnId[]): number {
  return columns.reduce((sum, col) => sum + colWidth(col), 16);
}

/**
 * Read-only Restolution-style document preview with search.
 * What you see here is what Excel/PDF/Word export.
 */
export function ExportPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { session, products, movements, recipes, siteName, periodSnapshot } =
    useInventory();
  const { t, strings } = useI18n();
  const [profileId, setProfileId] = useState<ExportProfileId>(
    DEFAULT_EXPORT_PROFILE,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullSheet, setShowFullSheet] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportKind, setExportKind] = useState<ExportKind | null>(null);
  const [columnsSheetOpen, setColumnsSheetOpen] = useState(false);

  const profile = useMemo(() => getExportProfile(profileId), [profileId]);
  const columns = profile.columns;
  const useRestolutionHeaders = Boolean(profile.finnishExportHeaders);
  const minWidth = tableMinWidth(columns);

  const cellCtx: ExportCellContext = useMemo(
    () => ({ session, movements, products, recipes, periodSnapshot }),
    [session, movements, products, recipes, periodSnapshot],
  );

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const lines = useMemo(() => {
    const sorted = [...session.lines].sort((a, b) => {
      const aSet = a.quantity != null ? 0 : 1;
      const bSet = b.quantity != null ? 0 : 1;
      if (aSet !== bSet) return aSet - bSet;
      return a.officialName.localeCompare(b.officialName);
    });
    const modeFiltered = showFullSheet
      ? sorted
      : sorted.filter((l) => l.quantity != null);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return modeFiltered;
    return modeFiltered.filter((l) => {
      if (l.officialName.toLowerCase().includes(q)) return true;
      const code = productCodeForLine(l, products).toLowerCase();
      if (code && code.includes(q)) return true;
      const aliases = productById.get(l.productId)?.aliases;
      return aliases?.some((a) => a.toLowerCase().includes(q)) ?? false;
    });
  }, [
    session.lines,
    showFullSheet,
    searchQuery,
    products,
    productById,
  ]);

  const searchActive = searchQuery.trim().length > 0;
  const dateLabel = session.date.split('-').reverse().join('.');

  async function runExport(kind: ExportKind, exportProfileId: ExportProfileId) {
    try {
      setExporting(true);
      const ctx = { movements, products, recipes, periodSnapshot };
      if (kind === 'xlsx') {
        await exportSessionExcel(session, strings, exportProfileId, ctx);
      } else if (kind === 'pdf') {
        await exportSessionPdf(session, strings, exportProfileId, ctx);
      } else {
        await exportSessionDocx(session, strings, exportProfileId, ctx);
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

  function renderCell(col: ExportColumnId, line: InventoryLine) {
    const numeric = isNumericColumn(col);
    return (
      <Text
        key={col}
        style={[
          styles.cell,
          { width: colWidth(col) },
          numeric && styles.cellNum,
        ]}
        numberOfLines={col === 'name' ? 2 : 1}
      >
        {cellDisplay(col, line, cellCtx) || (col === 'productCode' ? '—' : '')}
      </Text>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.toolbar}>
        <Text style={styles.meta}>
          {t('exportPreviewMeta')
            .replace('{date}', dateLabel)
            .replace('{count}', String(lines.length))
            .replace(
              '{profile}',
              t(profileTitleKey(profileId)),
            )}
          {siteName ? ` · ${siteName}` : ''}
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('exportPreviewSearch')}
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
            accessibilityLabel={t('exportPreviewSearch')}
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

        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setShowFullSheet(false)}
            style={[styles.chip, !showFullSheet && styles.chipOn]}
          >
            <Text
              style={[styles.chipText, !showFullSheet && styles.chipTextOn]}
            >
              {t('showRecordedOnly')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowFullSheet(true)}
            style={[styles.chip, showFullSheet && styles.chipOn]}
          >
            <Text
              style={[styles.chipText, showFullSheet && styles.chipTextOn]}
            >
              {t('showFullSheet')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setColumnsSheetOpen(true)}
            style={({ pressed }) => [
              styles.chip,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.chipText}>{t('spreadsheetColumnsBtn')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sheetFrame}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator
          style={styles.sheetScroll}
          contentContainerStyle={{ minWidth }}
        >
          <View style={{ minWidth, flex: 1 }}>
            <View style={styles.headRow}>
              {columns.map((col) => (
                <Text
                  key={col}
                  style={[
                    styles.headCell,
                    { width: colWidth(col) },
                    isNumericColumn(col) && styles.cellNum,
                  ]}
                  numberOfLines={3}
                >
                  {columnHeader(col, strings, {
                    finnishRestolution: useRestolutionHeaders,
                  })}
                </Text>
              ))}
            </View>

            <FlatList
              data={lines}
              keyExtractor={(item) => item.id}
              nestedScrollEnabled
              contentContainerStyle={{ paddingBottom: 24 }}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {searchActive
                    ? t('inventorySearchEmpty')
                    : t('exportPreviewEmpty')}
                </Text>
              }
              renderItem={({ item, index }) => (
                <View
                  style={[
                    styles.dataRow,
                    index % 2 === 1 && styles.dataRowAlt,
                    item.quantity == null && styles.dataRowMuted,
                  ]}
                >
                  {columns.map((col) => renderCell(col, item))}
                </View>
              )}
            />
          </View>
        </ScrollView>
      </View>

      <View style={styles.exportBar}>
        <Text style={styles.exportHint}>{t('exportPreviewExportHint')}</Text>
        <View style={styles.exportRow}>
          {(['xlsx', 'pdf', 'docx'] as const).map((kind) => (
            <Pressable
              key={kind}
              disabled={exporting}
              onPress={() => setExportKind(kind)}
              style={({ pressed }) => [
                styles.exportBtn,
                kind === 'xlsx' && styles.exportBtnPrimary,
                pressed && { opacity: 0.85 },
                exporting && { opacity: 0.5 },
              ]}
            >
              <Text
                style={[
                  styles.exportBtnText,
                  kind === 'xlsx' && styles.exportBtnTextPrimary,
                ]}
              >
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
        initialProfile={profileId}
        busy={exporting}
        onClose={() => {
          if (!exporting) setExportKind(null);
        }}
        onConfirm={(id) => {
          if (exportKind) void runExport(exportKind, id);
        }}
      />

      <ExportColumnsSheet
        visible={columnsSheetOpen}
        purpose="view"
        initialProfile={profileId}
        onClose={() => setColumnsSheetOpen(false)}
        onConfirm={(id) => {
          setProfileId(id);
          setColumnsSheetOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  toolbar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  meta: {
    fontSize: 12,
    color: colors.inkMuted,
    lineHeight: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  searchClear: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  searchClearText: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.primary,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  chipTextOn: {
    color: colors.primary,
  },
  sheetFrame: {
    flex: 1,
    margin: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  sheetScroll: {
    flex: 1,
  },
  headRow: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  headCell: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    paddingRight: 6,
    lineHeight: 13,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    alignItems: 'flex-start',
  },
  dataRowAlt: {
    backgroundColor: '#F8FBFE',
  },
  dataRowMuted: {
    opacity: 0.55,
  },
  cell: {
    fontSize: 12,
    color: colors.ink,
    paddingRight: 6,
    lineHeight: 16,
  },
  cellNum: {
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 14,
  },
  exportBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bgElevated,
    gap: spacing.sm,
  },
  exportHint: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  exportRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exportBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  exportBtnPrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  exportBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  exportBtnTextPrimary: {
    color: '#fff',
  },
});
