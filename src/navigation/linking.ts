import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from '../data/types';

/**
 * URL / browser-history linking for React Navigation.
 * On web this pushes a history entry on each stack (and tab) change so the
 * Android/Chrome hardware back button pops in-app instead of leaving the site.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['invis://'],
  config: {
    screens: {
      MainTabs: {
        path: '',
        screens: {
          Home: '',
          Inventaario: 'inventory',
          Scan: 'scan',
          Catalog: 'catalog',
          More: 'more',
        },
      },
      RecordInventory: 'record',
      ProductScan: 'product-scan',
      KuormaScan: 'delivery-scan',
      HavikkiScan: 'waste-scan',
      Confirm: 'confirm',
      BarcodeScan: 'barcode',
      BatchConfirm: 'batch-confirm',
      FridgeReview: 'fridge-review',
      AddProduct: 'add-product',
      ReportsChat: 'reports',
      HavikkiLog: 'waste-log',
      RecentActivity: 'activity',
      VerifyAmounts: 'verify',
      ExportPreview: 'export',
      MonthWrapUp: 'month-wrap-up',
      SheetImport: 'import-sheet',
      SheetImportReview: 'import-sheet-review',
      VideoDemo: 'video-demo',
      UnitsGuide: 'units',
      /** Avoid `catalog/:id` — that prefix collides with the Catalog tab path and can drop MainTabs from the stack on web. */
      ProductDetail: 'product/:productId',
      PriceComparison: 'prices',
      Places: 'places',
      Feedback: 'feedback',
      AdminDeck: 'admin',
      PitchDeck: 'pitch',
    },
  },
};
