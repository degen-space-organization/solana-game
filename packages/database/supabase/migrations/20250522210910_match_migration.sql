CREATE TABLE matches (
    id SERIAL,
    tournament_id INTEGER NULL, -- NULL for 1v1 matches
    lobby_id INTEGER NULL, -- Reference to lobby
    tournament_round INTEGER NULL, -- For tournament bracket tracking (1, 2, 3 for quarterfinals, semifinals, finals)
    status VARCHAR(20) DEFAULT 'waiting',
    winner_id INTEGER NULL,
    stake_amount VARCHAR(20) NOT NULL, -- Amount each player staked (in lamports)
    total_prize_pool VARCHAR(20) NOT NULL, -- Total prize pool (stake_amount * number_of_players, in lamports)
    prize_distributed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    
    -- Constraints
    CONSTRAINT matches_pkey PRIMARY KEY (id),
    CONSTRAINT matches_tournament_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT matches_lobby_fkey FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE SET NULL,
    CONSTRAINT matches_winner_fkey FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT matches_status_valid CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled', 'showing_results')),
    CONSTRAINT matches_stake_amount_valid CHECK (stake_amount ~ '^[0-9]+$'),
    CONSTRAINT matches_total_prize_pool_valid CHECK (total_prize_pool ~ '^[0-9]+$'),
    CONSTRAINT matches_tournament_round_positive CHECK (tournament_round IS NULL OR tournament_round > 0),
    CONSTRAINT matches_completed_after_started CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at),
    CONSTRAINT matches_winner_on_completion CHECK (
        (status = 'completed' AND winner_id IS NOT NULL) OR 
        (status != 'completed')
    )
);

-- Indexes
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
