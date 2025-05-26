
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

-- -- Create function to prevent concurrent participation
-- CREATE OR REPLACE FUNCTION prevent_concurrent_participation()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- Check if user is already in an active lobby
--     -- Only exclude the current lobby if the trigger is on lobby_participants
--     IF EXISTS (
--         SELECT 1 FROM lobby_participants lp
--         JOIN lobbies l ON lp.lobby_id = l.id
--         WHERE lp.user_id = NEW.user_id
--         AND l.status IN ('waiting', 'ready', 'starting')
--         AND (TG_TABLE_NAME <> 'lobby_participants' OR lp.lobby_id <> NEW.lobby_id)
--     ) THEN
--         RAISE EXCEPTION 'User is already in an active lobby.';
--     END IF;

--     -- Check if user is already in an active match
--     -- Only exclude the current match if the trigger is on match_participants
--     IF EXISTS (
--         SELECT 1 FROM match_participants mp
--         JOIN matches m ON mp.match_id = m.id
--         WHERE mp.user_id = NEW.user_id
--         AND m.status IN ('in_progress', 'waiting')
--         AND (TG_TABLE_NAME <> 'match_participants' OR mp.match_id <> NEW.match_id)
--     ) THEN
--         RAISE EXCEPTION 'User is already in an active match.';
--     END IF;

--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

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