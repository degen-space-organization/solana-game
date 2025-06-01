CREATE TABLE tournaments (
    id SERIAL,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting',
    max_players INTEGER DEFAULT 8,
    current_players INTEGER DEFAULT 0,
    prize_pool VARCHAR(20) DEFAULT '0',
    winner_id INTEGER NULL, -- User ID of the tournament winner
    created_by INTEGER NOT NULL, -- Tournament owner
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    
    -- Constraints
    CONSTRAINT tournaments_pkey PRIMARY KEY (id),
    CONSTRAINT tournaments_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT tournaments_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT tournaments_status_valid CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT tournaments_max_players_positive CHECK (max_players > 0),
    CONSTRAINT tournaments_current_players_non_negative CHECK (current_players >= 0),
    CONSTRAINT tournaments_current_players_max_check CHECK (current_players <= max_players),
    -- CONSTRAINT tournaments_prize_pool_valid CHECK (prize_pool ~ '^[0-9]+'),
    CONSTRAINT tournaments_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT tournaments_started_after_created CHECK (started_at IS NULL OR started_at >= created_at)
);
