-- File: 20250522205135_user_migration.sql

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


-- File: 20250522205631_tournament_migration.sql
CREATE TABLE tournaments (
    id SERIAL,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting',
    max_players INTEGER DEFAULT 8,
    current_players INTEGER DEFAULT 0,
    prize_pool VARCHAR(20) DEFAULT '0',
    created_by INTEGER NOT NULL, -- Tournament owner
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    
    -- Constraints
    CONSTRAINT tournaments_pkey PRIMARY KEY (id),
    CONSTRAINT tournaments_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT tournaments_status_valid CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT tournaments_max_players_positive CHECK (max_players > 0),
    CONSTRAINT tournaments_current_players_non_negative CHECK (current_players >= 0),
    CONSTRAINT tournaments_current_players_max_check CHECK (current_players <= max_players),
    -- CONSTRAINT tournaments_prize_pool_valid CHECK (prize_pool ~ '^[0-9]+'),
    CONSTRAINT tournaments_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT tournaments_started_after_created CHECK (started_at IS NULL OR started_at >= created_at)
);



-- File: 20250522210347_tournament_participant_migration.sql
CREATE TABLE tournament_participants (
    id SERIAL,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    eliminated_at TIMESTAMP NULL,
    final_position INTEGER NULL, -- 1st, 2nd, 3rd, etc.
    is_ready BOOLEAN,
    has_staked BOOLEAN,
    
    -- Constraints
    CONSTRAINT tournament_participants_pkey PRIMARY KEY (id),
    CONSTRAINT tournament_participants_tournament_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT tournament_participants_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT tournament_participants_unique_entry UNIQUE (tournament_id, user_id),
    CONSTRAINT tournament_participants_final_position_positive CHECK (final_position IS NULL OR final_position > 0),
    CONSTRAINT tournament_participants_eliminated_after_joined CHECK (eliminated_at IS NULL OR eliminated_at >= joined_at)
);

--Indexes
CREATE INDEX idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX idx_tournament_participants_user ON tournament_participants(user_id);



-- File: 20250522210436_lobby_migration.sql
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



-- File: 20250522210625_lobby_participant_migration.sql
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
    CONSTRAINT lobby_participants_stake_consistency CHECK (
        (has_staked = FALSE AND stake_transaction_hash IS NULL AND staked_at IS NULL) OR
        (has_staked = TRUE AND stake_transaction_hash IS NOT NULL AND staked_at IS NOT NULL)
    ),
    CONSTRAINT lobby_participants_transaction_hash_not_empty CHECK (
        stake_transaction_hash IS NULL OR LENGTH(TRIM(stake_transaction_hash)) > 0
    )
);

-- Indexes
CREATE INDEX idx_lobby_participants_lobby ON lobby_participants(lobby_id);
CREATE INDEX idx_lobby_participants_user ON lobby_participants(user_id);


-- -- Triggers
-- CREATE TRIGGER trg_prevent_concurrent_lobby
--     BEFORE INSERT OR UPDATE ON lobby_participants
--     FOR EACH ROW EXECUTE FUNCTION prevent_concurrent_participation();


-- File: 20250522210910_match_migration.sql
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
    CONSTRAINT matches_status_valid CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
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



-- File: 20250522211125_match_participation_migration.sql
-- Match participants (exactly 2 players per match)
CREATE TABLE match_participants (
    id SERIAL,
    match_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    position INTEGER NOT NULL, -- Player 1 or Player 2
    
    -- Constraints
    CONSTRAINT match_participants_pkey PRIMARY KEY (id),
    CONSTRAINT match_participants_match_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT match_participants_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT match_participants_position_valid CHECK (position IN (1, 2)),
    CONSTRAINT match_participants_unique_user_per_match UNIQUE (match_id, user_id),
    CONSTRAINT match_participants_unique_position_per_match UNIQUE (match_id, position)
);

--Indexes 
CREATE INDEX idx_match_participants_match ON match_participants(match_id);
CREATE INDEX idx_match_participants_user ON match_participants(user_id);

-- -- Triggers
-- CREATE TRIGGER trg_prevent_concurrent_match
--     BEFORE INSERT OR UPDATE ON match_participants
--     FOR EACH ROW EXECUTE FUNCTION prevent_concurrent_participation();


-- File: 20250522211655_game_round_migration.sql
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
    
    -- Constraints
    CONSTRAINT game_rounds_pkey PRIMARY KEY (id),
    CONSTRAINT game_rounds_match_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT game_rounds_winner_fkey FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT game_rounds_player1_move_valid CHECK (player1_move IN ('rock', 'paper', 'scissors')),
    CONSTRAINT game_rounds_player2_move_valid CHECK (player2_move IN ('rock', 'paper', 'scissors')),
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



-- File: 20250522211900_stake_transaction_migration.sql
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


-- File: 20250522213146_chat_message_migration.sql
CREATE TABLE chat_messages (
    id SERIAL,
    match_id INTEGER NULL,
    lobby_id INTEGER NULL,
    tournament_id INTEGER NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
    CONSTRAINT chat_messages_match_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_lobby_fkey FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_tournament_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_message_not_empty CHECK (LENGTH(TRIM(message)) > 0),
    -- Ensure message belongs to exactly one context
    CONSTRAINT chat_messages_single_context CHECK (
        (match_id IS NOT NULL AND lobby_id IS NULL AND tournament_id IS NULL) OR
        (match_id IS NULL AND lobby_id IS NOT NULL AND tournament_id IS NULL) OR
        (match_id IS NULL AND lobby_id IS NULL AND tournament_id IS NOT NULL) OR
        (match_id IS NULL AND lobby_id IS NULL AND tournament_id IS NULL)
    )
);

-- Indexes
CREATE INDEX idx_chat_messages_match ON chat_messages(match_id);
CREATE INDEX idx_chat_messages_lobby ON chat_messages(lobby_id);
CREATE INDEX idx_chat_messages_tournament ON chat_messages(tournament_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);


