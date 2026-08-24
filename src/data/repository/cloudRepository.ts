/**
 * Cloud (Supabase) persistence — venue-scoped upserts.
 * RLS enforces isolation; client never trusts “filter in the app” alone.
 */
import type {
  HavikkiEntry,
  InventoryLine,
  InventorySession,
  Place,
  Product,
  StockMovement,
} from '../types';
import { getSupabase } from '../../lib/supabase';

function productRow(venueId: string, p: Product) {
  return {
    id: p.id,
    venue_id: venueId,
    official_name: p.officialName,
    unit: p.unit,
    pack_size: p.packSize ?? null,
    units_per_pack: p.unitsPerPack ?? null,
    pack_base_unit: p.packBaseUnit ?? null,
    unit_price_alv0: p.unitPriceAlv0,
    ingredient_type: p.ingredientType,
    aliases: p.aliases ?? [],
    section: p.section ?? null,
    low_stock_threshold: p.lowStockThreshold ?? null,
    is_top: Boolean(p.isTop),
    image_url: p.imageUrl ?? null,
    ean: p.ean ?? null,
    product_code: p.productCode ?? null,
    source_url: p.sourceUrl ?? null,
    updated_at: new Date().toISOString(),
  };
}

function placeRow(venueId: string, p: Place) {
  return {
    id: p.id,
    venue_id: venueId,
    name: p.name,
    kind: p.kind ?? null,
    sort_order: p.sortOrder,
    updated_at: new Date().toISOString(),
  };
}

function lineRow(venueId: string, sessionId: string, l: InventoryLine) {
  return {
    id: l.id,
    venue_id: venueId,
    session_id: sessionId,
    product_id: l.productId,
    place_id: l.placeId,
    quantity: l.quantity,
    official_name: l.officialName,
    unit: l.unit,
    unit_price_alv0: l.unitPriceAlv0,
    expiry_date: l.expiryDate ?? null,
    notes: l.notes ?? null,
    counted_at: l.countedAt ?? null,
    last_updated_at: l.lastUpdatedAt ?? null,
    verification_status: l.verificationStatus ?? null,
    updated_at: l.lastUpdatedAt ?? new Date().toISOString(),
  };
}

export async function cloudUpsertPlace(venueId: string, place: Place) {
  const sb = getSupabase();
  if (!sb) return { error: 'no-client' as const };
  const { error } = await sb
    .from('places')
    .upsert(placeRow(venueId, place), { onConflict: 'venue_id,id' });
  return { error: error?.message };
}

export async function cloudUpsertProduct(venueId: string, product: Product) {
  const sb = getSupabase();
  if (!sb) return { error: 'no-client' as const };
  const { error } = await sb
    .from('products')
    .upsert(productRow(venueId, product), { onConflict: 'venue_id,id' });
  return { error: error?.message };
}

export async function cloudUpsertSession(
  venueId: string,
  session: InventorySession,
) {
  const sb = getSupabase();
  if (!sb) return { error: 'no-client' as const };
  const { error } = await sb.from('inventory_sessions').upsert(
    {
      id: session.id,
      venue_id: venueId,
      title: session.title,
      date: session.date,
      status: session.status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'venue_id,id' },
  );
  return { error: error?.message };
}

export async function cloudUpsertLine(
  venueId: string,
  sessionId: string,
  line: InventoryLine,
) {
  const sb = getSupabase();
  if (!sb) return { error: 'no-client' as const };
  const { error } = await sb
    .from('inventory_lines')
    .upsert(lineRow(venueId, sessionId, line), { onConflict: 'venue_id,id' });
  return { error: error?.message };
}

