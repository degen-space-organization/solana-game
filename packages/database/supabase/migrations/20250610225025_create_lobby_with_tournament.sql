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

