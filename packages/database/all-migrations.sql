-- File: 20250522205135_user_migration.sql

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


-- File: 20250522205631_tournament_migration.sql
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



-- File: 20250522210436_lobby_migration.sql
CREATE TABLE lobbies (
    id SERIAL,
    name VARCHAR(100) NOT NULL, -- Lobby name, can be NULL for 1v1 matches
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
    CONSTRAINT lobbies_status_valid CHECK (status IN ('waiting', 'ready', 'starting', 'closed', 'disbanded', 'withdrawal', 'staking', 'closing')),
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
    CONSTRAINT lobby_participants_transaction_hash_not_empty CHECK (
        stake_transaction_hash IS NULL OR LENGTH(TRIM(stake_transaction_hash)) > 0
    )
);

-- Indexes
CREATE INDEX idx_lobby_participants_lobby ON lobby_participants(lobby_id);
CREATE INDEX idx_lobby_participants_user ON lobby_participants(user_id);





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
    CONSTRAINT matches_status_valid CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled', 'showing_results')),
    CONSTRAINT matches_stake_amount_valid CHECK (stake_amount ~ '^[0-9]+$'),
    CONSTRAINT matches_total_prize_pool_valid CHECK (total_prize_pool ~ '^[0-9]+$'),
    CONSTRAINT matches_tournament_round_positive CHECK (tournament_round IS NULL OR tournament_round > 0),
    CONSTRAINT matches_completed_after_started CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
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
    CONSTRAINT stake_transactions_transaction_hash_not_empty CHECK (LENGTH(TRIM(transaction_hash)) > 0)

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


-- File: 20250531181202_tournament_brackets.sql




-- File: 20250601210347_tournament_participant_migration.sql
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




-- File: 20250607181342_constraints_and_atomicity_enforcement.sql
-- ============================================================================
-- FIXED LOBBY MANAGEMENT - Production-Ready Functions
-- ============================================================================
-- 1. Required Tables and Constraints
-- ============================================================================
CREATE TABLE IF NOT EXISTS used_transactions (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(88) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  lobby_id INTEGER,
  operation_type VARCHAR(50) DEFAULT 'stake',
  claimed_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS withdrawal_locks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  lobby_id INTEGER NOT NULL REFERENCES lobbies(id),
  operation_type VARCHAR(50) NOT NULL,
  locked_at TIMESTAMP DEFAULT NOW(),
  released_at TIMESTAMP,
  tx_signature VARCHAR(88),
  UNIQUE (user_id, lobby_id, operation_type)
);


-- Update lobby status constraint
ALTER TABLE lobbies DROP CONSTRAINT IF EXISTS lobbies_status_valid;
ALTER TABLE lobbies
ADD CONSTRAINT lobbies_status_valid CHECK (
    status IN (
      'waiting',
      'ready',
      'starting',
      'closed',
      'disbanded',
      'withdrawal',
      'staking',
      'closing',
      'pending'
    )
  );


-- Add player count constraint
DO $$ BEGIN IF NOT EXISTS (
  SELECT 1
  FROM pg_constraint
  WHERE conname = 'lobbies_players_within_limit'
    AND conrelid = 'lobbies'::regclass
) THEN
ALTER TABLE lobbies
ADD CONSTRAINT lobbies_players_within_limit CHECK (
    current_players <= max_players
    AND current_players >= 0
  );
END IF;
END $$;


-- FIXED: Proper unique index to prevent concurrent participation
DROP INDEX IF EXISTS idx_user_active_lobby_simple;
-- Create a trigger function to prevent concurrent participation
CREATE OR REPLACE FUNCTION prevent_concurrent_lobby_participation() RETURNS TRIGGER AS $$
BEGIN
  -- Check if user is already in an active lobby (excluding current lobby if UPDATE)
  IF EXISTS (
    SELECT 1
    FROM lobby_participants lp
    JOIN lobbies l ON lp.lobby_id = l.id
    WHERE lp.user_id = NEW.user_id
      AND l.status IN ('waiting', 'ready', 'starting', 'staking', 'pending')
      AND (
        TG_OP = 'INSERT'
        OR lp.lobby_id != NEW.lobby_id
      )
  ) THEN 
    RAISE EXCEPTION 'prevent_concurrent_lobby_participation: User is already participating in an active lobby';
  END IF;

  -- Check if user is already in an active match
  IF EXISTS (
    SELECT 1
    FROM match_participants mp
    JOIN matches m ON mp.match_id = m.id
    WHERE mp.user_id = NEW.user_id
      AND m.status IN ('waiting', 'in_progress', 'showing_results')
  ) THEN 
    RAISE EXCEPTION 'prevent_concurrent_lobby_participation: User is already participating in an active match';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_prevent_concurrent_participation ON lobby_participants;
CREATE TRIGGER trg_prevent_concurrent_participation BEFORE
INSERT
  OR
UPDATE ON lobby_participants FOR EACH ROW EXECUTE FUNCTION prevent_concurrent_lobby_participation();

-- Create simple indexes for performance
CREATE INDEX IF NOT EXISTS idx_lobby_participants_user_id ON lobby_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);

-- Add cleanup for old transactions (run weekly)
CREATE OR REPLACE FUNCTION cleanup_old_transactions() RETURNS void AS $$ BEGIN
DELETE FROM used_transactions
WHERE claimed_at < NOW() - INTERVAL '7 days';
DELETE FROM withdrawal_locks
WHERE locked_at < NOW() - INTERVAL '1 day'
  AND released_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. FIXED: User availability check function
-- ============================================================================
CREATE OR REPLACE FUNCTION check_user_available_for_game(p_user_id INTEGER) RETURNS JSON AS $$
DECLARE
  v_active_lobby INTEGER;
  v_active_match INTEGER;
BEGIN
  -- Check for active lobby (including tournament lobbies)
  SELECT l.id INTO v_active_lobby
  FROM lobby_participants lp
  JOIN lobbies l ON lp.lobby_id = l.id
  WHERE lp.user_id = p_user_id
    AND l.status IN ('waiting', 'ready', 'starting', 'staking', 'pending')
  LIMIT 1;

  IF v_active_lobby IS NOT NULL THEN
    RETURN json_build_object(
      'available', false,
      'reason', 'chk_user_available_for_game: User is already in an active lobby',
      'lobby_id', v_active_lobby
    );
  END IF;

  -- Check for active match
  SELECT m.id INTO v_active_match
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  WHERE mp.user_id = p_user_id
    AND m.status IN ('waiting', 'in_progress', 'showing_results')
  LIMIT 1;

  IF v_active_match IS NOT NULL THEN
    RETURN json_build_object(
      'available', false,
      'reason', 'chk_user_available_for_game: User is in active match',
      'match_id', v_active_match
    );
  END IF;

  RETURN json_build_object('available', true);
END;
$$ LANGUAGE plpgsql;


-- 3. Atomic lobby creation (looks good, minor improvements)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_lobby_atomic(
    p_name VARCHAR,
    p_tournament_id INTEGER,
    p_created_by INTEGER,
    p_stake_amount VARCHAR,
    p_max_players INTEGER,
    p_tx_hash VARCHAR
  ) RETURNS JSON AS $$
DECLARE v_lobby_id INTEGER;
v_participant_id INTEGER;
v_availability JSON;
v_current INTEGER;
BEGIN -- Check user availability
v_availability := check_user_available_for_game(p_created_by);
IF NOT (v_availability->>'available')::BOOLEAN THEN RETURN json_build_object(
  'success',
  false,
  'error',
  v_availability->>'reason'
);
END IF;
-- Validate tournament exists if provided
IF p_tournament_id IS NOT NULL THEN IF NOT EXISTS (
  SELECT 1
  FROM tournaments
  WHERE id = p_tournament_id
    AND status = 'waiting'
) THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Tournament not found or not accepting players'
);
END IF;
END IF;
-- Mark transaction as used
BEGIN
INSERT INTO used_transactions (tx_hash, user_id, operation_type)
VALUES (p_tx_hash, p_created_by, 'lobby_creation');
EXCEPTION
WHEN unique_violation THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Transaction already used'
);
END;
-- Create lobby
INSERT INTO lobbies(
    name,
    tournament_id,
    created_by,
    stake_amount,
    max_players,
    current_players,
    status
  )
VALUES (
    COALESCE(p_name, 'Lobby by user ' || p_created_by),
    p_tournament_id,
    p_created_by,
    p_stake_amount,
    p_max_players,
    1,
    'waiting'
  )
RETURNING id INTO v_lobby_id;
-- Update used_transactions with lobby_id
UPDATE used_transactions
SET lobby_id = v_lobby_id
WHERE tx_hash = p_tx_hash;

-- Add creator as participant
INSERT INTO lobby_participants (
    lobby_id,
    user_id,
    joined_at,
    is_ready,
    has_staked,
    stake_transaction_hash,
    staked_at
  )
VALUES (
    v_lobby_id,
    p_created_by,
    NOW(),
    TRUE,
    TRUE,
    p_tx_hash,
    NOW()
  )
RETURNING id INTO v_participant_id;

