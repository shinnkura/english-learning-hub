-- Study logs table for tracking learning sessions
-- Run this migration on your Neon database

CREATE TABLE IF NOT EXISTS study_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  domain TEXT,
  page_title TEXT,
  duration INTEGER NOT NULL, -- duration in seconds
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying by date range
CREATE INDEX IF NOT EXISTS idx_study_logs_started_at ON study_logs(started_at);

-- Index for querying by domain
CREATE INDEX IF NOT EXISTS idx_study_logs_domain ON study_logs(domain);

-- Comment describing the table
COMMENT ON TABLE study_logs IS 'Tracks study sessions from the Chrome extension';
COMMENT ON COLUMN study_logs.duration IS 'Duration in seconds';
COMMENT ON COLUMN study_logs.started_at IS 'When the study session started';
COMMENT ON COLUMN study_logs.ended_at IS 'When the study session ended';
