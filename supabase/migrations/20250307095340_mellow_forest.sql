/*
  # Initial schema for English Learning App

  1. New Tables
    - `categories`
      - `id` (uuid, primary key)
      - `name` (text)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)
    
    - `channels`
      - `id` (uuid, primary key)
      - `category_id` (uuid, references categories)
      - `channel_id` (text, YouTube channel ID)
      - `channel_name` (text)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)
    
    - `saved_words`
      - `id` (uuid, primary key)
      - `word` (text)
      - `context` (text)
      - `video_id` (text, YouTube video ID)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Categories table
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own categories"
  ON categories
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Channels table
CREATE TABLE channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  channel_name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(category_id, channel_id)
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own channels"
  ON channels
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Saved words table
CREATE TABLE saved_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL,
  context text,
  video_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved words"
  ON saved_words
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);