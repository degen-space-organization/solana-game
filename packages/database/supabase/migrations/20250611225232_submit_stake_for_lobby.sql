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