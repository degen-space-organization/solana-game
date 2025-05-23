CREATE TABLE stake_transactions (
    id SERIAL,
    user_id INTEGER NOT NULL,
    lobby_id INTEGER NOT NULL,
    match_id INTEGER NULL,
    transaction_hash VARCHAR(88) NOT NULL, -- Solana transaction hash
    amount VARCHAR(20) NOT NULL, -- Amount in lamports
    transaction_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    
    -- Constraints
    CONSTRAINT stake_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT stake_transactions_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT stake_transactions_lobby_fkey FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
    CONSTRAINT stake_transactions_match_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT stake_transactions_transaction_hash_unique UNIQUE (transaction_hash),
    CONSTRAINT stake_transactions_type_valid CHECK (transaction_type IN ('stake', 'prize_payout', 'refund')),
    CONSTRAINT stake_transactions_status_valid CHECK (status IN ('pending', 'confirmed', 'failed')),
    CONSTRAINT stake_transactions_amount_valid CHECK (amount ~ '^[0-9]+$'),
    CONSTRAINT stake_transactions_transaction_hash_not_empty CHECK (LENGTH(TRIM(transaction_hash)) > 0),
    CONSTRAINT stake_transactions_confirmed_after_created CHECK (confirmed_at IS NULL OR confirmed_at >= created_at),
    CONSTRAINT stake_transactions_confirmation_consistency CHECK (
        (status = 'confirmed' AND confirmed_at IS NOT NULL) OR
        (status != 'confirmed' AND confirmed_at IS NULL)
    )
);

-- Indexes
CREATE INDEX idx_stake_transactions_user ON stake_transactions(user_id);
CREATE INDEX idx_stake_transactions_lobby ON stake_transactions(lobby_id);
CREATE INDEX idx_stake_transactions_match ON stake_transactions(match_id);
CREATE INDEX idx_stake_transactions_hash ON stake_transactions(transaction_hash);