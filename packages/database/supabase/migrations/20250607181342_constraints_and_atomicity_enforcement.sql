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