-- Record stake transaction
INSERT INTO stake_transactions (
    user_id,
    lobby_id,
    transaction_hash,
    amount,
    transaction_type,
    status,
    confirmed_at
  )
VALUES (
    p_created_by,
    v_lobby_id,
    p_tx_hash,
    p_stake_amount,
    'stake',
    'confirmed',
    NOW()
  );
-- Add to tournament if specified
IF p_tournament_id IS NOT NULL THEN
INSERT INTO tournament_participants (
    tournament_id,
    user_id,
    joined_at,
    is_ready,
    has_staked
  )
VALUES (
    p_tournament_id,
    p_created_by,
    NOW(),
    TRUE,
    TRUE
  );
-- UPDATE tournaments
--   SET current_players = current_players + 1
--   WHERE id = p_tournament_id;
SELECT current_players INTO v_current
FROM tournaments
WHERE id = p_tournament_id FOR
UPDATE;
IF v_current >= max_players THEN RETURN json_build_object('success', false, 'error', 'Tournament full');
END IF;
UPDATE tournaments
SET current_players = v_current + 1
WHERE id = p_tournament_id;
END IF;
RETURN json_build_object(
  'success',
  true,
  'lobby_id',
  v_lobby_id,
  'participant_id',
  v_participant_id
);
EXCEPTION
WHEN OTHERS THEN
DELETE FROM used_transactions
WHERE tx_hash = p_tx_hash;
RETURN json_build_object(
  'success',
  false,
  'error',
  'Failed to create lobby: ' || SQLERRM
);
END;
$$ LANGUAGE plpgsql;
-- 4. FIXED: Race-condition-free lobby join
-- ============================================================================
CREATE OR REPLACE FUNCTION join_lobby_atomic(
    p_lobby_id INTEGER,
    p_user_id INTEGER,
    p_tx_hash VARCHAR DEFAULT NULL
  ) RETURNS JSON AS $$
DECLARE v_lobby RECORD;
v_participant_id INTEGER;
v_availability JSON;
BEGIN -- Check user availability first
v_availability := check_user_available_for_game(p_user_id);
IF NOT (v_availability->>'available')::BOOLEAN THEN RETURN json_build_object(
  'success',
  false,
  'error',
  v_availability->>'reason'
);
END IF;
-- Mark transaction as used if provided
IF p_tx_hash IS NOT NULL THEN BEGIN
INSERT INTO used_transactions(tx_hash, user_id, lobby_id, operation_type)
VALUES (p_tx_hash, p_user_id, p_lobby_id, 'lobby_join');
EXCEPTION
WHEN unique_violation THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Transaction already used'
);
END;
END IF;
-- FIXED: SELECT with lock FIRST, then validate
SELECT * INTO v_lobby
FROM lobbies
WHERE id = p_lobby_id FOR
UPDATE;
IF NOT FOUND THEN IF p_tx_hash IS NOT NULL THEN
DELETE FROM used_transactions
WHERE tx_hash = p_tx_hash;
END IF;
RETURN json_build_object('success', false, 'error', 'Lobby not found');
END IF;
-- Validate lobby state
IF v_lobby.status != 'waiting' THEN IF p_tx_hash IS NOT NULL THEN
DELETE FROM used_transactions
WHERE tx_hash = p_tx_hash;
END IF;
RETURN json_build_object(
  'success',
  false,
  'error',
  'Lobby not accepting players'
);
END IF;
-- Check capacity
IF v_lobby.current_players >= v_lobby.max_players THEN IF p_tx_hash IS NOT NULL THEN
DELETE FROM used_transactions
WHERE tx_hash = p_tx_hash;
END IF;
RETURN json_build_object('success', false, 'error', 'Lobby is full');
END IF;
-- Check if user already in this lobby
IF EXISTS (
  SELECT 1
  FROM lobby_participants
  WHERE lobby_id = p_lobby_id
    AND user_id = p_user_id
) THEN IF p_tx_hash IS NOT NULL THEN
DELETE FROM used_transactions
WHERE tx_hash = p_tx_hash;
END IF;
RETURN json_build_object(
  'success',
  false,
  'error',
  'User already in this lobby'
);
END IF;
-- NOW update the lobby (after all validations)
UPDATE lobbies
SET current_players = current_players + 1
WHERE id = p_lobby_id;
-- Add participant
INSERT INTO lobby_participants (
    lobby_id,
    user_id,
    joined_at,
    is_ready,
    has_staked,
    stake_transaction_hash,
    staked_at
  )
VALUES (
    p_lobby_id,
    p_user_id,
    NOW(),
    (p_tx_hash IS NOT NULL),
    (p_tx_hash IS NOT NULL),
    p_tx_hash,
    CASE
      WHEN p_tx_hash IS NOT NULL THEN NOW()
    END
  )
RETURNING id INTO v_participant_id;
-- Record stake transaction if provided
IF p_tx_hash IS NOT NULL THEN
INSERT INTO stake_transactions(
    user_id,
    lobby_id,
    transaction_hash,
    amount,
    transaction_type,
    status,
    confirmed_at
  )
VALUES (
    p_user_id,
    p_lobby_id,
    p_tx_hash,
    v_lobby.stake_amount,
    'stake',
    'confirmed',
    NOW()
  );
END IF;
-- Add to tournament if lobby is tournament
IF v_lobby.tournament_id IS NOT NULL THEN
INSERT INTO tournament_participants(
    tournament_id,
    user_id,
    joined_at,
    is_ready,
    has_staked
  )
VALUES (
    v_lobby.tournament_id,
    p_user_id,
    NOW(),
    (p_tx_hash IS NOT NULL),
    (p_tx_hash IS NOT NULL)
  );
UPDATE tournaments
SET current_players = current_players + 1
WHERE id = v_lobby.tournament_id;
END IF;
RETURN json_build_object(
  'success',
  true,
  'participant_id',
  v_participant_id,
  'current_players',
  v_lobby.current_players + 1,
  'max_players',
  v_lobby.max_players
);
EXCEPTION
WHEN OTHERS THEN IF p_tx_hash IS NOT NULL THEN
DELETE FROM used_transactions
WHERE tx_hash = p_tx_hash;
END IF;
RETURN json_build_object(
  'success',
  false,
  'error',
  'Failed to join lobby: ' || SQLERRM
);
END;
$$ LANGUAGE plpgsql;
-- 5. Leave lobby function
-- ============================================================================
CREATE OR REPLACE FUNCTION leave_lobby_atomic(
    p_lobby_id INTEGER,
    p_user_id INTEGER,
    p_force_leave BOOLEAN DEFAULT false
  ) RETURNS JSON AS $$
DECLARE v_lobby RECORD;
v_participant RECORD;
v_should_disband BOOLEAN := false;
BEGIN -- Get lobby with lock
SELECT * INTO v_lobby
FROM lobbies
WHERE id = p_lobby_id FOR
UPDATE;
IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Lobby not found');
END IF;
-- Get participant details
SELECT * INTO v_participant
FROM lobby_participants
WHERE lobby_id = p_lobby_id
  AND user_id = p_user_id;
IF NOT FOUND THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'User not in this lobby'
);
END IF;
-- Check if user has staked (can't leave if staked unless forced)
IF v_participant.has_staked
AND NOT p_force_leave THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Cannot leave after staking - use withdraw instead'
);
END IF;
-- Remove from tournament if applicable
IF v_lobby.tournament_id IS NOT NULL THEN
DELETE FROM tournament_participants
WHERE tournament_id = v_lobby.tournament_id
  AND user_id = p_user_id;
UPDATE tournaments
SET current_players = current_players - 1
WHERE id = v_lobby.tournament_id;
END IF;
-- Remove participant
DELETE FROM lobby_participants
WHERE lobby_id = p_lobby_id
  AND user_id = p_user_id;
-- Update lobby player count
UPDATE lobbies
SET current_players = current_players - 1
WHERE id = p_lobby_id;
-- Check if lobby should be disbanded (no players left)
IF v_lobby.current_players - 1 <= 0 THEN v_should_disband := true;
UPDATE lobbies
SET status = 'disbanded',
  disbanded_at = NOW()
WHERE id = p_lobby_id;
END IF;
RETURN json_build_object(
  'success',
  true,
  'disbanded',
  v_should_disband,
  'remaining_players',
  v_lobby.current_players - 1
);
EXCEPTION
WHEN OTHERS THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Failed to leave lobby: ' || SQLERRM
);
END;
$$ LANGUAGE plpgsql;
-- 6. Close lobby function (admin action)
-- ============================================================================
CREATE OR REPLACE FUNCTION close_lobby_atomic(
    p_lobby_id INTEGER,
    p_admin_user_id INTEGER
  ) RETURNS JSON AS $$
DECLARE v_lobby RECORD;
v_participant RECORD;
v_refund_count INTEGER := 0;
BEGIN -- Get lobby with lock
SELECT * INTO v_lobby
FROM lobbies
WHERE id = p_lobby_id FOR
UPDATE;
IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Lobby not found');
END IF;
-- Check admin permissions (lobby creator)
IF v_lobby.created_by != p_admin_user_id THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Only lobby creator can close lobby'
);
END IF;
-- Set lobby status to closing to prevent new operations
UPDATE lobbies
SET status = 'closing'
WHERE id = p_lobby_id;
-- Record refund transactions for all staked participants
FOR v_participant IN
SELECT lp.*,
  u.solana_address
