/**
 * Synced repository: write local immediately, enqueue cloud ops, flush when online.
 * Conflict rule v1: last-write-wins per inventory line via updated_at.
 */
import type {
  HavikkiEntry,
  InventoryLine,
  InventorySession,
  Place,
  Product,
  StockMovement,
} from '../types';
import {
  cloudInsertHavikki,
  cloudInsertMovement,
  cloudPullVenue,
  cloudRenameVenue,
  cloudUpsertLine,
  cloudUpsertPlace,
  cloudUpsertProduct,
  cloudUpsertSession,
} from './cloudRepository';
import {
  enqueueSyncOp,
  loadSyncQueue,
  saveSyncQueue,
  type SyncOp,
} from './localRepository';

export type SyncContext = {
  venueId: string | null;
  /** When false, only local persistence runs (guest / demo). */
  cloudEnabled: boolean;
};

let flushing = false;

async function applyOp(op: SyncOp): Promise<boolean> {
  switch (op.kind) {
    case 'upsert_place': {
      const r = await cloudUpsertPlace(op.venueId, op.place);
      return !r.error;
    }
    case 'upsert_product': {
      const r = await cloudUpsertProduct(op.venueId, op.product);
      return !r.error;
    }
    case 'upsert_session': {
      const r = await cloudUpsertSession(op.venueId, op.session);
      return !r.error;
    }
    case 'upsert_line': {
      const r = await cloudUpsertLine(op.venueId, op.sessionId, op.line);
      return !r.error;
    }
    case 'insert_movement': {
      const r = await cloudInsertMovement(op.venueId, op.movement);
      return !r.error;
    }
    case 'insert_havikki': {
      const r = await cloudInsertHavikki(op.venueId, op.entry);
      return !r.error;
    }
    case 'rename_venue': {
      const r = await cloudRenameVenue(op.venueId, op.name);
      return !r.error;
    }
    default:
      return true;
  }
}

/** Drain outbound queue. Safe to call often; single-flight. */
export async function flushSyncQueue(): Promise<{ flushed: number; left: number }> {
  if (flushing) return { flushed: 0, left: -1 };
  flushing = true;
  try {
    const q = await loadSyncQueue();
    if (!q.length) return { flushed: 0, left: 0 };
    const remaining: SyncOp[] = [];
    let flushed = 0;
    for (const op of q) {
      const ok = await applyOp(op);
      if (ok) flushed += 1;
      else remaining.push(op);
    }
    await saveSyncQueue(remaining);
    return { flushed, left: remaining.length };
  } finally {
    flushing = false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

export async function syncUpsertPlace(ctx: SyncContext, place: Place) {
  if (!ctx.cloudEnabled || !ctx.venueId) return;
  await enqueueSyncOp({
    kind: 'upsert_place',
    venueId: ctx.venueId,
    place,
    at: nowIso(),
  });
  void flushSyncQueue();
}

export async function syncUpsertProduct(ctx: SyncContext, product: Product) {
  if (!ctx.cloudEnabled || !ctx.venueId) return;
  await enqueueSyncOp({
    kind: 'upsert_product',
    venueId: ctx.venueId,
    product,
    at: nowIso(),
  });
  void flushSyncQueue();
}

export async function syncUpsertSession(
  ctx: SyncContext,
  session: InventorySession,
) {
  if (!ctx.cloudEnabled || !ctx.venueId) return;
  await enqueueSyncOp({
    kind: 'upsert_session',
    venueId: ctx.venueId,
    session: {
      id: session.id,
      title: session.title,
      date: session.date,
      status: session.status,
      lines: [],
    },
    at: nowIso(),
  });
  void flushSyncQueue();
}

export async function syncUpsertLine(
  ctx: SyncContext,
  sessionId: string,
  line: InventoryLine,
) {
  if (!ctx.cloudEnabled || !ctx.venueId) return;
  await enqueueSyncOp({
    kind: 'upsert_line',
    venueId: ctx.venueId,
    sessionId,
    line,
    at: nowIso(),
  });
  void flushSyncQueue();
}

export async function syncInsertMovement(
  ctx: SyncContext,
  movement: StockMovement,
) {
  if (!ctx.cloudEnabled || !ctx.venueId) return;
  await enqueueSyncOp({
    kind: 'insert_movement',
    venueId: ctx.venueId,
    movement,
    at: nowIso(),
  });
  void flushSyncQueue();
}

export async function syncInsertHavikki(ctx: SyncContext, entry: HavikkiEntry) {
  if (!ctx.cloudEnabled || !ctx.venueId) return;
  await enqueueSyncOp({
    kind: 'insert_havikki',
    venueId: ctx.venueId,
    entry,
    at: nowIso(),
  });
  void flushSyncQueue();
}

export async function syncRenameVenue(ctx: SyncContext, name: string) {
  if (!ctx.cloudEnabled || !ctx.venueId) return;
  await enqueueSyncOp({
    kind: 'rename_venue',
    venueId: ctx.venueId,
    name,
    at: nowIso(),
  });
  void flushSyncQueue();
}

export { cloudPullVenue };
