/**
 * Bridge so non-React libs (geminiVision, kruokaLookup) can attach
 * Authorization + X-Venue-Id without importing React context.
 */
type SessionSnapshot = {
  accessToken: string | null;
  venueId: string | null;
};

let snapshot: SessionSnapshot = { accessToken: null, venueId: null };

export function setApiSessionSnapshot(next: SessionSnapshot) {
  snapshot = {
    accessToken: next.accessToken ?? null,
    venueId: next.venueId ?? null,
  };
}

export function getApiSessionSnapshot(): SessionSnapshot {
  return snapshot;
}

export function getProxyAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (snapshot.accessToken) {
    headers.Authorization = `Bearer ${snapshot.accessToken}`;
  }
  if (snapshot.venueId) {
    headers['X-Venue-Id'] = snapshot.venueId;
  }
  return headers;
}
