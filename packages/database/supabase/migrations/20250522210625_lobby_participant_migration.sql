CREATE TABLE lobby_participants (
    id SERIAL,
    lobby_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_ready BOOLEAN DEFAULT FALSE,
    has_staked BOOLEAN DEFAULT FALSE,
    stake_transaction_hash VARCHAR(88) NULL, -- Solana transaction hash for stake verification
    staked_at TIMESTAMP NULL,
    
    -- Constraints
    CONSTRAINT lobby_participants_pkey PRIMARY KEY (id),
    CONSTRAINT lobby_participants_lobby_fkey FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
    CONSTRAINT lobby_participants_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT lobby_participants_unique_entry UNIQUE (lobby_id, user_id),
    CONSTRAINT lobby_participants_staked_at_after_joined CHECK (staked_at IS NULL OR staked_at >= joined_at),
    CONSTRAINT lobby_participants_transaction_hash_not_empty CHECK (
        stake_transaction_hash IS NULL OR LENGTH(TRIM(stake_transaction_hash)) > 0
    )
);

-- Indexes
CREATE INDEX idx_lobby_participants_lobby ON lobby_participants(lobby_id);
CREATE INDEX idx_lobby_participants_user ON lobby_participants(user_id);