FROM lobby_participants lp
  JOIN users u ON lp.user_id = u.id
WHERE lp.lobby_id = p_lobby_id
  AND lp.has_staked = true LOOP -- Create refund transaction record
INSERT INTO stake_transactions (
    user_id,
    lobby_id,
    transaction_hash,
    amount,
    transaction_type,
    status,
    created_at
  )
VALUES (
    v_participant.user_id,
    p_lobby_id,
    'REFUND_' || p_lobby_id || '_' || v_participant.user_id || '_' || extract(
      epoch
      from now()
    ),
    v_lobby.stake_amount,
    'refund',
    'pending',
    NOW()
  );
v_refund_count := v_refund_count + 1;
END LOOP;
-- Remove from tournament if applicable
IF v_lobby.tournament_id IS NOT NULL THEN
DELETE FROM tournament_participants
WHERE tournament_id = v_lobby.tournament_id
  AND user_id IN (
    SELECT user_id
    FROM lobby_participants
    WHERE lobby_id = p_lobby_id
  );
UPDATE tournaments
SET current_players = current_players - v_lobby.current_players
WHERE id = v_lobby.tournament_id;
END IF;
-- Remove all participants
DELETE FROM lobby_participants
WHERE lobby_id = p_lobby_id;
-- Mark lobby as disbanded
UPDATE lobbies
SET status = 'disbanded',
  disbanded_at = NOW(),
  current_players = 0
WHERE id = p_lobby_id;
RETURN json_build_object(
  'success',
  true,
  'refunds_created',
  v_refund_count,
  'message',
  'Lobby closed and refund transactions created'
);
EXCEPTION
WHEN OTHERS THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Failed to close lobby: ' || SQLERRM
);
END;
$$ LANGUAGE plpgsql;
-- 7. Start match function
-- ============================================================================
CREATE OR REPLACE FUNCTION start_match_atomic(
    p_lobby_id INTEGER,
    p_creator_user_id INTEGER
  ) RETURNS JSON AS $$
DECLARE v_lobby RECORD;
v_match_id INTEGER;
v_participant RECORD;
v_position INTEGER := 1;
BEGIN -- Get lobby with lock
SELECT * INTO v_lobby
FROM lobbies
WHERE id = p_lobby_id FOR
UPDATE;
IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Lobby not found');
END IF;
-- Validate creator permissions
IF v_lobby.created_by != p_creator_user_id THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Only lobby creator can start match'
);
END IF;
-- Validate lobby state
IF v_lobby.status != 'waiting' THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Lobby is not in waiting status'
);
END IF;
IF v_lobby.current_players != v_lobby.max_players THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Not enough players in lobby'
);
END IF;
-- Verify all participants have staked
IF EXISTS (
  SELECT 1
  FROM lobby_participants
  WHERE lobby_id = p_lobby_id
    AND has_staked = false
) THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Not all players have staked'
);
END IF;
-- Create match
INSERT INTO matches (
    lobby_id,
    tournament_id,
    status,
    stake_amount,
    total_prize_pool,
    started_at
  )
VALUES (
    p_lobby_id,
    v_lobby.tournament_id,
    'in_progress',
    v_lobby.stake_amount,
    (
      v_lobby.current_players * v_lobby.stake_amount::bigint
    )::varchar,
    NOW()
  )
RETURNING id INTO v_match_id;
-- Add match participants
FOR v_participant IN
SELECT user_id
FROM lobby_participants
WHERE lobby_id = p_lobby_id
ORDER BY joined_at LOOP
INSERT INTO match_participants (match_id, user_id, position)
VALUES (v_match_id, v_participant.user_id, v_position);
v_position := v_position + 1;
END LOOP;
-- Create first game round
INSERT INTO game_rounds (match_id, round_number, status)
VALUES (v_match_id, 1, 'in_progress');
-- Update lobby status
UPDATE lobbies
SET status = 'closed'
WHERE id = p_lobby_id;
RETURN json_build_object(
  'success',
  true,
  'match_id',
  v_match_id,
  'message',
  'Match started successfully'
);
EXCEPTION
WHEN OTHERS THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Failed to start match: ' || SQLERRM
);
END;
$$ LANGUAGE plpgsql;
-- 8. Stake submission function
-- ============================================================================
-- CREATE OR REPLACE FUNCTION submit_stake_atomic(
--     p_lobby_id INTEGER,
--     p_user_id INTEGER,
--     p_tx_hash VARCHAR
--   ) RETURNS JSON AS $$
-- DECLARE v_lobby RECORD;
-- v_participant RECORD;
-- BEGIN -- Mark transaction as used
-- BEGIN
-- INSERT INTO used_transactions(tx_hash, user_id, lobby_id, operation_type)
-- VALUES (
--     p_tx_hash,
--     p_user_id,
--     p_lobby_id,
--     'stake_submission'
--   );
-- EXCEPTION
-- WHEN unique_violation THEN RETURN json_build_object(
--   'success',
--   false,
--   'error',
--   'Transaction already used'
-- );
-- END;
-- -- Get lobby details
-- SELECT * INTO v_lobby
-- FROM lobbies
-- WHERE id = p_lobby_id;
-- IF NOT FOUND THEN
-- DELETE FROM used_transactions
-- WHERE tx_hash = p_tx_hash;
-- RETURN json_build_object('success', false, 'error', 'Lobby not found');
-- END IF;
-- -- Get participant details
-- SELECT * INTO v_participant
-- FROM lobby_participants
-- WHERE lobby_id = p_lobby_id
--   AND user_id = p_user_id;
-- IF NOT FOUND THEN
-- DELETE FROM used_transactions
-- WHERE tx_hash = p_tx_hash;
-- RETURN json_build_object(
--   'success',
--   false,
--   'error',
--   'User not in this lobby'
-- );
-- END IF;
-- -- Check if already staked
-- IF v_participant.has_staked THEN
-- DELETE FROM used_transactions
-- WHERE tx_hash = p_tx_hash;
-- RETURN json_build_object(
--   'success',
--   false,
--   'error',
--   'User has already staked'
-- );
-- END IF;
-- -- Update participant as staked
-- UPDATE lobby_participants
-- SET has_staked = true,
--   is_ready = true,
--   stake_transaction_hash = p_tx_hash,
--   staked_at = NOW()
-- WHERE lobby_id = p_lobby_id
--   AND user_id = p_user_id;
-- -- Record stake transaction
-- INSERT INTO stake_transactions (
--     user_id,
--     lobby_id,
--     transaction_hash,
--     amount,
--     transaction_type,
--     status,
--     confirmed_at
--   )
-- VALUES (
--     p_user_id,
--     p_lobby_id,
--     p_tx_hash,
--     v_lobby.stake_amount,
--     'stake',
--     'confirmed',
--     NOW()
--   );
-- -- Update tournament participant if applicable
-- IF v_lobby.tournament_id IS NOT NULL THEN
-- UPDATE tournament_participants
-- SET has_staked = true,
--   is_ready = true
-- WHERE tournament_id = v_lobby.tournament_id
--   AND user_id = p_user_id;
-- END IF;
-- RETURN json_build_object(
--   'success',
--   true,
--   'message',
--   'Stake submitted successfully'
-- );
-- EXCEPTION
-- WHEN OTHERS THEN
-- DELETE FROM used_transactions
-- WHERE tx_hash = p_tx_hash;
-- RETURN json_build_object(
--   'success',
--   false,
--   'error',
--   'Failed to submit stake: ' || SQLERRM
-- );
-- END;
-- $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION kick_player_atomic(
    p_lobby_id INTEGER,
    p_admin_user_id INTEGER,
    p_player_id INTEGER
  ) RETURNS JSON AS $$
DECLARE v_lobby RECORD;
v_participant RECORD;
BEGIN -- Get lobby with lock
SELECT * INTO v_lobby
FROM lobbies
WHERE id = p_lobby_id FOR
UPDATE;
IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Lobby not found');
END IF;
-- Check admin permissions (lobby creator)
IF v_lobby.created_by != p_admin_user_id THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Only lobby creator can kick players'
);
END IF;
-- Get participant details
SELECT * INTO v_participant
FROM lobby_participants
WHERE lobby_id = p_lobby_id
  AND user_id = p_player_id;
IF NOT FOUND THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Player not in this lobby'
);
END IF;
-- Can't kick the lobby creator
IF p_player_id = p_admin_user_id THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Cannot kick lobby creator'
);
END IF;
-- Remove from tournament if applicable
IF v_lobby.tournament_id IS NOT NULL THEN
DELETE FROM tournament_participants
WHERE tournament_id = v_lobby.tournament_id
  AND user_id = p_player_id;
UPDATE tournaments
SET current_players = current_players - 1
WHERE id = v_lobby.tournament_id;
END IF;
-- Remove participant
DELETE FROM lobby_participants
WHERE lobby_id = p_lobby_id
  AND user_id = p_player_id;
