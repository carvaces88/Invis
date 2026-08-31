import { HeaderBackButton } from '@react-navigation/elements';
import { useLinkBuilder } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import type { MainTabParamList, RootStackParamList } from '../data/types';
import { useI18n } from '../i18n';
import { colors } from '../theme/colors';

/** When linking collapses the stack (e.g. deep link), pop to a sensible tab. */
const FALLBACK_TAB: Partial<
  Record<keyof RootStackParamList, keyof MainTabParamList>
> = {
  ProductDetail: 'Catalog',
  AddProduct: 'Catalog',
  PriceComparison: 'Catalog',
  RecordInventory: 'Home',
  ProductScan: 'Scan',
  KuormaScan: 'Scan',
  HavikkiScan: 'Scan',
  Confirm: 'Scan',
  BarcodeScan: 'Scan',
  BatchConfirm: 'Scan',
  FridgeReview: 'Scan',
  SheetImport: 'More',
  SheetImportReview: 'More',
  ReportsChat: 'More',
  HavikkiLog: 'More',
  RecentActivity: 'More',
  VerifyAmounts: 'More',
  ExportPreview: 'More',
  MonthWrapUp: 'More',
  UnitsGuide: 'More',
  Places: 'More',
  VideoDemo: 'More',
  Feedback: 'More',
  AdminDeck: 'More',
  PitchDeck: 'More',
};

type StackScreenOptionsProps = {
  navigation: {
    canGoBack: () => boolean;
    goBack: () => void;
    navigate: (
      name: 'MainTabs',
      params?: { screen: keyof MainTabParamList },
    ) => void;
  };
  route: { name: keyof RootStackParamList };
};

export function useStackScreenOptions(): (
  props: StackScreenOptionsProps,
) => NativeStackNavigationOptions {
  const { t } = useI18n();
  const { buildHref } = useLinkBuilder();

  return useCallback(
    ({ navigation, route }: StackScreenOptionsProps) => ({
      headerTintColor: colors.primary,
      headerStyle: { backgroundColor: colors.bg },
      headerTitleStyle: { color: colors.ink },
      headerBackVisible: true,
      headerLeft: (props) => {
        const fallbackTab =
          FALLBACK_TAB[route.name as keyof RootStackParamList] ?? 'Home';
        const fallbackHref = buildHref('MainTabs', { screen: fallbackTab });

        const onPress = () => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('MainTabs', { screen: fallbackTab });
          }
        };

        return (
          <HeaderBackButton
            {...props}
            displayMode="minimal"
            tintColor={colors.primary}
            accessibilityLabel={t('navBackA11y')}
            href={props.href ?? fallbackHref}
            onPress={onPress}
          />
        );
      },
    }),
    [buildHref, t],
  );
}
