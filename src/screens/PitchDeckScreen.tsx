import React, { useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../data/types';
import {
  finlandRestaurantRegions,
  finlandSomArrEur,
  nordicsArrEur,
  pitchApproach,
  pitchAsk,
  pitchBusinessModel,
  pitchCompetitors,
  pitchMarket,
  pitchMeta,
  pitchMoat,
  pitchProjections,
  pitchRoi,
  pitchVision,
  type PitchHorizonId,
} from '../data/pitchDeck';
import {
  FINLAND_MAP_VIEWBOX,
  finlandMapRegions,
  type FinlandPitchRegionId,
} from '../data/finlandMap';
import { spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'PitchDeck'>;

/** Template palette — teal / white / charcoal (matches investor deck look) */
const T = {
  teal: '#0D9488',
  tealDeep: '#0F766E',
  tealSoft: '#CCFBF1',
  tealMid: '#14B8A6',
  tealPale: '#F0FDFA',
  blue: '#38BDF8',
  blueDeep: '#0284C7',
  insight: '#2563EB',
  ink: '#1E293B',
  muted: '#64748B',
  line: '#E2E8F0',
  white: '#FFFFFF',
  page: '#F8FAFC',
  peak1: '#67E8F9',
  peak2: '#2DD4BF',
  peak3: '#0D9488',
};

function formatEur(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1000)}k`;
  return `€${n}`;
}

/** Mountain / triangle peaks for TAM → SAM → SOM */
function MarketPeaks() {
  const m = pitchMarket;
  const som = finlandSomArrEur();
  const peaks = [
    {
      key: 'tam',
      title: 'TAM',
      name: 'Total Addressable Market',
      value: `$${m.globalTamUsdB}B`,
      sub: `${m.cagrPct}% CAGR · global kitchen inventory software`,
      h: 118,
      color: T.peak1,
    },
    {
      key: 'sam',
      title: 'SAM',
      name: 'Serviceable Addressable Market',
      value: `€${m.euSamArrEurM}M`,
      sub: `~${m.euFullServiceKitchensK}k full-service EU kitchens`,
      h: 158,
      color: T.peak2,
    },
    {
      key: 'som',
      title: 'SOM',
      name: 'Serviceable Obtainable Market',
      value: formatEur(som),
      sub: `Finland Y1–3 · ${m.fiTargetAccounts} × €${m.arpuEurMonth}/mo`,
      h: 198,
      color: T.peak3,
    },
  ];

  return (
    <View style={styles.peaksBlock}>
      <View style={styles.peaksLeft}>
        {peaks.map((p) => (
          <View key={p.key} style={styles.peakLegend}>
            <Text style={styles.peakTitle}>{p.name}</Text>
            <Text style={styles.peakSub}>{p.sub}</Text>
          </View>
        ))}
      </View>
      <View style={styles.peaksRight}>
        {peaks.map((p) => (
          <View key={p.key} style={styles.peakCol}>
            <Text style={styles.peakValueOn}>{p.value}</Text>
            <View
              style={[
                styles.peakShape,
                {
                  borderBottomWidth: p.h,
                  borderLeftWidth: 36,
                  borderRightWidth: 36,
                  borderBottomColor: p.color,
                },
              ]}
            />
            <Text style={styles.peakAbbrev}>{p.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MetricTiles() {
  const m = pitchMarket;
  const tiles = [
    {
      value: `$${m.globalTamUsdB}B+`,
      label: 'Global TAM',
      bg: T.teal,
      color: T.white,
      flex: 1.2,
    },
    {
      value: `${m.cagrPct}%`,
      label: 'Market CAGR',
      bg: T.tealSoft,
      color: T.tealDeep,
      flex: 0.9,
    },
    {
      value: `€${m.euSamArrEurM}M`,
      label: 'EU SAM ARR',
      bg: T.blue,
      color: T.white,
      flex: 1,
    },
    {
      value: m.fiQualifiedRestaurants.toLocaleString('en-GB'),
      label: 'FI full-service kitchens',
      bg: T.tealPale,
      color: T.ink,
      flex: 1,
    },
    {
      value: formatEur(finlandSomArrEur()),
      label: 'Finland SOM ARR',
      bg: T.tealDeep,
      color: T.white,
      flex: 1.15,
    },
    {
      value: `€${m.arpuEurMonth}`,
      label: 'Target ARPU / mo',
      bg: T.tealMid,
      color: T.white,
      flex: 0.85,
    },
  ];

  return (
    <View style={styles.tileGrid}>
      {tiles.map((tile) => (
        <View
          key={tile.label}
          style={[
            styles.metricTile,
            { backgroundColor: tile.bg, flexGrow: tile.flex, flexBasis: '42%' },
          ]}
        >
          <Text style={[styles.metricValue, { color: tile.color }]}>
            {tile.value}
          </Text>
          <Text
            style={[
              styles.metricLabel,
              { color: tile.color === T.white ? 'rgba(255,255,255,0.85)' : T.muted },
            ]}
          >
            {tile.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ApproachHub() {
  const ring = pitchApproach;
  return (
    <View style={styles.hubWrap}>
      <View style={styles.hubRing}>
        {ring.map((node, i) => (
          <View
            key={node.label}
            style={[
              styles.hubNode,
              i % 2 === 0 ? styles.hubNodeTeal : styles.hubNodeSoft,
            ]}
          >
            <Text
              style={[
                styles.hubNodeText,
                i % 2 === 0 ? { color: T.white } : { color: T.tealDeep },
              ]}
            >
              {node.short}
            </Text>
          </View>
        ))}
        <View style={styles.hubCore}>
          <Text style={styles.hubCoreBrand}>{pitchMeta.brand}</Text>
          <Text style={styles.hubCoreSub}>Go-to-market</Text>
        </View>
      </View>
      <View style={styles.hubList}>
        {ring.map((node) => (
          <Text key={node.label} style={styles.hubListItem}>
            · {node.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function HexPillars() {
  return (
    <View style={styles.hexRow}>
      {pitchBusinessModel.map((p, i) => (
        <View key={p.title} style={styles.hexCol}>
          <View
            style={[
              styles.hex,
              { backgroundColor: i % 2 === 0 ? T.teal : T.tealMid },
            ]}
          >
            <Text style={styles.hexLetter}>{p.title[0]}</Text>
          </View>
          <Text style={styles.hexTitle}>{p.title}</Text>
          <Text style={styles.hexBody}>{p.body}</Text>
        </View>
      ))}
    </View>
  );
}

/** Donut progress with € ARR in the center and kitchens under the ring */
function GrowthRing({
  pct,
  size = 88,
  arrLabel,
  kitchensLabel,
  accent = T.insight,
  active = false,
  compact = false,
}: {
  pct: number;
  size?: number;
  arrLabel: string;
  kitchensLabel: string;
  accent?: string;
  active?: boolean;
  compact?: boolean;
}) {
  const clamped = Math.max(1.5, Math.min(100, pct));
  const stroke = Math.max(7, Math.round(size * 0.09));
  const r = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <View style={{ alignItems: 'center', width: size + (compact ? 8 : 24) }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke="#E2E8F0"
            strokeWidth={stroke}
            fill={active ? '#F0F9FF' : T.white}
          />
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={accent}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${Math.max(0.01, c - dash)}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        </Svg>
        <View style={styles.ringCenter} pointerEvents="none">
          <Text
            style={[
              styles.ringArr,
              compact && styles.ringArrCompact,
              active && { color: accent },
            ]}
            numberOfLines={1}
          >
            {arrLabel}
          </Text>
          {!compact ? <Text style={styles.ringArrCap}>ARR</Text> : null}
        </View>
      </View>
      <Text
        style={[styles.ringKits, active && { color: accent, fontWeight: '800' }]}
        numberOfLines={1}
      >
        {kitchensLabel}
      </Text>
    </View>
  );
}

const FINLAND_REGION_FILL: Record<FinlandPitchRegionId, string> = {
  uusimaa: '#0D9488',
  pirkanmaa: '#14B8A6',
  varsinais: '#2DD4BF',
  'pohjois-pohjanmaa': '#5EEAD4',
  'keski-suomi': '#67E8F9',
  other: '#E2E8F0',
};

/** Accurate Finland admin regions + restaurant-density labels */
function FinlandMap() {
  const mapW = Math.min(Dimensions.get('window').width - spacing.lg * 2, 420);
  const mapH = Math.round(mapW * 1.05);
  return (
    <View style={[styles.mapFrame, { height: mapH }]}>
      <Svg width={mapW} height={mapH} viewBox={FINLAND_MAP_VIEWBOX}>
        {finlandMapRegions.map((region) => (
          <Path
            key={region.code}
            d={region.path}
            fill={FINLAND_REGION_FILL[region.pitchRegionId]}
            stroke="#FFFFFF"
            strokeWidth={1.2}
          />
        ))}
      </Svg>
      {finlandRestaurantRegions
        .filter((r) => r.id !== 'other')
        .map((r) => (
          <View
            key={r.id}
            style={[
              styles.mapLabel,
              {
                top: `${r.topPct}%` as `${number}%`,
                left: `${r.leftPct}%` as `${number}%`,
              },
            ]}
          >
            <Text style={styles.mapLabelPct}>{r.pct}%</Text>
            <Text style={styles.mapLabelName}>{r.city}</Text>
          </View>
        ))}
    </View>
  );
}

function FinlandInsight() {
  const [horizon, setHorizon] = useState<PitchHorizonId>('1y');
  const active =
    pitchProjections.find((p) => p.id === horizon) ?? pitchProjections[2];
  const arr = active.mrrEur * 12;
  const isNordics = active.scope === 'nordics';
  const accent = isNordics ? T.teal : T.insight;
  const eurPerKitchenYear = pitchMarket.arpuEurMonth * 12;

  return (
    <View>
      <View style={styles.insightSplit}>
        <View style={styles.insightMapCol}>
          <FinlandMap />
          <Text style={styles.insightMetricLine}>
            Total <Text style={styles.badgeInline}> FI kitchens </Text>
            {'  '}
            <Text style={styles.insightStrong}>
              ~{pitchMarket.fiQualifiedRestaurants.toLocaleString('en-GB')}
            </Text>
          </Text>
          <Text style={styles.insightMetricLine}>
            <Text style={styles.badgeInline}> FI SOM </Text>
            {'  '}
            <Text style={styles.insightStrong}>
              {formatEur(finlandSomArrEur())} ARR
            </Text>
          </Text>
          <Text style={styles.insightMetricLine}>
            <Text style={[styles.badgeInline, { backgroundColor: T.teal }]}>
              {' '}
              Nordics{' '}
            </Text>
            {'  '}
            <Text style={styles.insightStrong}>
              {formatEur(nordicsArrEur())} ARR
            </Text>
          </Text>
        </View>

        <View style={styles.insightRight}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {pitchProjections.map((p) => {
              const on = p.id === horizon;
              const nordicTab = p.scope === 'nordics';
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setHorizon(p.id)}
                  style={[
                    styles.tab,
                    on && styles.tabOn,
                    on && nordicTab && styles.tabOnNordics,
                    !on && nordicTab && styles.tabNordics,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      on && styles.tabTextOn,
                      !on && nordicTab && { color: T.tealDeep },
                    ]}
                  >
                    {p.shortLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View
            style={[
              styles.heroGrowthCard,
              isNordics && styles.heroGrowthCardNordics,
            ]}
          >
            <Text style={[styles.heroStage, { color: accent }]}>
              {isNordics
                ? 'Scandinavia expansion · SE · NO · DK'
                : 'Finland beachhead'}
            </Text>
            <View style={styles.heroGrowthRow}>
              <GrowthRing
                pct={active.ofNordicsPct}
                size={132}
                arrLabel={formatEur(arr)}
                kitchensLabel={`${active.kitchens.toLocaleString('en-GB')} kitchens`}
                accent={accent}
                active
              />
              <View style={styles.heroGrowthMeta}>
                <Text style={styles.heroBigNum}>{formatEur(arr)}</Text>
                <Text style={styles.heroMetaCap}>projected ARR</Text>
                <View style={styles.heroMetaDivider} />
                <Text style={styles.heroMetaLine}>
                  {active.kitchens.toLocaleString('en-GB')} restaurants
                </Text>
                <Text style={styles.heroMetaSub}>
                  × €{eurPerKitchenYear.toLocaleString('en-GB')}/yr each
                </Text>
                <Text style={styles.insightNote}>{active.note}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.growthStripTitle}>Growth path · € with kitchens</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.growthStrip}
          >
            {pitchProjections.map((p, i) => {
              const on = p.id === horizon;
              const pArr = p.mrrEur * 12;
              const pAccent = p.scope === 'nordics' ? T.teal : T.insight;
              return (
                <View key={p.id} style={styles.growthStep}>
                  <Pressable onPress={() => setHorizon(p.id)}>
                    <GrowthRing
                      pct={p.ofNordicsPct}
                      size={on ? 78 : 68}
                      arrLabel={formatEur(pArr)}
                      kitchensLabel={`${p.kitchens}`}
                      accent={pAccent}
                      active={on}
                      compact
                    />
                    <Text
                      style={[
                        styles.growthStepLabel,
                        on && { color: pAccent, fontWeight: '800' },
                      ]}
                    >
                      {p.shortLabel}
                    </Text>
                  </Pressable>
                  {i < pitchProjections.length - 1 ? (
                    <Text style={styles.growthArrow}>→</Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <View style={styles.regionLegend}>
        {finlandRestaurantRegions.map((r) => (
          <View key={r.id} style={styles.regionChip}>
            <Text style={styles.regionChipPct}>{r.pct}%</Text>
            <Text style={styles.regionChipName}>{r.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PriceBars() {
  const max = Math.max(...pitchCompetitors.map((c) => c.priceHigh));
  return (
    <View style={{ gap: 14 }}>
      {pitchCompetitors.map((c) => {
        const mid = (c.priceLow + c.priceHigh) / 2;
        const pct = Math.max(10, Math.round((mid / max) * 100));
        const highlight = 'highlight' in c && c.highlight;
        return (
          <View key={c.name}>
            <View style={styles.priceHead}>
              <Text
                style={[
                  styles.priceName,
                  highlight && { color: T.tealDeep, fontWeight: '800' },
                ]}
              >
                {c.name}
              </Text>
              <Text style={styles.priceAmt}>
                {c.priceLow === c.priceHigh
                  ? `$${c.priceLow}`
                  : `$${c.priceLow}–$${c.priceHigh}`}
                /mo
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${pct}%` as `${number}%`,
                    backgroundColor: highlight ? T.teal : T.blue,
                  },
                ]}
              />
            </View>
            <Text style={styles.priceNote}>{c.note}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function PitchDeckScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const width = Dimensions.get('window').width;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Cover — teal block */}
      <View style={[styles.cover, { paddingTop: spacing.lg }]}>
        <Text style={styles.coverKicker}>{pitchMeta.presentationLabel}</Text>
        <Text style={styles.coverBrand}>{pitchMeta.brand}</Text>
        <Text style={styles.coverTag}>{pitchMeta.tagline}</Text>
        <View style={styles.coverCard}>
          <Text style={styles.coverCardLabel}>Target audience</Text>
          <Text style={styles.coverCardBody}>{pitchMeta.audience}</Text>
        </View>
      </View>

      {/* Solution */}
      <Slide title={pitchVision.headline} tealTitle>
        <Text style={styles.body}>{pitchVision.body}</Text>
        <View style={styles.compareRow}>
          <View style={styles.compareCol}>
            <Text style={styles.compareHead}>Legacy</Text>
            {pitchVision.legacyBullets.map((b) => (
              <Text key={b} style={styles.bullet}>
                · {b}
              </Text>
            ))}
          </View>
          <View style={[styles.compareCol, styles.compareAccent]}>
            <Text style={[styles.compareHead, { color: T.tealDeep }]}>
              INVIS
            </Text>
            {pitchVision.invisBullets.map((b) => (
              <Text key={b} style={styles.bullet}>
                · {b}
              </Text>
            ))}
          </View>
        </View>
      </Slide>

      {/* Market analysis peaks */}
      <Slide title="Market analysis" tealTitle band>
        <MarketPeaks />
      </Slide>

      {/* Big metrics */}
      <Slide title="Market size" tealTitle>
        <MetricTiles />
        <View style={styles.somFormula}>
          <Text style={styles.somFormulaText}>
            {pitchMarket.fiTargetAccounts} accounts × €
            {pitchMarket.arpuEurMonth}/mo × 12 ={' '}
            <Text style={{ color: T.tealDeep, fontWeight: '800' }}>
              {formatEur(finlandSomArrEur())} Finland ARR
            </Text>
          </Text>
        </View>
      </Slide>

      {/* Finland map + projection tabs */}
      <Slide title="Finland → Scandinavia path" tealTitle band>
        <FinlandInsight />
      </Slide>

      {/* Approach hub */}
      <Slide title="Our approach" tealTitle>
        <ApproachHub />
      </Slide>

      {/* Business model hex */}
      <Slide title="Business model" tealTitle>
        <HexPillars />
      </Slide>

      {/* Moat */}
      <Slide title="Unfair advantage" tealTitle band>
        {pitchMoat.map((m, i) => (
          <View key={m.title} style={styles.moatRow}>
            <View style={styles.moatNum}>
              <Text style={styles.moatNumText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.moatTitle}>{m.title}</Text>
              <Text style={styles.bodyMuted}>{m.body}</Text>
            </View>
          </View>
        ))}
      </Slide>

      {/* Competitors */}
      <Slide title="Competitor pricing" tealTitle>
        <PriceBars />
      </Slide>

      {/* ROI */}
      <Slide title="Core ROI" tealTitle band>
        <View style={styles.roiRow}>
          <View style={[styles.roiTile, { backgroundColor: T.teal }]}>
            <Text style={styles.roiBig}>
              {pitchRoi.wasteOfPurchasesLowPct}–
              {pitchRoi.wasteOfPurchasesHighPct}%
            </Text>
            <Text style={styles.roiCap}>Waste of purchases</Text>
          </View>
          <View style={[styles.roiTile, { backgroundColor: T.tealDeep }]}>
            <Text style={styles.roiBig}>↓{pitchRoi.wasteCutPct}%</Text>
            <Text style={styles.roiCap}>Waste cut potential</Text>
          </View>
          <View style={[styles.roiTile, { backgroundColor: T.blueDeep }]}>
            <Text style={styles.roiBig}>{pitchRoi.hoursSavedWeekly}+</Text>
            <Text style={styles.roiCap}>Hours/week stock admin</Text>
          </View>
        </View>
        {pitchRoi.points.map((p) => (
          <View key={p.title} style={styles.roiPoint}>
            <Text style={styles.moatTitle}>{p.title}</Text>
            <Text style={styles.bodyMuted}>{p.body}</Text>
          </View>
        ))}
      </Slide>

      {/* Ask + founder */}
      <View style={[styles.askBand, { maxWidth: width }]}>
        <Text style={styles.askQuote}>“{pitchAsk.founderQuote}”</Text>
        <Text style={styles.askRole}>{pitchAsk.founderRole}</Text>
        <Text style={styles.askHeadline}>{pitchAsk.headline}</Text>
        <Text style={styles.askBody}>{pitchAsk.body}</Text>
        {pitchAsk.bullets.map((b) => (
          <Text key={b} style={styles.askBullet}>
            → {b}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

function Slide({
  title,
  children,
  tealTitle,
  band,
}: {
  title: string;
  children: React.ReactNode;
  tealTitle?: boolean;
  band?: boolean;
}) {
  return (
    <View style={[styles.slide, band && styles.slideBand]}>
      <Text style={[styles.slideTitle, tealTitle && { color: T.teal }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.page },
  cover: {
    backgroundColor: T.teal,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  coverKicker: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  coverBrand: {
    marginTop: 10,
    fontSize: 44,
    fontWeight: '800',
    color: T.white,
    letterSpacing: -1.2,
  },
  coverTag: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 24,
    maxWidth: 340,
  },
  coverCard: {
    marginTop: spacing.lg,
    backgroundColor: T.white,
    borderRadius: 16,
    padding: spacing.lg,
  },
  coverCardLabel: {
    color: T.teal,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  coverCardBody: {
    marginTop: 8,
    color: T.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  slide: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: T.white,
  },
  slideBand: {
    backgroundColor: T.tealPale,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: T.ink,
    marginBottom: spacing.lg,
    letterSpacing: -0.3,
  },
  body: { color: T.ink, fontSize: 15, lineHeight: 23 },
  bodyMuted: { color: T.muted, fontSize: 14, lineHeight: 21 },
  compareRow: { flexDirection: 'row', gap: 12, marginTop: spacing.lg },
  compareCol: {
    flex: 1,
    backgroundColor: T.page,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: T.line,
  },
  compareAccent: {
    borderColor: T.teal,
    backgroundColor: T.tealPale,
  },
  compareHead: {
    fontWeight: '800',
    fontSize: 13,
    color: T.muted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bullet: { color: T.ink, fontSize: 13, lineHeight: 20 },
  peaksBlock: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  peaksLeft: { flex: 1.1, justifyContent: 'space-between', paddingVertical: 4 },
  peakLegend: { marginBottom: 10 },
  peakTitle: { color: T.tealDeep, fontWeight: '800', fontSize: 13 },
  peakSub: { color: T.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  peaksRight: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    minHeight: 220,
  },
  peakCol: { alignItems: 'center', flex: 1 },
  peakValueOn: {
    fontWeight: '800',
    fontSize: 12,
    color: T.ink,
    marginBottom: 6,
    textAlign: 'center',
  },
  peakShape: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderStyle: 'solid',
  },
  peakAbbrev: {
    marginTop: 8,
    fontWeight: '800',
    fontSize: 12,
    color: T.tealDeep,
    letterSpacing: 0.5,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    minWidth: '42%',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  somFormula: {
    marginTop: spacing.lg,
    backgroundColor: T.tealPale,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: T.tealSoft,
  },
  somFormulaText: { color: T.ink, fontSize: 14, lineHeight: 21 },
  hubWrap: { gap: spacing.lg },
  hubRing: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  hubNode: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubNodeTeal: { backgroundColor: T.teal },
  hubNodeSoft: {
    backgroundColor: T.white,
    borderWidth: 2,
    borderColor: T.teal,
  },
  hubNodeText: { fontWeight: '800', fontSize: 11, textAlign: 'center' },
  hubCore: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: T.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  hubCoreBrand: { color: T.white, fontWeight: '800', fontSize: 16 },
  hubCoreSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  hubList: { gap: 4 },
  hubListItem: { color: T.muted, fontSize: 14, lineHeight: 22 },
  hexRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  hexCol: {
    width: '47%',
    alignItems: 'center',
    marginBottom: 8,
  },
  hex: {
    width: 64,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '0deg' }],
  },
  hexLetter: { color: T.white, fontWeight: '800', fontSize: 22 },
  hexTitle: {
    marginTop: 10,
    fontWeight: '800',
    color: T.tealDeep,
    fontSize: 14,
  },
  hexBody: {
    marginTop: 4,
    color: T.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  moatRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.lg,
  },
  moatNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moatNumText: { color: T.white, fontWeight: '800' },
  moatTitle: {
    fontWeight: '800',
    color: T.ink,
    fontSize: 15,
    marginBottom: 4,
  },
  priceHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  priceName: { color: T.ink, fontWeight: '700', fontSize: 14 },
  priceAmt: { color: T.muted, fontSize: 12, fontWeight: '700' },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: T.line,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  priceNote: { marginTop: 4, color: T.muted, fontSize: 12 },
  roiRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  roiTile: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  roiBig: { color: T.white, fontWeight: '800', fontSize: 16 },
  roiCap: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  roiPoint: { marginBottom: spacing.md },
  askBand: {
    backgroundColor: T.tealDeep,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  askQuote: {
    color: T.white,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  askRole: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  askHeadline: {
    marginTop: spacing.xl,
    color: T.tealSoft,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  askBody: {
    marginTop: 8,
    color: T.white,
    fontSize: 15,
    lineHeight: 22,
  },
  askBullet: {
    marginTop: 8,
    color: T.tealSoft,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
  insightSplit: {
    gap: spacing.lg,
  },
  insightMapCol: { width: '100%' },
  insightRight: { width: '100%' },
  mapFrame: {
    backgroundColor: T.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.line,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  mapLabel: {
    position: 'absolute',
    backgroundColor: T.white,
    borderWidth: 1.5,
    borderColor: T.insight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 56,
  },
  mapLabelPct: {
    color: T.insight,
    fontWeight: '800',
    fontSize: 11,
  },
  mapLabelName: {
    color: T.muted,
    fontSize: 9,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: T.insight,
    color: T.white,
    overflow: 'hidden',
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeInline: {
    backgroundColor: T.insight,
    color: T.white,
    fontWeight: '800',
    fontSize: 12,
  },
  insightMetricLine: {
    color: T.ink,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 24,
  },
  insightStrong: { fontWeight: '800', fontSize: 18, color: T.ink },
  insightNote: { marginTop: 6, color: T.muted, fontSize: 13 },
  tabRow: { gap: 8, paddingBottom: 4 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.line,
  },
  tabOn: { backgroundColor: T.insight, borderColor: T.insight },
  tabNordics: { borderColor: T.tealMid, backgroundColor: T.tealPale },
  tabOnNordics: { backgroundColor: T.teal, borderColor: T.teal },
  tabText: { color: T.muted, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: T.white },
  heroGrowthCard: {
    marginTop: spacing.md,
    backgroundColor: T.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.line,
    padding: 14,
  },
  heroGrowthCardNordics: {
    borderColor: T.tealMid,
    backgroundColor: T.tealPale,
  },
  heroStage: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroGrowthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroGrowthMeta: { flex: 1, minWidth: 140 },
  heroBigNum: {
    fontSize: 28,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.5,
  },
  heroMetaCap: {
    color: T.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  heroMetaDivider: {
    height: 1,
    backgroundColor: T.line,
    marginVertical: 10,
  },
  heroMetaLine: { color: T.ink, fontSize: 15, fontWeight: '700' },
  heroMetaSub: { color: T.muted, fontSize: 12, marginTop: 2, marginBottom: 6 },
  ringCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringArr: {
    color: T.ink,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  ringArrCompact: { fontSize: 12 },
  ringArrCap: {
    color: T.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  ringKits: {
    marginTop: 6,
    color: T.ink,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  growthStripTitle: {
    marginTop: spacing.md,
    marginBottom: 8,
    color: T.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  growthStrip: {
    alignItems: 'flex-end',
    gap: 2,
    paddingBottom: 4,
  },
  growthStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  growthStepLabel: {
    marginTop: 4,
    textAlign: 'center',
    color: T.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  growthArrow: {
    color: T.line,
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 2,
    marginBottom: 18,
  },
  regionLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.lg,
  },
  regionChip: {
    backgroundColor: T.white,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: T.line,
    minWidth: '30%',
  },
  regionChipPct: { color: T.insight, fontWeight: '800', fontSize: 13 },
  regionChipName: { color: T.muted, fontSize: 11, marginTop: 2 },
});
