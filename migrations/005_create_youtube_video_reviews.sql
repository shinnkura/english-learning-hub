-- YouTube Video Reviews table for spaced repetition review system
-- Tracks videos with difficulty ratings and calculates next review dates

CREATE TABLE youtube_video_reviews (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(20) NOT NULL UNIQUE,
  video_title VARCHAR(500) NOT NULL,
  channel_id VARCHAR(50),
  channel_name VARCHAR(255),
  thumbnail_url TEXT,
  video_duration_seconds INTEGER,

  -- Difficulty: 'easy', 'normal', 'difficult'
  difficulty VARCHAR(10) NOT NULL,

  -- Repetition level for Ebbinghaus curve (Normal only)
  -- 0: 1 day, 1: 3 days, 2: 7 days, 3: 14 days, 4: 30 days
  repetition_level INTEGER DEFAULT 0,

  -- Next scheduled review date
  next_review_at TIMESTAMP WITH TIME ZONE,

  -- When the video was last watched
  last_watched_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Aggregate statistics
  total_watch_count INTEGER DEFAULT 1,
  total_watch_seconds INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient queries on next review date
CREATE INDEX idx_youtube_video_reviews_next_review
  ON youtube_video_reviews(next_review_at)
  WHERE next_review_at IS NOT NULL;

-- Index for filtering by difficulty
CREATE INDEX idx_youtube_video_reviews_difficulty
  ON youtube_video_reviews(difficulty);
