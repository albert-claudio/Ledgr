import { supabase } from '@/lib/supabase';
import { FeedEvent } from '@/types/feed';

export const fetchFeed = async (limit = 10, offset = 0) => {
  // Pega o usuário atual para verificar se ele deu like
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id;

  const { data, error } = await supabase
    .from('feed_events')
    .select(`
      *,
      user:profiles ( username, avatar_url ),
      my_like:feed_likes ( count )
    `)
    .eq('visibility', 'public')
    .eq('my_like.user_id', currentUserId) // Filtra o count de likes APENAS para o meu usuário
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching feed:', error);
    throw error;
  }

  // Process data to add is_liked_by_me convenience flag
  const processedData = data.map((item: any) => ({
    ...item,
    // O user vem como objeto único por causa do alias, não array
    user: Array.isArray(item.user) ? item.user[0] : item.user, 
    // Verifica se o count retornou algum valor na relação filtrada
    is_liked_by_me: item.my_like && item.my_like[0] && item.my_like[0].count > 0
  })) as FeedEvent[];

  return processedData;
};

export const toggleLike = async (eventId: string, currentStatus: boolean) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  if (currentStatus) {
    // Unlike (O trigger SQL vai diminuir o contador automaticamente)
    const { error } = await supabase
      .from('feed_likes')
      .delete()
      .eq('feed_event_id', eventId)
      .eq('user_id', user.id);
      
    if (error) throw error;

  } else {
    // Like (O trigger SQL vai aumentar o contador automaticamente)
    const { error } = await supabase
      .from('feed_likes')
      .insert({
        feed_event_id: eventId,
        user_id: user.id
      });

    if (error) {
        // Se der erro de duplicidade (já curtiu), ignoramos para não quebrar a UI
        if (error.code !== '23505') throw error; 
    }
  }
};