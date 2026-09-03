import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  useIsFocused,
  type NavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { ChefNudgeProvider } from './src/components/ChefNudge';
import { VenueFromGate } from './src/components/VenueFromGate';
import { CloudSyncProvider } from './src/components/CloudSyncProvider';
import { InventoryProvider } from './src/data/store';
import type { MainTabParamList, RootStackParamList } from './src/data/types';
import { LocaleProvider, useI18n } from './src/i18n';
import { UnitSystemProvider } from './src/lib/unitSystem';
import { AddProductScreen } from './src/screens/AddProductScreen';
import { AdminDeckScreen } from './src/screens/AdminDeckScreen';
import { BarcodeScanScreen } from './src/screens/BarcodeScanScreen';
import { BatchConfirmScreen } from './src/screens/BatchConfirmScreen';
import { CatalogScreen } from './src/screens/CatalogScreen';
import { ConfirmScreen } from './src/screens/ConfirmScreen';
import { FeedbackScreen } from './src/screens/FeedbackScreen';
import { FridgeReviewScreen } from './src/screens/FridgeReviewScreen';
import { HavikkiLogScreen } from './src/screens/HavikkiLogScreen';
import { HavikkiScanScreen } from './src/screens/HavikkiScanScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ExportPreviewScreen } from './src/screens/ExportPreviewScreen';
import { InventaarioScreen } from './src/screens/InventaarioScreen';
import { KuormaScanScreen } from './src/screens/KuormaScanScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { MonthWrapUpScreen } from './src/screens/MonthWrapUpScreen';
import { PlacesScreen } from './src/screens/PlacesScreen';
import { PitchDeckScreen } from './src/screens/PitchDeckScreen';
import { PriceComparisonScreen } from './src/screens/PriceComparisonScreen';
import { ProductDetailScreen } from './src/screens/ProductDetailScreen';
import { ProductScanScreen } from './src/screens/ProductScanScreen';
import { RecordInventoryScreen } from './src/screens/RecordInventoryScreen';
import { RecentActivityScreen } from './src/screens/RecentActivityScreen';
import { ReportsChatScreen } from './src/screens/ReportsChatScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { SheetImportReviewScreen } from './src/screens/SheetImportReviewScreen';
import { SheetImportScanScreen } from './src/screens/SheetImportScanScreen';
import { SimplifiedCountingScreen } from './src/screens/SimplifiedCountingScreen';
import { SupplierOrderReviewScreen } from './src/screens/SupplierOrderReviewScreen';
import { InventoryPhotosScreen } from './src/screens/InventoryPhotosScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { UnitsGuideScreen } from './src/screens/UnitsGuideScreen';
import { VerifyAmountsScreen } from './src/screens/VerifyAmountsScreen';
import { VideoDemoScreen } from './src/screens/VideoDemoScreen';
import { linking } from './src/navigation/linking';
import { colors } from './src/theme/colors';

/**
 * On web, react-native-screens defaults to disabled (`isNativePlatformSupported`
 * is false), so bottom-tabs falls back to plain Views stacked with
 * `absoluteFill` + `zIndex: -1`. Inactive tabs stay in the DOM/a11y tree and
 * can visually overlap the active tab. Re-enable screens so Screen.web applies
 * `display: none` for inactive scenes.
 */
if (Platform.OS === 'web') {
  enableScreens(true);
}

const linkingFallback = (
  <View style={{ flex: 1, backgroundColor: colors.bg }} />
);

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

/** Opens pitch deck for investors (or feedback for others) after gate sign-in. */
function PostSignInRouter({
  navRef,
}: {
  navRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
}) {
  const { justSignedIn, clearJustSignedIn, isInvestor } = useAuth();

  useEffect(() => {
    if (!justSignedIn) return;
    clearJustSignedIn();
    const timer = setTimeout(() => {
      if (isInvestor) {
        navRef.current?.navigate('PitchDeck');
      } else {
        navRef.current?.navigate('Feedback', { nudged: true });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [justSignedIn, clearJustSignedIn, isInvestor, navRef]);

  return null;
}
/** Belt-and-suspenders hide for web if screens path is skipped. */
function WebTabScene({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        display: focused ? 'flex' : 'none',
      }}
      pointerEvents={focused ? 'auto' : 'none'}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? 'yes' : 'no-hide-descendants'}
      // @ts-expect-error inert is a web DOM attribute
      inert={!focused ? true : undefined}
    >
      {children}
    </View>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.ink,
    border: colors.line,
    primary: colors.primary,
  },
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: focused ? '700' : '500',
        color: focused ? colors.primary : colors.inkMuted,
        letterSpacing: focused ? -0.1 : 0,
      }}
    >
      {label}
    </Text>
  );
}

