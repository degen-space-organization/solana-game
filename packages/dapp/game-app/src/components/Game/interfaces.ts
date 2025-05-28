
// Types based on your database schema
export interface User {
  id: number;
  nickname: string | null;
  solana_address: string;
  matches_won: number | null;
  matches_lost: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Match {
  id: number;
  tournament_id: number | null;
  status: string;
  stake_amount: string;
  total_prize_pool: string;
  winner_id: number | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface Tournament {
  id: number;
  name: string;
  status: string;
  max_players: number;
  current_players: number;
  prize_pool: string;
  created_at: string;
  started_at: string | null;
}

export interface MatchParticipant {
  user_id: number | null;
  position: number | null;
  users: User;
}

export interface CurrentGameInfo {
  match: Match;
  tournament?: Tournament | null;
  participants: MatchParticipant[];
  isUserInGame: boolean;
}

export interface GameInformationProps {
  userWalletAddress: string | null;
}