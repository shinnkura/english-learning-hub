/*
  # Add RLS policies for channels table

  1. Security
    - Enable RLS on `channels` table if not already enabled
    - Add policy for authenticated users to manage their own channels if not exists
*/

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'channels' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add policy if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'channels' 
    AND policyname = 'Users can manage their own channels'
  ) THEN
    CREATE POLICY "Users can manage their own channels"
      ON channels
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;