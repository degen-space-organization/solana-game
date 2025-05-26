CREATE TABLE lobbies (
    id SERIAL,
    name VARCHAR(100),
    tournament_id INTEGER NULL, -- NULL for 1v1 matches
    status VARCHAR(20) DEFAULT 'waiting',
    max_players INTEGER DEFAULT 2,
    current_players INTEGER DEFAULT 1,
    stake_amount VARCHAR(20) NOT NULL, -- 4 possible SOL values in (0.25, 0.5, 0.75, 1.0 SOL)
    created_by INTEGER NOT NULL, -- Lobby owner
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disbanded_at TIMESTAMP NULL,
    
    -- Constraints
    CONSTRAINT lobbies_pkey PRIMARY KEY (id),
    CONSTRAINT lobbies_tournament_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT lobbies_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT lobbies_status_valid CHECK (status IN ('waiting', 'ready', 'starting', 'closed', 'disbanded')),
    CONSTRAINT lobbies_stake_amount_valid CHECK (stake_amount IN ('100000000', '250000000', '500000000', '750000000', '1000000000')),    CONSTRAINT lobbies_max_players_positive CHECK (max_players > 0),
    CONSTRAINT lobbies_current_players_non_negative CHECK (current_players >= 0),
    CONSTRAINT lobbies_current_players_max_check CHECK (current_players <= max_players),
    CONSTRAINT lobbies_disbanded_after_created CHECK (disbanded_at IS NULL OR disbanded_at >= created_at),
    CONSTRAINT lobbies_name_not_empty CHECK (name IS NULL OR LENGTH(TRIM(name)) > 0)
);
