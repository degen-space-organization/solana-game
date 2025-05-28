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
