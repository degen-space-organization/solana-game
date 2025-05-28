import type { Tables } from '@/supabase/types';

export interface GameData {
  match: Tables<'matches'>;
  tournament?: Tables<'tournaments'> | null;
  participants: Array<{
    user_id: number;
    position: number;
    users: Tables<'users'>;
  }>;
  rounds: Tables<'game_rounds'>[];
}

export interface GameInfoProps {
  gameData: GameData;
  currentUserId: number | null;
}

export interface TournamentParticipant {
  user_id: number;
  eliminated_at: string | null;
  final_position: number | null;
  users: Tables<'users'>;
}

export interface GameStats {
  player1: {
    user_id: number;
    position: number;
    users: Tables<'users'>;
  } | null;
  player2: {
    user_id: number;
    position: number;
    users: Tables<'users'>;
  } | null;
  player1Score: number;
  player2Score: number;
  totalRounds: number;
  completedRounds: number;
  recentRounds?: Tables<'game_rounds'>[];
}

export interface TournamentStats {
  activePlayers: number;
  eliminatedPlayers: number;
  prizePerWinner: string;
  currentUserEliminated: boolean;
  currentUserPosition: number | null;
}