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