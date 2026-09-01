import { isSupabaseConfigured, supabase } from './supabase';
import {
  normalizeWorkspaceKey,
  type WorkspaceSnapshotPayload,
} from './workspaceSnapshot';

export type RemoteWorkspaceSnapshot = {
  workspaceKey: string;
  email: string;
  venue: string | null;
  payload: WorkspaceSnapshotPayload;
  updatedAt: string;
};

export async function fetchRemoteWorkspaceSnapshot(
  email: string,
): Promise<RemoteWorkspaceSnapshot | null> {
  if (!isSupabaseConfigured) return null;
  const workspaceKey = normalizeWorkspaceKey(email);
  const { data, error } = await supabase
    .from('workspace_snapshots')
    .select('workspace_key, email, venue, payload, updated_at')
    .eq('workspace_key', workspaceKey)
    .maybeSingle();
  if (error || !data) return null;
  return {
    workspaceKey: data.workspace_key,
    email: data.email,
    venue: data.venue,
    payload: data.payload as WorkspaceSnapshotPayload,
    updatedAt: data.updated_at,
  };
}

export async function pushRemoteWorkspaceSnapshot(options: {
  email: string;
  venue: string | null;
  payload: WorkspaceSnapshotPayload;
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const workspaceKey = normalizeWorkspaceKey(options.email);
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from('workspace_snapshots').upsert(
    {
      workspace_key: workspaceKey,
      email: workspaceKey,
      venue: options.venue,
      payload: options.payload,
      updated_at: updatedAt,
    },
    { onConflict: 'workspace_key' },
  );
  if (error) {
    console.warn('[workspaceSync] push failed', error.message);
    return null;
  }
  return updatedAt;
}