-- Update lobby player count
UPDATE lobbies
SET current_players = current_players - 1
WHERE id = p_lobby_id;
-- If player had staked, create refund transaction
IF v_participant.has_staked THEN
INSERT INTO stake_transactions (
    user_id,
    lobby_id,
    transaction_hash,
    amount,
    transaction_type,
    status,
    created_at
  )
VALUES (
    p_player_id,
    p_lobby_id,
    'REFUND_' || p_lobby_id || '_' || p_player_id || '_' || extract(
      epoch
      from now()
    ),
    v_lobby.stake_amount,
    'refund',
    'pending',
    NOW()
  );
END IF;
RETURN json_build_object(
  'success',
  true,
  'message',
  'Player kicked successfully',
  'refund_created',
  v_participant.has_staked
);
EXCEPTION
WHEN OTHERS THEN RETURN json_build_object(
  'success',
  false,
  'error',
  'Failed to kick player: ' || SQLERRM
);
END;
$$ LANGUAGE plpgsql;
-- CREATE OR REPLACE FUNCTION withdraw_from_lobby_atomic(p_user_id INTEGER, p_lobby_id INTEGER) RETURNS JSON AS $$
-- DECLARE v_lobby RECORD;
-- v_participant RECORD;
-- v_user RECORD;
-- v_signature TEXT;
-- v_stake_amount_sol NUMERIC;
-- BEGIN -- Get lobby with lock
-- SELECT * INTO v_lobby
-- FROM lobbies
-- WHERE id = p_lobby_id FOR
-- UPDATE;
-- IF NOT FOUND
-- OR v_lobby.status != 'waiting' THEN RETURN json_build_object(
--   'success',
--   false,
--   'error',
--   'Lobby not found or not in valid state'
-- );
-- END IF;
-- -- Get participant with lock
-- SELECT * INTO v_participant
-- FROM lobby_participants
-- WHERE user_id = p_user_id
--   AND lobby_id = p_lobby_id FOR
-- UPDATE;
-- IF NOT FOUND THEN RETURN json_build_object(
--   'success',
--   false,
--   'error',
--   'Participant not found in lobby'
-- );
-- END IF;
-- -- Get user
-- SELECT * INTO v_user
-- FROM users
-- WHERE id = p_user_id;
-- IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'User not found');
-- END IF;
-- -- Convert stake amount to SOL
-- v_stake_amount_sol := CAST(v_lobby.stake_amount AS NUMERIC) / 1e9;
-- -- Process withdrawal
-- v_signature := process_withdrawal(v_user.solana_address, v_stake_amount_sol);
-- IF v_signature IS NULL THEN RETURN json_build_object(
--   'success',
--   false,
--   'error',
--   'Failed to process withdrawal'
-- );
-- END IF;
-- -- Delete participant
-- DELETE FROM lobby_participants
-- WHERE user_id = p_user_id
--   AND lobby_id = p_lobby_id;
-- -- Update lobby
-- UPDATE lobbies
-- SET current_players = current_players - 1,
--   status = CASE
--     WHEN current_players - 1 = 0 THEN 'disbanded'
--     ELSE 'waiting'
--   END,
--   total_prize_pool = CASE
--     WHEN current_players - 1 = 0 THEN '0'
--     ELSE (
--       CAST(stake_amount AS NUMERIC) * (current_players - 1)
--     )::TEXT
--   END
-- WHERE id = p_lobby_id;
-- RETURN json_build_object(
--   'success',
--   true,
--   'message',
--   'Successfully withdrawn from lobby',
--   'signature',
--   v_signature
-- );
-- EXCEPTION
-- WHEN OTHERS THEN RETURN json_build_object(
--   'success',
--   false,
--   'error',
--   'Failed to process withdrawal: ' || SQLERRM
-- );
-- END;
-- $$ LANGUAGE plpgsql;


-- File: 20250610221507_lobby_joining_atomic.sql
-- Migration: Atomic Lobby Join Functions
-- Description: Creates atomic functions for joining lobbies and tournaments to prevent race conditions
-- Version: 001_atomic_lobby_join
-- ============================================================================

-- First, ensure the check_user_available_for_game function exists (it should already)
-- This function is referenced in join_lobby_atomic

-- Create the atomic tournament participant addition function
CREATE OR REPLACE FUNCTION add_tournament_participant_atomic(
  p_tournament_id INTEGER,
  p_user_id INTEGER
) RETURNS JSON AS $$
DECLARE
  v_tournament RECORD;
BEGIN
  -- Get tournament with lock
  SELECT * INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  -- Validate tournament state
  IF v_tournament.status != 'waiting' THEN
    RETURN json_build_object('success', false, 'error', 'Tournament is not accepting players');
  END IF;

  -- Check capacity
  IF v_tournament.current_players >= v_tournament.max_players THEN
    RETURN json_build_object('success', false, 'error', 'Tournament is full');
  END IF;

  -- Check if user already in this tournament
  IF EXISTS (SELECT 1 FROM tournament_participants WHERE tournament_id = p_tournament_id AND user_id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User already in this tournament');
  END IF;

  -- Add participant to tournament
  INSERT INTO tournament_participants (
    tournament_id, user_id, joined_at, is_ready, has_staked
  ) VALUES (
    p_tournament_id, p_user_id, NOW(), false, false
  );

  -- Update tournament current_players count
  UPDATE tournaments
  SET current_players = current_players + 1
  WHERE id = p_tournament_id;

  RETURN json_build_object('success', true, 'message', 'Successfully added to tournament');

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Failed to add to tournament: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Create or replace the main lobby join function
CREATE OR REPLACE FUNCTION join_lobby_as_user_atomic(
  p_lobby_id INTEGER,
  p_user_id INTEGER
) RETURNS JSON AS $$
DECLARE
  v_lobby RECORD;
  v_participant_id INTEGER;
  v_availability JSON;
  v_tournament_result JSON;
BEGIN
  -- Check user availability first
  v_availability := check_user_available_for_game(p_user_id);
  IF NOT (v_availability->>'available')::BOOLEAN THEN
    RETURN json_build_object('success', false, 'error', v_availability->>'reason');
  END IF;

  -- Get lobby with lock FIRST, then validate
  SELECT * INTO v_lobby
  FROM lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Lobby not found');
  END IF;

  -- Validate lobby state
  IF v_lobby.status != 'waiting' THEN
    RETURN json_build_object('success', false, 'error', 'Lobby is not joinable - current status: ' || v_lobby.status);
  END IF;

  -- Check capacity
  IF v_lobby.current_players >= v_lobby.max_players THEN
    RETURN json_build_object('success', false, 'error', 'Lobby is full');
  END IF;

  -- Check if user already in this lobby
  IF EXISTS (SELECT 1 FROM lobby_participants WHERE lobby_id = p_lobby_id AND user_id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User already in this lobby');
  END IF;

  -- If this is a tournament lobby, add user to tournament first
  IF v_lobby.tournament_id IS NOT NULL THEN
    v_tournament_result := add_tournament_participant_atomic(v_lobby.tournament_id, p_user_id);
    IF NOT (v_tournament_result->>'success')::BOOLEAN THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'Failed to join tournament: ' || (v_tournament_result->>'error')
      );
    END IF;
  END IF;

  -- Add participant to lobby
  INSERT INTO lobby_participants (
    lobby_id, user_id, joined_at, is_ready, has_staked
  ) VALUES (
    p_lobby_id, p_user_id, NOW(), false, false
  ) RETURNING id INTO v_participant_id;

  -- Update lobby current_players count
  UPDATE lobbies
  SET current_players = current_players + 1
  WHERE id = p_lobby_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully joined lobby',
    'participant_id', v_participant_id,
    'lobby_id', p_lobby_id,
    'current_players', v_lobby.current_players + 1,
    'is_tournament_lobby', (v_lobby.tournament_id IS NOT NULL)
  );

