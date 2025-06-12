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