-- Flashcards table for vocabulary learning
CREATE TABLE IF NOT EXISTS flashcards (
  id SERIAL PRIMARY KEY,
  word VARCHAR(255) NOT NULL,
  meaning TEXT NOT NULL,
  definition TEXT,
  example TEXT,
  phonetic VARCHAR(100),
  image_url TEXT,
  source_url TEXT,

  -- Spaced repetition fields
  ease_factor DECIMAL(3,2) DEFAULT 2.50,
  interval_days INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_reviewed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient review queries
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(next_review_at);
CREATE INDEX IF NOT EXISTS idx_flashcards_word ON flashcards(word);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_flashcards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_flashcards_updated_at ON flashcards;
CREATE TRIGGER trigger_flashcards_updated_at
  BEFORE UPDATE ON flashcards
  FOR EACH ROW
  EXECUTE FUNCTION update_flashcards_updated_at();