function MainTabs() {
  const { t } = useI18n();
  return (
      <Tab.Navigator
      initialRouteName="Home"
      // On web, keep full tab history so Chrome back matches prior tab visits.
      backBehavior={Platform.OS === 'web' ? 'fullHistory' : 'firstRoute'}
      screenOptions={{
        headerShown: false,
        sceneStyle: { flex: 1, backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopWidth: 0,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          // Soft lift above content (Finnish blue ink, low opacity)
          shadowColor: colors.ink,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 8,
          ...(Platform.OS === 'web'
            ? { boxShadow: '0 -2px 12px rgba(11, 31, 51, 0.06)' }
            : {}),
        },
        tabBarShowLabel: false,
      }}
      screenLayout={({ children }) => <WebTabScene>{children}</WebTabScene>}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('tabHome')} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Inventaario"
        component={InventaarioScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('tabList')} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('tabScan')} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('tabCatalog')} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('tabMore')} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { t } = useI18n();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  return (
    <NavigationContainer
      ref={navRef}
      linking={linking}
      fallback={linkingFallback}
      theme={navTheme}
    >
      <PostSignInRouter navRef={navRef} />
      <StatusBar style="dark" />
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RecordInventory"
          component={RecordInventoryScreen}
          options={{
            title: t('recordInventoryTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="ProductScan"
          component={ProductScanScreen}
          options={{
            title: t('productPhoto'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="KuormaScan"
          component={KuormaScanScreen}
          options={{
            title: t('delivery'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="HavikkiScan"
          component={HavikkiScanScreen}
          options={{
            title: t('foodWaste'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="Confirm"
          component={ConfirmScreen}
          options={{
            title: t('confirm'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="BarcodeScan"
          component={BarcodeScanScreen}
          options={{
            title: t('scanBarcode'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
            headerTransparent: Platform.OS !== 'web',
            headerTitleStyle: { color: Platform.OS === 'web' ? colors.ink : '#fff' },
          }}
        />
        <Stack.Screen
          name="BatchConfirm"
          component={BatchConfirmScreen}
          options={{
            title: t('confirmLines'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="FridgeReview"
          component={FridgeReviewScreen}
          options={{
            title: t('fridgeReviewTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="AddProduct"
          component={AddProductScreen}
          options={{
            title: t('addProduct'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="ReportsChat"
          component={ReportsChatScreen}
          options={{
            title: t('reports'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="HavikkiLog"
          component={HavikkiLogScreen}
          options={{
            title: t('foodWasteLog'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="RecentActivity"
          component={RecentActivityScreen}
          options={{
            title: t('recentActivityTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="VerifyAmounts"
          component={VerifyAmountsScreen}
          options={{
            title: t('verifyAmountsTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="ExportPreview"
          component={ExportPreviewScreen}
          options={{
            title: t('exportPreviewTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="MonthWrapUp"
          component={MonthWrapUpScreen}
          options={{
            title: t('monthWrapUpTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="SheetImport"
          component={SheetImportScanScreen}
          options={{
            title: t('sheetImportTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="SheetImportReview"
          component={SheetImportReviewScreen}
          options={{
            title: t('sheetImportReviewTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="SupplierOrderReview"
          component={SupplierOrderReviewScreen}
          options={{
            title: t('supplierOrderTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="InventoryPhotos"
          component={InventoryPhotosScreen}
          options={{
            title: t('inventoryPhotosTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="VideoDemo"
          component={VideoDemoScreen}
          options={{
            title: t('videoDemo'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="UnitsGuide"
          component={UnitsGuideScreen}
          options={{
            title: t('unitsGuide'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreen}
          options={{
            title: t('catalogDetailTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="PriceComparison"
          component={PriceComparisonScreen}
          options={{
            title: t('priceCompareTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="SimplifiedCounting"
          component={SimplifiedCountingScreen}
          options={{
            title: t('simpCountOpen'),
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Places"
          component={PlacesScreen}
          options={{
            title: t('placesTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="Feedback"
          component={FeedbackScreen}
          options={{
            title: t('feedbackTitle'),
            presentation: 'modal',
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="AdminDeck"
          component={AdminDeckScreen}
          options={{
            title: t('masterDeckTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="PitchDeck"
          component={PitchDeckScreen}
          options={{
            title: t('pitchDeckTitle'),
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AuthGate() {
  const { ready, session } = useAuth();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <SignInScreen />;
  }

  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <UnitSystemProvider>
          <AuthProvider>
            <InventoryProvider>
              <CloudSyncProvider>
                <ChefNudgeProvider>
                  <VenueFromGate />
                  <AuthGate />
                </ChefNudgeProvider>
              </CloudSyncProvider>
            </InventoryProvider>
          </AuthProvider>
        </UnitSystemProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
