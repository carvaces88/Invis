/**
 * Local rule/intent chatbot — NO cloud LLM, no API cost on free/trial.
 * Optional Pro LLM hook stays disabled.
 */
import type {
  InventorySession,
  Product,
  Recipe,
} from '../data/types';
import { INGREDIENT_TYPE_LABELS } from '../data/units';
import { lineTotal, sessionTotals } from '../data/store';
import { FOOD_ALV_RATE, formatMoney, withFoodAlv } from './alv';
import { computeRecipeYield, findRecipes } from './recipeYield';

export type ChatMessage = {
  id: string;
  role: 'user' | 'bot';
  text: string;
};

export type ChatContext = {
  products: Product[];
  session: InventorySession;
  recipes: Recipe[];
  defaultPortionErrorPercent: number;
};

export function isProLlmChatEnabled() {
  return false;
}

type Intent =
  | { type: 'stock_value' }
  | { type: 'low_stock' }
  | { type: 'by_category'; category?: string }
  | { type: 'recipe_yield'; query: string }
  | { type: 'help' }
  | { type: 'unknown' };

function detectIntent(raw: string): Intent {
  const t = raw.trim().toLowerCase();

  if (
    /how much money|stock value|value of stock|inventory value|my inventory value|paljonko rahaa|rahaa varastossa|varaston arvo|worth in stock/.test(
      t,
    )
  ) {
    return { type: 'stock_value' };
  }

  if (
    /low stock|running low|vähissä|loppuu|alle rajan|low inventory/.test(t)
  ) {
    return { type: 'low_stock' };
  }

  if (
    /how many (dishes|portions|plates|bowls)|montako|kuinka monta|can i make|voitko tehdä|recipe|annos|resepti|falafel|sushi|nacho/.test(
      t,
    )
  ) {
    return { type: 'recipe_yield', query: raw };
  }

  if (/category|kategoria|by type|ingredient type|öljy|oils|produce|kuiva/.test(t)) {
    return { type: 'by_category', category: t };
  }

  if (/help|apua|what can|mitä osaat|commands/.test(t)) {
    return { type: 'help' };
  }

  return { type: 'unknown' };
}

export function answerLocalChat(input: string, ctx: ChatContext): string {
  const intent = detectIntent(input);

  switch (intent.type) {
    case 'stock_value': {
      const { value, quantity } = sessionTotals(ctx.session);
      const counted = ctx.session.lines.filter((l) => l.quantity != null).length;
      const withAlv = withFoodAlv(value, true);
      const rate = Math.round(FOOD_ALV_RATE * 100);
      return [
        `My inventory value right now (excl. VAT / 0% ALV): ${formatMoney(value)} €`,
        `With ${rate}% ALV: ${formatMoney(withAlv)} €`,
        `Lines with quantity: ${counted} · Σ qty units: ${String(quantity).replace('.', ',')}`,
        '',
        'Also on Home → My inventory value right now',
      ].join('\n');
    }
    case 'low_stock': {
      const rows = ctx.session.lines
        .map((line) => {
          const product = ctx.products.find((p) => p.id === line.productId);
          const threshold = product?.lowStockThreshold ?? 1;
          const qty = line.quantity;
          if (qty == null) return null;
          if (qty > threshold) return null;
          return `• ${line.officialName}: ${String(qty).replace('.', ',')} ${line.unit} (≤ ${threshold})`;
        })
        .filter(Boolean) as string[];
      if (!rows.length) {
        return 'No low-stock items right now (among counted lines).';
      }
      return `Low stock:\n${rows.join('\n')}`;
    }
    case 'by_category': {
      const grouped = new Map<string, number>();
      for (const line of ctx.session.lines) {
        if (line.quantity == null) continue;
        const product = ctx.products.find((p) => p.id === line.productId);
        const key = product
          ? INGREDIENT_TYPE_LABELS[product.ingredientType]
          : 'Other';
        grouped.set(key, (grouped.get(key) ?? 0) + lineTotal(line));
      }
      const lines = [...grouped.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(
          ([k, v]) => `• ${k}: ${v.toFixed(2).replace('.', ',')} €`,
        );
      return lines.length
        ? `Value by ingredient type:\n${lines.join('\n')}`
        : 'No valued stock lines yet.';
    }
    case 'recipe_yield': {
      const matches = findRecipes(ctx.recipes, intent.query);
      const list =
        matches.length > 0
          ? matches
          : findRecipes(ctx.recipes, '') /* all if vague */;
      if (!list.length) {
        return 'No recipes in the local recipe book yet.';
      }
      // Prefer a specific match from aliases in the query
      const focused =
        matches.length > 0
          ? matches
          : list.filter((r) =>
              r.aliases.some((a) =>
                intent.query.toLowerCase().includes(a.toLowerCase()),
              ) || intent.query.toLowerCase().includes(r.name.toLowerCase()),
            );
      const recipes = focused.length ? focused : list.slice(0, 3);
      const blocks = recipes.map((recipe) => {
        const y = computeRecipeYield(
          recipe,
          ctx.session,
          ctx.products,
          ctx.defaultPortionErrorPercent,
        );
        const pct = Math.round(y.portionErrorPercent * 100);
        return [
          `Recipe: ${recipe.name}`,
          `  Ideal portions: ${y.idealPortions}`,
          `  With ${pct}% portioning margin: ${y.withErrorPortions}`,
          y.bottleneckName
            ? `  Bottleneck: ${y.bottleneckName}`
            : '  Bottleneck: —',
        ].join('\n');
      });
      return [
        ...blocks,
        '',
        'Portioning margin = extra usage buffer for chef over-portioning.',
      ].join('\n');
    }
    case 'help':
      return [
        'What I can answer:',
        '• Stock value — “how much money in stock?”',
        '• Low stock — “low stock”',
        '• By category — “value by category”',
        '• Dishes — “how many falafel bowls can I make?”',
      ].join('\n');
    default:
      return [
        'I only answer inventory questions.',
        'Try: stock value · low stock · how many falafel bowls · help',
      ].join('\n');
  }
}
