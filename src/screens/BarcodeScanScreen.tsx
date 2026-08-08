import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventory } from '../data/store';
import type { RootStackParamList, VisionExtract } from '../data/types';
import { useI18n } from '../i18n';
import { alertInfo } from '../lib/alertAck';
import {
  isProductBarcodeData,
  PRODUCT_BARCODE_TYPES,
  visionExtractFromEan,
} from '../lib/barcodeEan';
import { enrichFromExtractAsync } from '../lib/productEnrichment';
import {
  startWebZxingScan,
  webHasNativeBarcodeDetector,
} from '../lib/webBarcodeScan';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BarcodeScan'>;

function navigateToConfirm(
  navigation: Props['navigation'],
  extract: VisionExtract,
  imageUri?: string,
) {
  navigation.dispatch((state) => {
    const routes = state.routes.filter(
      (r) => r.name !== 'BarcodeScan' && r.name !== 'Confirm',
    );
    routes.push({
      name: 'Confirm',
      params: { extract, imageUri },
      key: `Confirm-barcode-${Date.now()}`,
    });
    return CommonActions.reset({
      ...state,
      routes,
      index: routes.length - 1,
    });
  });
}
/**
 * Full-screen on-device barcode scanner.
 * Native + Chromium: expo-camera CameraView.
 * Safari/Firefox web: ZXing + getUserMedia.
 */
export function BarcodeScanScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { products } = useInventory();
  const purpose = route.params?.purpose ?? 'confirm';
  const preserveQty = route.params?.quantity;
  const preserveExpiry = route.params?.expiryDate;
  const imageUri = route.params?.imageUri;

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const locked = useRef(false);
  const videoHostRef = useRef<View>(null);
  const [webFallback, setWebFallback] = useState(
    () => Platform.OS === 'web' && !webHasNativeBarcodeDetector(),
  );
  const [webError, setWebError] = useState<string | null>(null);

  const finishWithEan = useCallback(
    async (raw: string) => {
      if (locked.current) return;
      if (!isProductBarcodeData(raw)) {
        alertInfo(t('barcodeInvalidTitle'), t('barcodeInvalidBody'));
        return;
      }
      locked.current = true;
      setScanLocked(true);
      setBusy(true);
      try {
        const extract = visionExtractFromEan(raw, {
          quantity: preserveQty,
          expiryDate: preserveExpiry,
        });
        if (!extract) {
          alertInfo(t('barcodeInvalidTitle'), t('barcodeInvalidBody'));
          locked.current = false;
          setScanLocked(false);
          return;
        }

        if (purpose === 'addProduct') {
          const enrichment = await enrichFromExtractAsync(extract, products);
          navigation.navigate({
            name: 'AddProduct',
            params: {
              scannedEan: enrichment.ean ?? extract.ean ?? undefined,
              prefillName: enrichment.officialName,
              unit: enrichment.unit,
              packSize: enrichment.packSize,
              unitPriceAlv0: enrichment.unitPriceAlv0,
              aliases: enrichment.aliases,
              ean: enrichment.ean,
              sourceUrl: enrichment.sourceUrl,
              imageUrl: enrichment.imageUrl,
              brand: enrichment.brand,
              containerHint: enrichment.containerHint,
              ingredientType: enrichment.ingredientType,
              extract,
              barcodeEnrichNotes: enrichment.notes,
            },
            merge: true,
          });
          return;
        }

        // Default / confirm: open Confirm with EAN extract (lookup runs there)
        navigateToConfirm(navigation, extract, imageUri);
      } catch (e) {
        locked.current = false;
        setScanLocked(false);
        alertInfo(
          t('barcodeLookupFailedTitle'),
          e instanceof Error ? e.message : t('barcodeLookupFailedBody'),
        );
      } finally {
        setBusy(false);
      }
    },
    [
      imageUri,
      navigation,
      preserveExpiry,
      preserveQty,
      products,
      purpose,
      t,
    ],
  );

  // Web ZXing fallback (no BarcodeDetector)
  useEffect(() => {
    if (!webFallback || Platform.OS !== 'web') return;
    if (!permission?.granted) return;

    let stop: (() => void) | undefined;
    let video: HTMLVideoElement | null = null;

    const mount = async () => {
      try {
        const host = videoHostRef.current as unknown as HTMLElement | null;
        if (!host) return;
        video = document.createElement('video');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        host.appendChild(video);
        stop = startWebZxingScan(video, (data) => {
          void finishWithEan(data);
        });
        setWebError(null);
      } catch {
        setWebError(t('barcodePermissionBody'));
      }
    };

    void mount();
    return () => {
      stop?.();
      video?.remove();
    };
  }, [webFallback, permission?.granted, finishWithEan, t]);

  if (!permission) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.root,
          styles.center,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <Text style={styles.permTitle}>{t('barcodePermissionTitle')}</Text>
        <Text style={styles.permBody}>{t('barcodePermissionBody')}</Text>
        <Pressable style={styles.permBtn} onPress={() => void requestPermission()}>
          <Text style={styles.permBtnText}>{t('barcodePermissionGrant')}</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>{t('exportCancel')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.cameraWrap}>
        {webFallback ? (
          <View ref={videoHostRef} style={styles.camera} collapsable={false} />
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [...PRODUCT_BARCODE_TYPES],
            }}
            onBarcodeScanned={
              scanLocked || busy
                ? undefined
                : ({ data }) => {
                    void finishWithEan(data);
                  }
            }
          />
        )}
        <View style={styles.frame} pointerEvents="none" />
        <View style={[styles.hud, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.hudTitle}>{t('barcodeScanTitle')}</Text>
          <Text style={styles.hudSub}>{t('barcodeScanHint')}</Text>
          {webFallback ? (
            <Text style={styles.hudMeta}>{t('barcodeScanWebFallback')}</Text>
          ) : null}
          {webError ? <Text style={styles.hudErr}>{webError}</Text> : null}
        </View>
        {busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.busyText}>{t('barcodeLookingUp')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {Platform.OS === 'web' && !webFallback ? (
          <Pressable
            style={styles.linkBtn}
            onPress={() => {
              locked.current = false;
              setScanLocked(false);
              setWebFallback(true);
            }}
          >
            <Text style={styles.linkText}>{t('barcodeUseZxing')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.cancelBtn}
          onPress={() => navigation.goBack()}
          disabled={busy}
        >
          <Text style={styles.cancelText}>{t('exportCancel')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
  },
  cameraWrap: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  frame: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '28%',
    bottom: '32%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.lg,
  },
  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
  },
  hudTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  hudSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  hudMeta: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  hudErr: {
    color: '#ffb4a8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  busyText: { color: '#fff', fontWeight: '600' },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: '#0a0a0a',
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
  },
  cancelText: { color: colors.ink, fontWeight: '600' },
  linkBtn: { paddingVertical: 8, alignItems: 'center' },
  linkText: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  permBody: {
    marginTop: spacing.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  permBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  permBtnText: { color: '#fff', fontWeight: '700' },
});
