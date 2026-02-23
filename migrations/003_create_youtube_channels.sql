-- YouTube Channels table for storing registered learning channels
-- Run this migration on your Neon database

CREATE TABLE IF NOT EXISTS youtube_channels (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR(50) NOT NULL UNIQUE,
  channel_name VARCHAR(255) NOT NULL,
  thumbnail_url TEXT,
  subscriber_count INTEGER,
  video_count INTEGER,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for looking up by channel_id
CREATE INDEX IF NOT EXISTS idx_youtube_channels_channel_id ON youtube_channels(channel_id);

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_youtube_channels_created_at ON youtube_channels(created_at);

-- Comment describing the table
COMMENT ON TABLE youtube_channels IS 'Stores registered YouTube channels for English learning';
COMMENT ON COLUMN youtube_channels.channel_id IS 'YouTube channel ID (e.g., UC...)';
COMMENT ON COLUMN youtube_channels.subscriber_count IS 'Number of subscribers at time of registration';
COMMENT ON COLUMN youtube_channels.video_count IS 'Number of videos at time of registration';
