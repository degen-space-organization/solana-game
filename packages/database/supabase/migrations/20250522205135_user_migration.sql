
CREATE TABLE users (
    id SERIAL,
    solana_address VARCHAR(44) NOT NULL,
    nickname VARCHAR(50),
    matches_won INTEGER DEFAULT 0,
    matches_lost INTEGER DEFAULT 0,
    is_in_game BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    --constraints
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_solana_address_unique UNIQUE (solana_address),
    CONSTRAINT users_matches_won_non_negative CHECK (matches_won >= 0),
    CONSTRAINT users_matches_lost_non_negative CHECK (matches_lost >= 0),
    CONSTRAINT users_nickname_not_empty CHECK (LENGTH(TRIM(nickname)) > 0)
);


-- Indexes
CREATE INDEX idx_users_solana_address ON users(solana_address);


CREATE OR REPLACE FUNCTION increment_matches_won(p_user_id INT)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET matches_won = matches_won + 1
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment matches_lost
CREATE OR REPLACE FUNCTION increment_matches_lost(p_user_id INT)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET matches_lost = matches_lost + 1
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;