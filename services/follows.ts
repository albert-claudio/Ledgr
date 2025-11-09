import { supabase } from '@/lib/supabase';

async function getUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

export async function followUser(targetId: string) {
  const uid = await getUserId();
  if (!uid) throw new Error('Not authenticated');
  if (uid === targetId) return;
  await supabase.from('follows').insert({ follower_id: uid, following_id: targetId }).then(() => {});
}

export async function unfollowUser(targetId: string) {
  const uid = await getUserId();
  if (!uid) throw new Error('Not authenticated');
  if (uid === targetId) return;
  await supabase.from('follows').delete().eq('follower_id', uid).eq('following_id', targetId).then(() => {});
}

export async function getFollowStats(profileId: string) {
  const uid = await getUserId();
  const [{ count: followers = 0 }, { count: following = 0 }, isFollowing] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId),
    (async () => {
      if (!uid) return false;
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', uid)
        .eq('following_id', profileId)
        .maybeSingle();
      return !!data;
    })(),
  ]);
  return { followers, following, isFollowing: !!isFollowing };
}

export async function listRecentFollowers(profileId: string, limit: number = 5): Promise<{ id: string; username?: string | null }[]> {
  const { data: rows, error } = await supabase
    .from('follows')
    .select('follower_id, created_at')
    .eq('following_id', profileId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)));
  if (error) throw error;
  const ids = Array.from(new Set((rows || []).map((r: any) => r.follower_id)));
  if (!ids.length) return [];
  const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids);
  const map = new Map((profs || []).map((p: any) => [p.id, { id: p.id, username: p.username }] as const));
  return ids.map((id) => map.get(id) || { id });
}
