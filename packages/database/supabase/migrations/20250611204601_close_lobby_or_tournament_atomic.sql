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