export async function cloudInsertMovement(
  venueId: string,
  movement: StockMovement,
) {
  const sb = getSupabase();
  if (!sb) return { error: 'no-client' as const };
  const { error } = await sb.from('stock_movements').upsert(
    {
      id: movement.id,
      venue_id: venueId,
      type: movement.type,
      product_id: movement.productId,
      official_name: movement.officialName,
      unit: movement.unit,
      quantity_delta: movement.quantityDelta,
      quantity_after: movement.quantityAfter,
      notes: movement.notes ?? null,
      station: movement.station ?? null,
      source: movement.source ?? null,
      created_at: movement.createdAt,
    },
    { onConflict: 'venue_id,id' },
  );
  return { error: error?.message };
}

export async function cloudInsertHavikki(
  venueId: string,
  entry: HavikkiEntry,
) {
  const sb = getSupabase();
  if (!sb) return { error: 'no-client' as const };
  const { error } = await sb.from('havikki_entries').upsert(
    {
      id: entry.id,
      venue_id: venueId,
      date: entry.date,
      station: entry.station ?? null,
      product_id: entry.productId,
      official_name: entry.officialName,
      quantity: entry.quantity,
      unit: entry.unit,
      notes: entry.notes ?? null,
      created_at: entry.createdAt,
    },
    { onConflict: 'venue_id,id' },
  );
  return { error: error?.message };
}

export async function cloudRenameVenue(venueId: string, name: string) {
  const sb = getSupabase();
  if (!sb) return { error: 'no-client' as const };
  const { error } = await sb
    .from('venues')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', venueId);
  return { error: error?.message };
}

export type CloudPull = {
  places: Place[];
  products: Product[];
  session: InventorySession | null;
};

export async function cloudPullVenue(venueId: string): Promise<CloudPull | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const [placesRes, productsRes, sessionsRes] = await Promise.all([
    sb
      .from('places')
      .select('*')
      .eq('venue_id', venueId)
      .order('sort_order', { ascending: true }),
    sb.from('products').select('*').eq('venue_id', venueId),
    sb
      .from('inventory_sessions')
      .select('*')
      .eq('venue_id', venueId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1),
  ]);

  const places: Place[] = (placesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind ?? undefined,
    sortOrder: r.sort_order,
  }));

  const products: Product[] = (productsRes.data ?? []).map((r) => ({
    id: r.id,
    officialName: r.official_name,
    unit: r.unit,
    packSize: r.pack_size ?? undefined,
    unitsPerPack: r.units_per_pack ?? undefined,
    packBaseUnit: r.pack_base_unit ?? undefined,
    unitPriceAlv0: Number(r.unit_price_alv0) || 0,
    ingredientType: r.ingredient_type ?? 'other',
    aliases: Array.isArray(r.aliases) ? r.aliases : [],
    section: r.section ?? undefined,
    lowStockThreshold: r.low_stock_threshold ?? undefined,
    isTop: Boolean(r.is_top),
    imageUrl: r.image_url ?? undefined,
    ean: r.ean ?? undefined,
    productCode: r.product_code ?? undefined,
    sourceUrl: r.source_url ?? undefined,
  }));

  const sessionRow = sessionsRes.data?.[0];
  let session: InventorySession | null = null;
  if (sessionRow) {
    const { data: lines } = await sb
      .from('inventory_lines')
      .select('*')
      .eq('venue_id', venueId)
      .eq('session_id', sessionRow.id);
    session = {
      id: sessionRow.id,
      title: sessionRow.title,
      date: sessionRow.date,
      status: sessionRow.status === 'done' ? 'done' : 'in_progress',
      lines: (lines ?? []).map((l) => ({
        id: l.id,
        productId: l.product_id,
        placeId: l.place_id,
        quantity: l.quantity == null ? null : Number(l.quantity),
        officialName: l.official_name,
        unit: l.unit,
        unitPriceAlv0: Number(l.unit_price_alv0) || 0,
        expiryDate: l.expiry_date,
        notes: l.notes ?? undefined,
        countedAt: l.counted_at ?? undefined,
        lastUpdatedAt: l.last_updated_at ?? undefined,
        verificationStatus: l.verification_status ?? undefined,
      })),
    };
  }

  return { places, products, session };
}
