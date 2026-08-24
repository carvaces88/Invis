/** Auth headers for serverless proxies (vision, K-Ruoka). */
import { getSupabase, isSupabaseConfigured } from '../supabase';

export async function getApiAuthHeaders(
  venueId?: string | null,
): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {};
  const sb = getSupabase();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (venueId) headers['X-Venue-Id'] = venueId;
  return headers;
}
