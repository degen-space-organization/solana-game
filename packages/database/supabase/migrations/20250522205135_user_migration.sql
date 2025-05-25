
CREATE TABLE users (
    id SERIAL,
    solana_address VARCHAR(44) NOT NULL,
    nickname VARCHAR(50),
    matches_won INTEGER DEFAULT 0,
    matches_lost INTEGER DEFAULT 0,
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

-- Create function to prevent concurrent participation
CREATE OR REPLACE FUNCTION prevent_concurrent_participation()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user is already in an active lobby
    IF EXISTS (
        SELECT 1 FROM lobby_participants lp 
        JOIN lobbies l ON lp.lobby_id = l.id 
        WHERE lp.user_id = NEW.user_id 
        AND l.status IN ('waiting', 'ready', 'starting')
        AND (TG_TABLE_NAME != 'lobby_participants' OR lp.lobby_id != NEW.lobby_id)
    ) THEN
        RAISE EXCEPTION 'User is already in an active lobby';
    END IF;
    
    -- Check if user is already in an active game
    IF EXISTS (
        SELECT 1 FROM game_participants gp 
        JOIN games g ON gp.game_id = g.id 
        WHERE gp.user_id = NEW.user_id 
        AND g.status IN ('active', 'paused')
        AND (TG_TABLE_NAME != 'game_participants' OR gp.game_id != NEW.game_id)
    ) THEN
        RAISE EXCEPTION 'User is already in an active game';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
