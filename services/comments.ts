import { supabase } from '@/lib/supabase';
import { igdbCoverUrl } from './profile';
import { __private__ as IGDB } from './igdb';

export type CommentItem = {
  id: number;
  profile_id: string;
  game_igdb_id: number;
  text: string;
  created_at: string;
  profile?: { id: string; username?: string | null; avatar_url?: string | null };
  likes_count: number;
  liked_by_me: boolean;
};

export type DiaryEntry = {
  id: number;
  igdb_id: number;
  text: string;
  created_at: string;
  game: { name: string; cover_url: string | null };
};

async function getUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

export async function listCommentsForGame(igdbId: number): Promise<CommentItem[]> {
  // Base comments + profiles
  const { data: rows, error } = await supabase
    .from('comments')
    .select('id, profile_id, game_igdb_id, text, created_at')
    .eq('game_igdb_id', igdbId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const commentIds = (rows || []).map((r: any) => r.id);
  // Fetch author profiles
  const profileIds = Array.from(new Set((rows || []).map((r: any) => r.profile_id)));
  let profilesMap = new Map<string, { id: string; username?: string | null; avatar_url?: string | null }>();
  if (profileIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', profileIds);
    (profs || []).forEach((p: any) => profilesMap.set(p.id, { id: p.id, username: p.username, avatar_url: p.avatar_url }));
  }
  let likesByComment = new Map<number, number>();
  let likedMeSet = new Set<number>();
  if (commentIds.length > 0) {
    // Fetch all likes and count in client (simple and reliable with RLS)
    const { data: allLikes } = await supabase
      .from('comment_likes')
      .select('comment_id, profile_id')
      .in('comment_id', commentIds);
    (allLikes || []).forEach((l: any) => {
      likesByComment.set(l.comment_id, (likesByComment.get(l.comment_id) || 0) + 1);
    });
    const uid = await getUserId();
    if (uid) {
      (allLikes || []).forEach((l: any) => { if (l.profile_id === uid) likedMeSet.add(l.comment_id); });
    }
  }
  return (rows || []).map((r: any) => ({
    id: r.id,
    profile_id: r.profile_id,
    game_igdb_id: r.game_igdb_id,
    text: r.text,
    created_at: r.created_at,
    profile: profilesMap.get(r.profile_id),
    likes_count: likesByComment.get(r.id) || 0,
    liked_by_me: likedMeSet.has(r.id),
  }));
}

export async function addComment(igdbId: number, text: string): Promise<CommentItem> {
  const uid = await getUserId();
  if (!uid) throw new Error('Not authenticated');
  const payload = { profile_id: uid, game_igdb_id: igdbId, text };
  const { data, error } = await supabase.from('comments').insert(payload).select('*').single();
  if (error) throw error;
  return { ...data, likes_count: 0, liked_by_me: false } as CommentItem;
}

export async function likeComment(commentId: number): Promise<void> {
  const uid = await getUserId();
  if (!uid) throw new Error('Not authenticated');
  await supabase.from('comment_likes').insert({ comment_id: commentId, profile_id: uid }).then(() => {});
}

export async function unlikeComment(commentId: number): Promise<void> {
  const uid = await getUserId();
  if (!uid) throw new Error('Not authenticated');
  await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('profile_id', uid).then(() => {});
}

export async function listRecentCommentsByUser(userId: string, limit: number = 3): Promise<DiaryEntry[]> {
  const { data: rows, error } = await supabase
    .from('comments')
    .select('id, game_igdb_id, text, created_at')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const list = (rows || []) as { id: number; game_igdb_id: number; text: string; created_at: string }[];
  const ids = Array.from(new Set(list.map(r => r.game_igdb_id).filter(Boolean)));
  const gameMap = new Map<number, { name?: string | null; cover_image_id?: string | null }>();
  if (ids.length) {
    const { data: games } = await supabase
      .from('games')
      .select('igdb_id, name, cover_image_id')
      .in('igdb_id', ids);
    (games || []).forEach((g: any) => { gameMap.set(Number(g.igdb_id), { name: g.name, cover_image_id: g.cover_image_id }); });
    // Identify missing or incomplete
    const missing = ids.filter(id => !gameMap.has(id) || !gameMap.get(id)?.name);
    if (missing.length) {
      const batch = missing.slice(0, 30);
      const fields = 'fields id,name,cover.image_id;';
      const query = `${fields} where id = (${batch.join(',')}); limit ${batch.length};`;
      try {
        const rows = await IGDB.igdbRequest<any[]>(query);
        (rows || []).forEach((r: any) => {
          const cover = r?.cover?.image_id || null;
          gameMap.set(Number(r.id), { name: r.name, cover_image_id: cover });
        });
      } catch {}
    }
  }
  return list.map((r) => {
    const g = gameMap.get(r.game_igdb_id) || { name: `Jogo ${r.game_igdb_id}`, cover_image_id: null };
    return {
      id: r.id,
      igdb_id: r.game_igdb_id,
      text: r.text,
      created_at: r.created_at,
      game: { name: g.name || `Jogo ${r.game_igdb_id}`, cover_url: igdbCoverUrl(g.cover_image_id || undefined) },
    } as DiaryEntry;
  });
}
