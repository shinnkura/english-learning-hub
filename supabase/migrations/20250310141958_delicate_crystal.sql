/*
  # Add saved_words table

  1. New Tables
    - `saved_words`
      - `id` (uuid, primary key)
      - `word` (text, not null) - 保存する単語
      - `context` (text) - 単語が使用されていた文脈
      - `meaning` (text, not null) - 単語の意味やメモ
      - `video_id` (text, not null) - YouTubeの動画ID
      - `url` (text, not null, default: '') - 動画のURL
      - `user_id` (uuid, not null) - ユーザーID
      - `created_at` (timestamptz, default: now()) - 作成日時
      - `next_review_date` (timestamptz, default: now() + interval '7 days') - 次の復習日
      - `remembered` (boolean, default: false) - 覚えたかどうか

  2. Security
    - Enable RLS on `saved_words` table
    - Add policy for authenticated users to manage their own saved words
*/

CREATE TABLE IF NOT EXISTS saved_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL,
  context text,
  meaning text NOT NULL,
  video_id text NOT NULL,
  url text NOT NULL DEFAULT '',
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  next_review_date timestamptz DEFAULT (now() + interval '7 days'),
  remembered boolean DEFAULT false
);

ALTER TABLE saved_words ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'saved_words' 
    AND policyname = 'Users can manage their own saved words'
  ) THEN
    CREATE POLICY "Users can manage their own saved words"
      ON saved_words
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;