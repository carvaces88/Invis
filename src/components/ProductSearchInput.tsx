import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Product, ProductMatch } from '../data/types';
import { searchProducts } from '../lib/fuzzyMatch';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  products: Product[];
  placeholder?: string;
  onSelect: (match: ProductMatch) => void;
  autoFocus?: boolean;
  initialQuery?: string;
};

export function ProductSearchInput({
  products,
  placeholder = 'Search: capers, brand…',
  onSelect,
  autoFocus,
  initialQuery = '',
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(
    () => searchProducts(products, query, 10),
    [products, query],
  );

  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      {query.trim().length >= 2 && (
        <View style={styles.dropdown}>
          {results.length === 0 ? (
            <Text style={styles.empty}>No match — add to database</Text>
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={results}
              keyExtractor={(item) => item.product.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    onSelect(item);
                    setQuery(item.product.officialName);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.product.officialName}</Text>
                    <Text style={styles.meta}>
                      {item.product.unit}
                      {item.product.packSize
                        ? ` · ${item.product.packSize}`
                        : ''}
                      {item.matchedOn === 'alias'
                        ? ` · via “${item.matchedTerm}”`
                        : ''}
                    </Text>
                  </View>
                  <Text style={styles.score}>
                    {Math.round(item.score * 100)}%
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 2 },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  dropdown: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    maxHeight: 280,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: spacing.sm,
  },
  name: { fontSize: 14, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  score: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  empty: {
    padding: spacing.md,
    color: colors.inkMuted,
    fontSize: 14,
  },
});
