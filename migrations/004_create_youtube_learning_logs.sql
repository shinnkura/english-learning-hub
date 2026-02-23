-- YouTube Learning Logs table for tracking video learning sessions
-- Run this migration on your Neon database

CREATE TABLE IF NOT EXISTS youtube_learning_logs (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(20) NOT NULL,
  video_title VARCHAR(500) NOT NULL,
  channel_id VARCHAR(50),
  channel_name VARCHAR(255),
  thumbnail_url TEXT,
  duration_seconds INTEGER NOT NULL,         -- Learning duration (time spent watching)
  video_duration_seconds INTEGER,            -- Total video length
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying by date range
CREATE INDEX IF NOT EXISTS idx_youtube_learning_logs_started_at ON youtube_learning_logs(started_at);

-- Index for querying by video
CREATE INDEX IF NOT EXISTS idx_youtube_learning_logs_video_id ON youtube_learning_logs(video_id);

-- Index for querying by channel
CREATE INDEX IF NOT EXISTS idx_youtube_learning_logs_channel_id ON youtube_learning_logs(channel_id);

-- Comment describing the table
COMMENT ON TABLE youtube_learning_logs IS 'Tracks YouTube video learning sessions';
COMMENT ON COLUMN youtube_learning_logs.duration_seconds IS 'Time spent learning (watching) in seconds';
COMMENT ON COLUMN youtube_learning_logs.video_duration_seconds IS 'Total video duration in seconds';
COMMENT ON COLUMN youtube_learning_logs.started_at IS 'When the learning session started';
COMMENT ON COLUMN youtube_learning_logs.ended_at IS 'When the learning session ended';
