/*
  # Update saved words table

  1. Changes
    - Add `url` column to store video URL
    - Add `next_review_date` column for spaced repetition
    - Add `remembered` column to track learning status

  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE saved_words
ADD COLUMN IF NOT EXISTS url text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS next_review_date timestamptz DEFAULT (now() + interval '7 days'),
ADD COLUMN IF NOT EXISTS remembered boolean DEFAULT false;

-- Update existing records to include URL
DO $$
BEGIN
  UPDATE saved_words
  SET url = 'https://www.youtube.com/watch?v=' || video_id
  WHERE url = '';
END $$;