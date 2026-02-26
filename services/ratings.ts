import { supabase } from '@/lib/supabase';

async function getUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

export async function getMyRating(igdbId: number): Promise<number | null> {
  const uid = await getUserId();
  if (!uid) return null;
  const { data } = await supabase
    .from('user_ratings')
    .select('rating')
    .eq('profile_id', uid)
    .eq('game_igdb_id', igdbId)
    .maybeSingle();
  return (data as any)?.rating ?? null;
}

export async function setMyRating(igdbId: number, rating: number): Promise<void> {
  const uid = await getUserId();
  if (!uid) throw new Error('Not authenticated');
  await supabase
    .from('user_ratings')
    .upsert({ profile_id: uid, game_igdb_id: igdbId, rating }, { onConflict: 'profile_id,game_igdb_id' });
}

export async function getRatingsAggregate(igdbId: number): Promise<{ avg: number; count: number }> {
  const { data, error } = await supabase
    .from('user_ratings')
    .select('rating', { count: 'exact' })
    .eq('game_igdb_id', igdbId);
  if (error) throw error;
  const rows = (data || []) as { rating: number }[];
  if (!rows.length) return { avg: 0, count: 0 };
  const sum = rows.reduce((acc, r) => acc + (r.rating || 0), 0);
  return { avg: sum / rows.length, count: rows.length };
}