EXCEPTION WHEN OTHERS THEN
  -- If there was a tournament addition, it will be rolled back by the transaction
  RETURN json_build_object(
    'success', false, 
    'error', 'Failed to join lobby: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

-- Add any missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_lobbies_status_waiting ON lobbies(status) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_tournaments_status_waiting ON tournaments(status) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_lobby_participants_lookup ON lobby_participants(lobby_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_lookup ON tournament_participants(tournament_id, user_id);


-- File: 20250610223038_kick_leave_lobby_atomic.sql
-- ============================================================================
-- ATOMIC LEAVE LOBBY FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION leave_lobby_as_user_atomic(
  p_lobby_id INTEGER,
  p_user_id INTEGER
) RETURNS JSON AS $$
DECLARE
  v_lobby RECORD;
  v_participant RECORD;
  v_new_player_count INTEGER;
  v_should_disband BOOLEAN := false;
BEGIN
  -- Get lobby with lock
  SELECT * INTO v_lobby FROM lobbies 
  WHERE id = p_lobby_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Lobby not found');
  END IF;

  -- Check if lobby is in a state where leaving is allowed
  IF v_lobby.status = 'closing' OR v_lobby.status = 'disbanded' THEN
    RETURN json_build_object('success', false, 'error', 'Lobby is closing or disbanded - cannot leave');
  END IF;

  -- Get participant details with lock
  SELECT * INTO v_participant FROM lobby_participants 
  WHERE lobby_id = p_lobby_id AND user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found in this lobby');
  END IF;

  -- Check if user has staked (cannot leave if staked)
  IF v_participant.has_staked THEN
    RETURN json_build_object('success', false, 'error', 'Cannot leave lobby after staking - use withdraw instead');
  END IF;

  -- Remove from tournament if this is a tournament lobby
  IF v_lobby.tournament_id IS NOT NULL THEN
    -- Remove from tournament_participants
    DELETE FROM tournament_participants 
    WHERE tournament_id = v_lobby.tournament_id AND user_id = p_user_id;
    
    -- Update tournament player count
    UPDATE tournaments 
    SET current_players = current_players - 1 
    WHERE id = v_lobby.tournament_id;
  END IF;

  -- Remove participant from lobby
  DELETE FROM lobby_participants 
  WHERE lobby_id = p_lobby_id AND user_id = p_user_id;

  -- Calculate new player count and determine if lobby should be disbanded
  v_new_player_count := v_lobby.current_players - 1;
  v_should_disband := (v_new_player_count <= 0);

  -- Update lobby
  IF v_should_disband THEN
    UPDATE lobbies 
    SET 
      current_players = 0,
      status = 'disbanded',
      disbanded_at = NOW()
    WHERE id = p_lobby_id;
  ELSE
    UPDATE lobbies 
    SET current_players = v_new_player_count
    WHERE id = p_lobby_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully left lobby',
    'disbanded', v_should_disband,
    'remaining_players', v_new_player_count,
    'was_tournament_lobby', (v_lobby.tournament_id IS NOT NULL)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Failed to leave lobby: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ATOMIC KICK PLAYER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION kick_player_as_admin_atomic(
  p_lobby_id INTEGER,
  p_admin_user_id INTEGER,
  p_player_id INTEGER
) RETURNS JSON AS $$
DECLARE
  v_lobby RECORD;
  v_participant RECORD;
  v_new_player_count INTEGER;
  v_should_disband BOOLEAN := false;
BEGIN
  -- Get lobby with lock
  SELECT * INTO v_lobby FROM lobbies 
  WHERE id = p_lobby_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Lobby not found');
  END IF;

  -- Check if admin is the lobby creator
  IF v_lobby.created_by != p_admin_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Only lobby creator can kick players');
  END IF;

  -- Check if lobby is in a state where kicking is allowed
  IF v_lobby.status = 'closing' OR v_lobby.status = 'disbanded' THEN
    RETURN json_build_object('success', false, 'error', 'Lobby is closing or disbanded - cannot kick players');
  END IF;

  -- Prevent admin from kicking themselves
  IF p_admin_user_id = p_player_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot kick yourself from the lobby');
  END IF;

  -- Get participant details with lock
  SELECT * INTO v_participant FROM lobby_participants 
  WHERE lobby_id = p_lobby_id AND user_id = p_player_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player not found in this lobby');
  END IF;

  -- Check if player has staked (cannot kick if staked)
  IF v_participant.has_staked THEN
    RETURN json_build_object('success', false, 'error', 'Cannot kick a player who has already staked');
  END IF;

  -- Remove from tournament if this is a tournament lobby
  IF v_lobby.tournament_id IS NOT NULL THEN
    -- Remove from tournament_participants
    DELETE FROM tournament_participants 
    WHERE tournament_id = v_lobby.tournament_id AND user_id = p_player_id;
    
    -- Update tournament player count
    UPDATE tournaments 
    SET current_players = current_players - 1 
    WHERE id = v_lobby.tournament_id;
  END IF;

  -- Remove participant from lobby
  DELETE FROM lobby_participants 
  WHERE lobby_id = p_lobby_id AND user_id = p_player_id;

  -- Calculate new player count and determine if lobby should be disbanded
  v_new_player_count := v_lobby.current_players - 1;
  v_should_disband := (v_new_player_count <= 0);

  -- Update lobby
  IF v_should_disband THEN
    UPDATE lobbies 
    SET 
      current_players = 0,
      status = 'disbanded',
      disbanded_at = NOW()
    WHERE id = p_lobby_id;
  ELSE
    UPDATE lobbies 
    SET current_players = v_new_player_count
    WHERE id = p_lobby_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Player kicked successfully',
    'disbanded', v_should_disband,
    'remaining_players', v_new_player_count,
    'was_tournament_lobby', (v_lobby.tournament_id IS NOT NULL),
    'kicked_player_id', p_player_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Failed to kick player: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;


-- File: 20250610225025_create_lobby_with_tournament.sql
-- Migration: Unified Lobby/Tournament Creation System
-- Description: Creates atomic functions for unified lobby and tournament creation
-- Version: 003_unified_lobby_tournament_creation
-- ============================================================================

-- Create the main unified lobby/tournament creation function
CREATE OR REPLACE FUNCTION create_lobby_with_tournament_atomic(
  p_name VARCHAR,
  p_created_by INTEGER,
  p_stake_amount VARCHAR,
  p_max_players INTEGER,
  p_tx_hash VARCHAR
) RETURNS JSON AS $$
DECLARE
  v_lobby_id INTEGER;
  v_tournament_id INTEGER := NULL;
  v_participant_id INTEGER;
  v_availability JSON;
  v_prize_pool VARCHAR;
  v_tournament_name VARCHAR;
BEGIN
  -- Check user availability first
  v_availability := check_user_available_for_game(p_created_by);
  IF NOT (v_availability->>'available')::BOOLEAN THEN
    RETURN json_build_object('success', false, 'error', v_availability->>'reason');
  END IF;

  -- Validate inputs
  IF p_created_by IS NULL OR p_stake_amount IS NULL OR p_max_players IS NULL OR p_tx_hash IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Missing required fields');
  END IF;

  -- Validate max_players
  IF p_max_players NOT IN (2, 4, 8) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid max_players. Must be 2, 4, or 8');
  END IF;

  -- Validate stake_amount against allowed values
  IF p_stake_amount NOT IN ('100000000', '250000000', '500000000', '750000000', '1000000000') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid stake amount');
  END IF;

  -- Mark transaction as used to prevent reuse
  BEGIN
    INSERT INTO used_transactions (tx_hash, user_id, operation_type)
      VALUES (p_tx_hash, p_created_by, 'lobby_creation');
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Transaction already used');
  END;

  -- Create tournament first if max_players > 2
  IF p_max_players > 2 THEN
    -- Calculate prize pool
    v_prize_pool := (p_stake_amount::bigint * p_max_players)::varchar;
    
    -- Generate tournament name
    v_tournament_name := COALESCE(p_name, 'Tournament by user ' || p_created_by);
    
    -- Create tournament
    INSERT INTO tournaments (
      name, created_by, max_players, prize_pool, 
      current_players, status, created_at
    ) VALUES (
      v_tournament_name, p_created_by, p_max_players, v_prize_pool,
      0, 'waiting', NOW()
    ) RETURNING id INTO v_tournament_id;

    -- Add creator as tournament participant
    INSERT INTO tournament_participants (
      tournament_id, user_id, joined_at, is_ready, has_staked
    ) VALUES (
      v_tournament_id, p_created_by, NOW(), true, true
    );

    -- Update tournament player count
    UPDATE tournaments 
    SET current_players = 1 
    WHERE id = v_tournament_id;
  END IF;

  -- Create lobby (linked to tournament if created)
  INSERT INTO lobbies (
    name, tournament_id, created_by, stake_amount, 
    max_players, current_players, status, created_at
  ) VALUES (
    COALESCE(p_name, 'Lobby by user ' || p_created_by),
    v_tournament_id, p_created_by, p_stake_amount,
    p_max_players, 1, 'waiting', NOW()
  ) RETURNING id INTO v_lobby_id;

  -- Add creator as lobby participant (already staked since they sent the transaction)
  INSERT INTO lobby_participants (
    lobby_id, user_id, joined_at, is_ready, has_staked,
    stake_transaction_hash, staked_at
  ) VALUES (
    v_lobby_id, p_created_by, NOW(), true, true,
    p_tx_hash, NOW()
  ) RETURNING id INTO v_participant_id;

  -- Update used_transactions with lobby_id
  UPDATE used_transactions 
  SET lobby_id = v_lobby_id
  WHERE tx_hash = p_tx_hash;

  RETURN json_build_object(
    'success', true,
    'lobby_id', v_lobby_id,
    'tournament_id', v_tournament_id,
    'participant_id', v_participant_id,
    'is_tournament_lobby', (v_tournament_id IS NOT NULL),
    'message', CASE 
      WHEN v_tournament_id IS NOT NULL 
      THEN 'Tournament and lobby created successfully'
      ELSE 'Lobby created successfully'
    END
  );

EXCEPTION WHEN OTHERS THEN
  -- Clean up transaction record on any error
  DELETE FROM used_transactions WHERE tx_hash = p_tx_hash;
  RETURN json_build_object('success', false, 'error', 'Failed to create lobby: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Create cleanup function for failed validations
CREATE OR REPLACE FUNCTION cleanup_failed_lobby_creation(
  p_lobby_id INTEGER,
  p_tournament_id INTEGER DEFAULT NULL,
  p_user_id INTEGER DEFAULT NULL,
  p_tx_hash VARCHAR DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_cleanup_count INTEGER := 0;
BEGIN
  -- Remove lobby participant
  DELETE FROM lobby_participants 
  WHERE lobby_id = p_lobby_id AND user_id = p_user_id;
  
  IF FOUND THEN
    v_cleanup_count := v_cleanup_count + 1;
  END IF;

  -- Remove tournament participant if tournament exists
  IF p_tournament_id IS NOT NULL THEN
    DELETE FROM tournament_participants 
    WHERE tournament_id = p_tournament_id AND user_id = p_user_id;
    
    IF FOUND THEN
      v_cleanup_count := v_cleanup_count + 1;
    END IF;
    
    -- Delete tournament if no participants remain
    DELETE FROM tournaments 
    WHERE id = p_tournament_id AND current_players <= 1;
    
    IF FOUND THEN
      v_cleanup_count := v_cleanup_count + 1;
    END IF;
  END IF;

  -- Delete lobby if no participants remain
  DELETE FROM lobbies 
  WHERE id = p_lobby_id AND current_players <= 1;
  
  IF FOUND THEN
    v_cleanup_count := v_cleanup_count + 1;
  END IF;

  -- Remove the transaction from used_transactions
  DELETE FROM used_transactions WHERE tx_hash = p_tx_hash;
  
  IF FOUND THEN
    v_cleanup_count := v_cleanup_count + 1;
  END IF;

  RETURN json_build_object(
    'success', true,
    'cleanup_count', v_cleanup_count,
    'message', 'Cleanup completed for failed lobby creation'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Cleanup failed: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Create transaction validation helper function
CREATE OR REPLACE FUNCTION validate_lobby_creation_transaction(
  p_tx_hash VARCHAR,
  p_user_id INTEGER,
  p_lobby_id INTEGER,
  p_expected_amount_lamports BIGINT
) RETURNS JSON AS $$
DECLARE
  v_stake_record_exists BOOLEAN;
BEGIN
  -- Check if stake record already exists
  SELECT EXISTS(
    SELECT 1 FROM stake_transactions 
    WHERE transaction_hash = p_tx_hash 
    AND user_id = p_user_id 
    AND lobby_id = p_lobby_id
  ) INTO v_stake_record_exists;
  
  -- Create stake record if it doesn't exist
  IF NOT v_stake_record_exists THEN
    INSERT INTO stake_transactions (
      user_id, lobby_id, transaction_hash, amount,
      transaction_type, status, confirmed_at
    ) VALUES (
      p_user_id, p_lobby_id, p_tx_hash, p_expected_amount_lamports::varchar,
      'stake', 'confirmed', NOW()
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Transaction validation completed',
    'stake_record_created', NOT v_stake_record_exists
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Transaction validation failed: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;


-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_used_transactions_tx_hash ON used_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_used_transactions_user_operation ON used_transactions(user_id, operation_type);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by_status ON tournaments(created_by, status);
CREATE INDEX IF NOT EXISTS idx_lobbies_created_by_status ON lobbies(created_by, status);




-- File: 20250611204601_close_lobby_or_tournament_atomic.sql
-- ============================================================================
-- COMPLETE FIX MIGRATION - Lobby Creation and Closure Issues
-- Version: 005_complete_lobby_fix
-- ============================================================================

-- Add missing columns to stake_transactions if they don't exist
ALTER TABLE stake_transactions 
ADD COLUMN IF NOT EXISTS blockchain_transaction_hash VARCHAR(88);

ALTER TABLE stake_transactions 
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

-- ============================================================================
-- 1. EMERGENCY CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION emergency_cleanup_lobby(
    p_lobby_id INTEGER
) RETURNS JSON AS $$
DECLARE
    v_lobby RECORD;
    v_cleanup_count INTEGER := 0;
BEGIN
    -- Get lobby info
    SELECT * INTO v_lobby FROM lobbies WHERE id = p_lobby_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Lobby not found');
    END IF;
    
    -- Remove all participants
    DELETE FROM lobby_participants WHERE lobby_id = p_lobby_id;
    GET DIAGNOSTICS v_cleanup_count = ROW_COUNT;
    
    -- Remove from tournament if applicable
    IF v_lobby.tournament_id IS NOT NULL THEN
        DELETE FROM tournament_participants 
        WHERE tournament_id = v_lobby.tournament_id;
        
        -- Disband tournament
        UPDATE tournaments 
        SET status = 'disbanded', disbanded_at = NOW(), current_players = 0
        WHERE id = v_lobby.tournament_id;
    END IF;
    
    -- Delete the lobby
    DELETE FROM lobbies WHERE id = p_lobby_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Lobby emergency cleanup completed',
        'participants_removed', v_cleanup_count,
        'lobby_deleted', true
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Emergency cleanup failed: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. FIXED CLOSE LOBBY FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION close_lobby_atomic_fixed(
  p_lobby_id INTEGER,
  p_admin_user_id INTEGER
) RETURNS JSON AS $$
DECLARE
  v_lobby RECORD;
  v_participant RECORD;
  v_refund_count INTEGER := 0;
  v_participants_for_refund JSON[] := '{}';
  v_participant_info JSON;
  v_total_refund_amount BIGINT := 0;
BEGIN
  -- Get lobby with lock
  SELECT * INTO v_lobby FROM lobbies 
  WHERE id = p_lobby_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Lobby not found');
  END IF;

  -- Check admin permissions (lobby creator)
  IF v_lobby.created_by != p_admin_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Only lobby creator can close lobby');
  END IF;

  -- Check if lobby is already being closed or disbanded
  IF v_lobby.status IN ('closing', 'disbanded') THEN
    RETURN json_build_object('success', false, 'error', 'Lobby is already being closed or disbanded');
  END IF;

  -- Set lobby status to closing to prevent new operations
  UPDATE lobbies SET status = 'closing' WHERE id = p_lobby_id;

  -- FIXED: Get ALL participants, including those who might not be marked as staked
  -- This handles the case where the creator paid but isn't marked as has_staked = true
  FOR v_participant IN 
    SELECT lp.*, u.solana_address, u.id as user_id
    FROM lobby_participants lp
    JOIN users u ON lp.user_id = u.id
    WHERE lp.lobby_id = p_lobby_id
  LOOP
    -- Check if this participant should get a refund
    -- Refund if: 1) has_staked = true, OR 2) is the lobby creator (who paid the initial stake)
    IF v_participant.has_staked OR v_participant.user_id = v_lobby.created_by THEN
      -- Create refund transaction record
      INSERT INTO stake_transactions (
        user_id, lobby_id, transaction_hash, amount, 
        transaction_type, status, created_at
      ) VALUES (
        v_participant.user_id, p_lobby_id, 
        'REFUND_' || p_lobby_id || '_' || v_participant.user_id || '_' || extract(epoch from now()),
        v_lobby.stake_amount, 'refund', 'pending', NOW()
      );
      
      -- Build participant info for refund processing
      v_participant_info := json_build_object(
        'user_id', v_participant.user_id,
        'solana_address', v_participant.solana_address,
        'stake_amount_lamports', v_lobby.stake_amount,
        'stake_amount_sol', (v_lobby.stake_amount::bigint / 1000000000.0),
        'was_marked_as_staked', v_participant.has_staked,
        'is_creator', (v_participant.user_id = v_lobby.created_by)
      );
      
      v_participants_for_refund := v_participants_for_refund || v_participant_info;
      v_refund_count := v_refund_count + 1;
      v_total_refund_amount := v_total_refund_amount + v_lobby.stake_amount::bigint;
    END IF;
  END LOOP;

  -- Remove from tournament if applicable
  IF v_lobby.tournament_id IS NOT NULL THEN
    DELETE FROM tournament_participants 
    WHERE tournament_id = v_lobby.tournament_id 
    AND user_id IN (
      SELECT user_id FROM lobby_participants WHERE lobby_id = p_lobby_id
    );
    
    UPDATE tournaments 
    SET current_players = current_players - v_lobby.current_players 
    WHERE id = v_lobby.tournament_id;
    
    -- If tournament has no players left, disband it
    UPDATE tournaments 
    SET status = 'cancelled'
    WHERE id = v_lobby.tournament_id AND current_players <= 0;
  END IF;

  -- Remove all participants
  DELETE FROM lobby_participants WHERE lobby_id = p_lobby_id;

  -- Mark lobby as disbanded
  UPDATE lobbies 
  SET status = 'disbanded', disbanded_at = NOW(), current_players = 0 
  WHERE id = p_lobby_id;

  RETURN json_build_object(
    'success', true,
    'refunds_created', v_refund_count,
    'participants_for_refund', v_participants_for_refund,
    'total_refund_amount_lamports', v_total_refund_amount,
    'total_refund_amount_sol', (v_total_refund_amount / 1000000000.0),
    'tournament_disbanded', (v_lobby.tournament_id IS NOT NULL),
    'message', 'Lobby closed and refund transactions created'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Failed to close lobby: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. REFUND STATUS UPDATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_refund_transaction_status(
  p_lobby_id INTEGER,
  p_user_id INTEGER,
  p_blockchain_tx_hash VARCHAR,
  p_status VARCHAR DEFAULT 'completed'
) RETURNS JSON AS $$
BEGIN
  UPDATE stake_transactions 
  SET 
    status = p_status,
    blockchain_transaction_hash = p_blockchain_tx_hash,
    processed_at = NOW()
  WHERE lobby_id = p_lobby_id 
    AND user_id = p_user_id 
    AND transaction_type = 'refund'
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Refund transaction not found');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Refund transaction updated');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Failed to update refund status: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. ENSURE CORRECT LOBBY CREATION FUNCTION EXISTS
-- ============================================================================
-- (This should already exist from previous migration, but ensuring it's here)

CREATE OR REPLACE FUNCTION create_lobby_with_tournament_atomic(
  p_name VARCHAR,
  p_created_by INTEGER,
  p_stake_amount VARCHAR,
  p_max_players INTEGER,
  p_tx_hash VARCHAR
) RETURNS JSON AS $$
DECLARE
  v_lobby_id INTEGER;
  v_tournament_id INTEGER := NULL;
  v_participant_id INTEGER;
  v_availability JSON;
  v_prize_pool VARCHAR;
  v_tournament_name VARCHAR;
BEGIN
  -- Check user availability first
  v_availability := check_user_available_for_game(p_created_by);
  IF NOT (v_availability->>'available')::BOOLEAN THEN
    RETURN json_build_object('success', false, 'error', v_availability->>'reason');
  END IF;

  -- Validate inputs
  IF p_created_by IS NULL OR p_stake_amount IS NULL OR p_max_players IS NULL OR p_tx_hash IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Missing required fields');
  END IF;

  -- Validate max_players
  IF p_max_players NOT IN (2, 4, 8) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid max_players. Must be 2, 4, or 8');
  END IF;

  -- Validate stake_amount against allowed values
  IF p_stake_amount NOT IN ('100000000', '250000000', '500000000', '750000000', '1000000000') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid stake amount');
  END IF;

  -- Mark transaction as used to prevent reuse
  BEGIN
    INSERT INTO used_transactions (tx_hash, user_id, operation_type)
      VALUES (p_tx_hash, p_created_by, 'lobby_creation');
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Transaction already used');
  END;

  -- Create tournament first if max_players > 2
  IF p_max_players > 2 THEN
    -- Calculate prize pool
    v_prize_pool := (p_stake_amount::bigint * p_max_players)::varchar;
    
    -- Generate tournament name
    v_tournament_name := COALESCE(p_name, 'Tournament by user ' || p_created_by);
    
    -- Create tournament
    INSERT INTO tournaments (
      name, created_by, max_players, prize_pool, 
      current_players, status, created_at
    ) VALUES (
      v_tournament_name, p_created_by, p_max_players, v_prize_pool,
      0, 'waiting', NOW()
    ) RETURNING id INTO v_tournament_id;

    -- Add creator as tournament participant
    INSERT INTO tournament_participants (
      tournament_id, user_id, joined_at, is_ready, has_staked
    ) VALUES (
      v_tournament_id, p_created_by, NOW(), true, true
    );

    -- Update tournament player count
    UPDATE tournaments 
    SET current_players = 1 
    WHERE id = v_tournament_id;
  END IF;

  -- Create lobby (linked to tournament if created)
  INSERT INTO lobbies (
    name, tournament_id, created_by, stake_amount, 
    max_players, current_players, status, created_at
  ) VALUES (
    COALESCE(p_name, 'Lobby by user ' || p_created_by),
    v_tournament_id, p_created_by, p_stake_amount,
    p_max_players, 1, 'waiting', NOW()
  ) RETURNING id INTO v_lobby_id;

  -- CRITICAL: Add creator as lobby participant (already staked since they sent the transaction)
  INSERT INTO lobby_participants (
    lobby_id, user_id, joined_at, is_ready, has_staked,
    stake_transaction_hash, staked_at
  ) VALUES (
    v_lobby_id, p_created_by, NOW(), true, true,
    p_tx_hash, NOW()
  ) RETURNING id INTO v_participant_id;

  -- Update used_transactions with lobby_id
  UPDATE used_transactions 
  SET lobby_id = v_lobby_id
  WHERE tx_hash = p_tx_hash;

  RETURN json_build_object(
    'success', true,
    'lobby_id', v_lobby_id,
    'tournament_id', v_tournament_id,
    'participant_id', v_participant_id,
    'is_tournament_lobby', (v_tournament_id IS NOT NULL),
    'message', CASE 
      WHEN v_tournament_id IS NOT NULL 
      THEN 'Tournament and lobby created successfully'
      ELSE 'Lobby created successfully'
    END
  );

EXCEPTION WHEN OTHERS THEN
  -- Clean up transaction record on any error
  DELETE FROM used_transactions WHERE tx_hash = p_tx_hash;
  RETURN json_build_object('success', false, 'error', 'Failed to create lobby: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ADD PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stake_transactions_lobby_user_type ON stake_transactions(lobby_id, user_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_stake_transactions_status ON stake_transactions(status);
CREATE INDEX IF NOT EXISTS idx_stake_transactions_refund_pending ON stake_transactions(transaction_type, status) WHERE transaction_type = 'refund' AND status = 'pending';
CREATE INDEX IF NOT EXISTS idx_lobby_participants_lobby_user ON lobby_participants(lobby_id, user_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_creator_status ON lobbies(created_by, status);

-- ============================================================================
-- 6. IMMEDIATE CLEANUP (run after migration)
-- ============================================================================



-- File: 20250611221922_withdraw_from_lobby_atomic.sql
-- ============================================================================
-- ATOMIC WITHDRAW FROM LOBBY MIGRATION
-- Description: Creates atomic withdrawal functionality for lobbies and tournaments
-- Version: 007_atomic_withdraw_from_lobby
-- ============================================================================

-- Update stake_transactions table to support withdrawal transaction type
ALTER TABLE stake_transactions 
DROP CONSTRAINT IF EXISTS stake_transactions_type_valid;

ALTER TABLE stake_transactions 
ADD CONSTRAINT stake_transactions_type_valid 
CHECK (transaction_type IN ('stake', 'prize_payout', 'refund', 'withdrawal'));

-- Ensure we have the columns we need (from previous migrations)
ALTER TABLE stake_transactions 
ADD COLUMN IF NOT EXISTS blockchain_transaction_hash VARCHAR(88);

ALTER TABLE stake_transactions 
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

-- ============================================================================
-- 1. ATOMIC WITHDRAW FROM LOBBY FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION withdraw_from_lobby_atomic(
  p_lobby_id INTEGER,
  p_user_id INTEGER
) RETURNS JSON AS $$
DECLARE
  v_lobby RECORD;
  v_participant RECORD;
  v_user RECORD;
  v_new_player_count INTEGER;
  v_should_disband BOOLEAN := false;
  v_withdrawal_info JSON;
BEGIN
  -- Get user information first
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Get lobby with lock
  SELECT * INTO v_lobby FROM lobbies 
  WHERE id = p_lobby_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Lobby not found');
  END IF;

  -- Check if lobby is in a valid state for withdrawal
  IF v_lobby.status NOT IN ('waiting', 'ready') THEN
    RETURN json_build_object('success', false, 'error', 'Lobby is not in a valid state for withdrawal');
  END IF;

  -- Get participant details with lock
  SELECT * INTO v_participant FROM lobby_participants 
  WHERE lobby_id = p_lobby_id AND user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found in this lobby');
  END IF;

  -- Check if user has actually staked (only staked participants can withdraw)
  IF NOT v_participant.has_staked THEN
    RETURN json_build_object('success', false, 'error', 'Cannot withdraw - user has not staked yet. Use leave instead.');
  END IF;

  -- Set lobby status to withdrawal to prevent other operations
  UPDATE lobbies SET status = 'withdrawal' WHERE id = p_lobby_id;

  -- Remove from tournament if this is a tournament lobby
  IF v_lobby.tournament_id IS NOT NULL THEN
    DELETE FROM tournament_participants 
    WHERE tournament_id = v_lobby.tournament_id AND user_id = p_user_id;
    
    -- Update tournament player count
    UPDATE tournaments 
    SET current_players = current_players - 1 
    WHERE id = v_lobby.tournament_id;
  END IF;

  -- Remove participant from lobby
  DELETE FROM lobby_participants 
  WHERE lobby_id = p_lobby_id AND user_id = p_user_id;

  -- Calculate new player count and determine if lobby should be disbanded
  v_new_player_count := v_lobby.current_players - 1;
  v_should_disband := (v_new_player_count <= 0);

  -- Update lobby or disband it
  IF v_should_disband THEN
    -- If no players remain, disband the lobby
    UPDATE lobbies 
    SET 
      current_players = 0,
      status = 'disbanded',
      disbanded_at = NOW()
    WHERE id = p_lobby_id;
    
    -- If tournament lobby, also disband the tournament if empty
    IF v_lobby.tournament_id IS NOT NULL THEN
      UPDATE tournaments 
      SET status = 'disbanded', disbanded_at = NOW()
      WHERE id = v_lobby.tournament_id AND current_players <= 0;
    END IF;
  ELSE
    -- Update lobby with new player count and reset status to waiting
    UPDATE lobbies 
    SET 
      current_players = v_new_player_count,
      status = 'waiting'
    WHERE id = p_lobby_id;
  END IF;

  -- Create withdrawal transaction record for audit trail
  INSERT INTO stake_transactions (
    user_id, lobby_id, transaction_hash, amount, 
    transaction_type, status, created_at
  ) VALUES (
    p_user_id, p_lobby_id, 
    'WITHDRAW_' || p_lobby_id || '_' || p_user_id || '_' || extract(epoch from now()),
    v_lobby.stake_amount, 'withdrawal', 'pending', NOW()
  );

  -- Build withdrawal info for blockchain processing
  v_withdrawal_info := json_build_object(
    'user_id', p_user_id,
    'solana_address', v_user.solana_address,
    'stake_amount_lamports', v_lobby.stake_amount,
    'stake_amount_sol', (v_lobby.stake_amount::bigint / 1000000000.0),
    'original_stake_tx_hash', v_participant.stake_transaction_hash
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully withdrawn from lobby',
    'lobby_disbanded', v_should_disband,
    'remaining_players', v_new_player_count,
    'was_tournament_lobby', (v_lobby.tournament_id IS NOT NULL),
    'withdrawal_info', v_withdrawal_info
  );

EXCEPTION WHEN OTHERS THEN
  -- Rollback lobby status if it was changed
  BEGIN
    UPDATE lobbies SET status = v_lobby.status WHERE id = p_lobby_id;
  EXCEPTION WHEN OTHERS THEN
    -- If rollback fails, log but don't fail the main function
    NULL;
  END;
  RETURN json_build_object('success', false, 'error', 'Failed to withdraw from lobby: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. WITHDRAWAL TRANSACTION STATUS UPDATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_withdrawal_transaction_status(
  p_lobby_id INTEGER,
  p_user_id INTEGER,
  p_blockchain_tx_hash VARCHAR,
  p_status VARCHAR DEFAULT 'completed'
) RETURNS JSON AS $$
BEGIN
  UPDATE stake_transactions 
  SET 
    status = p_status,
    blockchain_transaction_hash = p_blockchain_tx_hash,
    processed_at = NOW()
  WHERE lobby_id = p_lobby_id 
    AND user_id = p_user_id 
    AND transaction_type = 'withdrawal'
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal transaction not found');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Withdrawal transaction updated');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Failed to update withdrawal status: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. PERFORMANCE INDEXES FOR WITHDRAWALS
-- ============================================================================

-- Index for withdrawal transaction lookups
CREATE INDEX IF NOT EXISTS idx_stake_transactions_withdrawal_lookup 
ON stake_transactions(lobby_id, user_id, transaction_type, status) 
WHERE transaction_type = 'withdrawal';

-- Index for pending withdrawals monitoring
CREATE INDEX IF NOT EXISTS idx_stake_transactions_pending_withdrawals 
ON stake_transactions(transaction_type, status, created_at) 
WHERE transaction_type = 'withdrawal' AND status = 'pending';

-- Index for user withdrawal history
CREATE INDEX IF NOT EXISTS idx_stake_transactions_user_withdrawals 
ON stake_transactions(user_id, transaction_type, created_at) 
WHERE transaction_type = 'withdrawal';

-- ============================================================================
-- 4. MONITORING FUNCTIONS
-- ============================================================================

-- Function to check for pending withdrawals
CREATE OR REPLACE FUNCTION check_pending_withdrawals() RETURNS JSON AS $$
DECLARE
  v_pending_count INTEGER;
  v_failed_count INTEGER;
  v_old_pending_count INTEGER;
BEGIN
  -- Count pending withdrawals
  SELECT COUNT(*) INTO v_pending_count
  FROM stake_transactions 
  WHERE transaction_type = 'withdrawal' AND status = 'pending';

  -- Count failed withdrawals
  SELECT COUNT(*) INTO v_failed_count
  FROM stake_transactions 
  WHERE transaction_type = 'withdrawal' AND status = 'failed';

  -- Count old pending withdrawals (more than 1 hour old)
  SELECT COUNT(*) INTO v_old_pending_count
  FROM stake_transactions 
  WHERE transaction_type = 'withdrawal' 
    AND status = 'pending' 
    AND created_at < NOW() - INTERVAL '1 hour';

  RETURN json_build_object(
    'pending_withdrawals', v_pending_count,
    'failed_withdrawals', v_failed_count,
    'old_pending_withdrawals', v_old_pending_count,
    'needs_attention', (v_failed_count > 0 OR v_old_pending_count > 0)
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get withdrawal statistics
CREATE OR REPLACE FUNCTION get_withdrawal_stats() RETURNS JSON AS $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'total_withdrawals', COUNT(*),
    'completed_withdrawals', COUNT(*) FILTER (WHERE status = 'completed'),
    'failed_withdrawals', COUNT(*) FILTER (WHERE status = 'failed'),
    'pending_withdrawals', COUNT(*) FILTER (WHERE status = 'pending'),
    'total_amount_withdrawn', COALESCE(SUM(amount::bigint) FILTER (WHERE status = 'completed'), 0),
    'average_withdrawal_amount', COALESCE(AVG(amount::bigint) FILTER (WHERE status = 'completed'), 0)
  ) INTO v_stats
  FROM stake_transactions 
  WHERE transaction_type = 'withdrawal';
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permissions if needed
-- GRANT EXECUTE ON FUNCTION withdraw_from_lobby_atomic TO your_app_role;
-- GRANT EXECUTE ON FUNCTION update_withdrawal_transaction_status TO your_app_role;
-- GRANT EXECUTE ON FUNCTION check_pending_withdrawals TO your_app_role;
-- GRANT EXECUTE ON FUNCTION get_withdrawal_stats TO your_app_role;


-- File: 20250611225232_submit_stake_for_lobby.sql
-- ============================================================================
-- ATOMIC STAKE SUBMISSION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_stake_atomic(
  p_lobby_id INTEGER,
  p_user_id INTEGER,
  p_tx_hash VARCHAR
) RETURNS JSON AS $$
DECLARE
  v_lobby RECORD;
  v_participant RECORD;
  v_user RECORD;
BEGIN
  -- Get user information
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Mark transaction as used to prevent reuse
  BEGIN
    INSERT INTO used_transactions(tx_hash, user_id, lobby_id, operation_type)
      VALUES (p_tx_hash, p_user_id, p_lobby_id, 'stake_submission');
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Transaction already used');
  END;

  -- Get lobby details with lock
  SELECT * INTO v_lobby FROM lobbies 
  WHERE id = p_lobby_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    DELETE FROM used_transactions WHERE tx_hash = p_tx_hash;
    RETURN json_build_object('success', false, 'error', 'Lobby not found');
  END IF;

  -- Check if lobby is in valid state for staking
  IF v_lobby.status NOT IN ('waiting', 'ready') THEN
    DELETE FROM used_transactions WHERE tx_hash = p_tx_hash;
    RETURN json_build_object('success', false, 'error', 'Lobby is not accepting stakes');
  END IF;

  -- Get participant details with lock
  SELECT * INTO v_participant FROM lobby_participants 
  WHERE lobby_id = p_lobby_id AND user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    DELETE FROM used_transactions WHERE tx_hash = p_tx_hash;
    RETURN json_build_object('success', false, 'error', 'User not in this lobby');
  END IF;

  -- Check if user has already staked
  IF v_participant.has_staked THEN
    DELETE FROM used_transactions WHERE tx_hash = p_tx_hash;
    RETURN json_build_object('success', false, 'error', 'User has already staked');
  END IF;

  -- Update participant as staked
  UPDATE lobby_participants 
  SET 
    has_staked = true, 
    is_ready = true, 
    stake_transaction_hash = p_tx_hash, 
    staked_at = NOW()
  WHERE lobby_id = p_lobby_id AND user_id = p_user_id;

  -- Record stake transaction
  INSERT INTO stake_transactions (
    user_id, lobby_id, transaction_hash, amount,
    transaction_type, status, confirmed_at
  ) VALUES (
    p_user_id, p_lobby_id, p_tx_hash, v_lobby.stake_amount,
    'stake', 'confirmed', NOW()
  );

  -- Update tournament participant if this is a tournament lobby
  IF v_lobby.tournament_id IS NOT NULL THEN
    UPDATE tournament_participants 
    SET has_staked = true, is_ready = true
    WHERE tournament_id = v_lobby.tournament_id AND user_id = p_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Stake submitted successfully',
    'lobby_id', p_lobby_id,
    'user_id', p_user_id,
    'stake_amount', v_lobby.stake_amount,
    'transaction_hash', p_tx_hash,
    'is_tournament_lobby', (v_lobby.tournament_id IS NOT NULL)
  );

EXCEPTION WHEN OTHERS THEN
  -- Clean up transaction record on any error
  DELETE FROM used_transactions WHERE tx_hash = p_tx_hash;
  RETURN json_build_object('success', false, 'error', 'Failed to submit stake: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql;


