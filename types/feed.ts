export type FeedEventType = 
  | 'game_started' 
  | 'game_finished' 
  | 'diary_entry' 
  | 'review' 
  | 'goal_completed' 
  | 'platinum_trophy' 
  | 'batch_import';

export interface FeedPayload {
  // Common fields
  game_id?: string;
  game_title?: string;
  cover_url?: string;
  platform?: string;
  
  // Specific fields
  playtime_hours?: number;
  user_rating?: number;
  finished_at?: string;
  diary_content?: string;
  review_text?: string;
  goal_title?: string;
  trophy_name?: string;
  
  // For batch import
  games_count?: number;
  games?: {
    game_id: string;
    title: string;
    cover_url: string;
  }[];
}

export interface FeedEvent {
  id: string;
  user_id: string;
  event_type: FeedEventType;
  payload: FeedPayload;
  likes_count: number;
  comments_count: number;
  visibility: 'public' | 'friends' | 'private';
  created_at: string;
  user?: {
    username: string;
    avatar_url: string;
  };
  my_like?: {
    count: number;
  }[];
  is_liked_by_me?: boolean; // Computed on client
}
