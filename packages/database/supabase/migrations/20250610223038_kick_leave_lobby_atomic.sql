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