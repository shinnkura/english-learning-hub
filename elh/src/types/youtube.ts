export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Channel {
  id: string;
  category_id: string;
  channel_id: string;
  channel_name: string;
  created_at: string;
  is_favorite: boolean;
  is_active: boolean;
  completed_at?: string;
  thumbnail_url?: string;
}

export interface SavedWord {
  id: string;
  word: string;
  context: string;
  video_id: string;
  url: string;
  created_at: string;
  next_review_date: string;
  remembered: boolean;
  meaning: string;
}

export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: Date;
  description: string;
}

export interface Caption {
  start: number;
  end: number;
  text: string;
}

export interface ActivityData {
  date: string;
  videos: number;
  words: number;
  reviews: number;
}

export type VideoStatus = 'unwatched' | 'in_progress' | 'understood' | 'mastered';

export interface VideoProgress {
  id: string;
  channel_id: string;
  video_id: string;
  video_title: string;
  thumbnail_url?: string;
  status: VideoStatus;
  watch_count: number;
  understood: boolean;
  understood_at?: string;
  next_retry_date?: string;
  retry_count: number;
  in_commute_zone: boolean;
  added_to_commute_at?: string;
  duration_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface SavedPhrase {
  id: string;
  phrase: string;
  translation?: string;
  video_id: string;
  video_title?: string;
  timestamp_start?: number;
  timestamp_end?: number;
  url: string;
  notes?: string;
  next_review_date: string;
  remembered: boolean;
  review_count: number;
  created_at: string;
}