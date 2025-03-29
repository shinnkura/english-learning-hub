/*
  # Add meaning column to saved_words table

  1. Changes
    - Add `meaning` column to `saved_words` table to store word meanings and notes
    
  2. Details
    - Column type: text
    - Not nullable
    - No default value
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_words' 
    AND column_name = 'meaning'
  ) THEN
    ALTER TABLE saved_words ADD COLUMN meaning text NOT NULL;
  END IF;
END $$;