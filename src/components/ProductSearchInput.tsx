import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { isBareEanLabel } from '../lib/packaging';
import { colors, radius, shadows, spacing, surfaces } from '../theme/colors';

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
  const prevInitialRef = useRef(initialQuery);
  const userEditedRef = useRef(false);

  // When Confirm enrichment replaces a bare EAN with a human name, sync the field
  // unless the user already typed something else.
  useEffect(() => {
    if (initialQuery === prevInitialRef.current) return;
    const prev = prevInitialRef.current;
    prevInitialRef.current = initialQuery;
    setQuery((current) => {
      if (userEditedRef.current && current.trim() && current !== prev) {
        return current;
      }
      if (
        !current.trim() ||
        current === prev ||
        isBareEanLabel(current)
      ) {
        userEditedRef.current = false;
        return initialQuery;
      }
      return current;
    });
  }, [initialQuery]);

  const results = useMemo(
    () => searchProducts(products, query, 10),
    [products, query],
  );

  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={(text) => {
          userEditedRef.current = true;
          setQuery(text);
        }}
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
                    userEditedRef.current = true;
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
    ...surfaces.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
  },
  dropdown: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    maxHeight: 280,
    overflow: 'hidden',
    ...shadows.float,
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
