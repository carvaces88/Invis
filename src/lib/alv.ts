/** Finnish foodstuffs VAT commonly used on kitchen inventaario sheets */
export const FOOD_ALV_RATE = 0.14;

export function formatMoney(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/** Display value with optional food ALV (stored prices stay at 0%). */
export function withFoodAlv(valueAlv0: number, showWithAlv: boolean): number {
  return showWithAlv ? valueAlv0 * (1 + FOOD_ALV_RATE) : valueAlv0;
}

export function foodAlvPercentLabel(): string {
  return String(Math.round(FOOD_ALV_RATE * 100));
}
