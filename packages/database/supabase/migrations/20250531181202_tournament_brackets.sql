
-- -- Add 'waiting' status to matches table if not already present
-- -- File: add_tournament_bracket_support.sql

-- -- Update status constraint to include 'waiting'
-- ALTER TABLE matches 
-- DROP CONSTRAINT IF EXISTS matches_status_valid;

-- ALTER TABLE matches 
-- ADD CONSTRAINT matches_status_valid 
-- CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled', 'showing_results'));

-- -- Add tournament bracket tracking
-- ALTER TABLE matches 
-- ADD COLUMN IF NOT EXISTS tournament_round INTEGER DEFAULT 1;

-- -- Add index for faster tournament bracket queries
-- CREATE INDEX IF NOT EXISTS idx_matches_tournament_bracket 
-- ON matches(tournament_id, tournament_round, status);

-- -- Add constraint to ensure bracket consistency
-- ALTER TABLE matches 
-- ADD CONSTRAINT IF NOT EXISTS matches_tournament_round_positive 
-- CHECK (tournament_round IS NULL OR tournament_round > 0);

-- -- Update existing tournament matches to have tournament_round = 1
-- UPDATE matches 
-- SET tournament_round = 1 
-- WHERE tournament_id IS NOT NULL 
-- AND tournament_round IS NULL;