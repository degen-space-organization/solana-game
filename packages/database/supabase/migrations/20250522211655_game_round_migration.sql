-- Game rounds within a match (best of 3 or best of 5)
CREATE TABLE game_rounds (
    id SERIAL,
    match_id INTEGER NOT NULL,
    round_number INTEGER NOT NULL,
    player1_move VARCHAR(10) NULL,
    player2_move VARCHAR(10) NULL,
    winner_id INTEGER NULL, -- NULL for tie
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'in_progress', -- 'evaluating', 'in_progress', 'completed', 'waiting'
    
    -- Constraints
    CONSTRAINT game_rounds_pkey PRIMARY KEY (id),
    CONSTRAINT game_rounds_match_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT game_rounds_winner_fkey FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT game_rounds_player1_move_valid CHECK (player1_move IN ('rock', 'paper', 'scissors')),
    CONSTRAINT game_rounds_player2_move_valid CHECK (player2_move IN ('rock', 'paper', 'scissors')),
    CONSTRAINT game_rounds_status_valid CHECK (status IN ('in_progress', 'evaluating', 'completed', 'waiting')),
    CONSTRAINT game_rounds_unique_round_per_match UNIQUE (match_id, round_number),
    CONSTRAINT game_rounds_round_number_positive CHECK (round_number > 0),
    CONSTRAINT game_rounds_completed_after_created CHECK (completed_at IS NULL OR completed_at >= created_at)
    -- CONSTRAINT game_rounds_moves_consistency CHECK (
    --     (player1_move IS NULL AND player2_move IS NULL AND winner_id IS NULL AND completed_at IS NULL) OR
    --     (player1_move IS NOT NULL AND player2_move IS NOT NULL AND completed_at IS NOT NULL)
    -- )
);

-- Indexes
CREATE INDEX idx_game_rounds_match ON game_rounds(match_id);
