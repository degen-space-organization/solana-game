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