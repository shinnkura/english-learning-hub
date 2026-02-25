-- Migration: Add YouTube videos cache and user authentication support
-- Created: 2026-02-25

-- Table to cache YouTube video information (shared across all users)
CREATE TABLE IF NOT EXISTS youtube_videos (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(20) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  channel_id VARCHAR(30) NOT NULL,
  channel_name TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  duration_formatted VARCHAR(20),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_id ON youtube_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_published_at ON youtube_videos(published_at DESC);

-- Table to track user-specific video status (watched/unwatched)
CREATE TABLE IF NOT EXISTS user_video_status (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  video_id VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'unwatched',
  watched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_user_video_status_user_id ON user_video_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_video_status_video_id ON user_video_status(video_id);
CREATE INDEX IF NOT EXISTS idx_user_video_status_status ON user_video_status(user_id, status);

-- Add user_id to existing tables for user-specific data
ALTER TABLE youtube_learning_logs ADD COLUMN IF NOT EXISTS user_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_youtube_learning_logs_user_id ON youtube_learning_logs(user_id);

ALTER TABLE youtube_video_reviews ADD COLUMN IF NOT EXISTS user_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_youtube_video_reviews_user_id ON youtube_video_reviews(user_id);
