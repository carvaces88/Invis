import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useInventory } from '../data/store';

/** When a tester enters a venue on the gate, seed the inventory site name. */
export function VenueFromGate() {
  const { session } = useAuth();
  const { setSiteName } = useInventory();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    const venue = session?.venue?.trim();
    if (!venue || applied.current === venue) return;
    applied.current = venue;
    setSiteName(venue);
  }, [session?.venue, setSiteName]);

  return null;
}
