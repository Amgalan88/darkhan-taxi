import { supabasePublic } from './supabase';

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const sb = supabasePublic();
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    const msg = error.message || 'rpc_error';
    throw new Error(msg);
  }
  return data as T;
}
