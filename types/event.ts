// Timeline Event Types

export type EventType = 'started' | 'synced' | 'log' | 'rated' | 'finished';

export interface EventMeta {
  // started
  platform?: string;
  status?: 'playing' | 'completed' | 'wishlist';
  
  // synced
  hours_added?: number;
  total_hours?: number;
  
  // log
  log_text?: string;
  diary_id?: number;
  
  // rated
  rating?: number;
  previous_rating?: number;
  
  // finished
  completion_time_hours?: number;
  
  // common
  [key: string]: any;
}

export interface Event {
  id: number;
  profile_id: string;
  game_id: number | null;
  steam_appid: number | null;
  type: EventType;
  meta: EventMeta;
  created_at: string;
  
  // Joined data (populated by query)
  game?: {
    id: number;
    igdb_id: number;
    name: string;
    slug: string;
    cover_image_id: string | null;
  };
  
  profile?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CreateEventParams {
  profile_id: string;
  game_id?: number;
  steam_appid?: number;
  type: EventType;
  meta?: EventMeta;
}
