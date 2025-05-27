// types/lobby.ts
export interface User {
  id: number;
  solana_address: string;
  nickname: string | null;
  matches_won: number;
  matches_lost: number;
  created_at: string;
  updated_at: string;
}

export interface Tournament {
  id: number;
  name: string;
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  max_players: number;
  current_players: number;
  prize_pool: string; // in lamports
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Lobby {
  id: number;
  name: string | null;
  tournament_id: number | null;
  status: 'waiting' | 'ready' | 'starting' | 'closed' | 'disbanded';
  max_players: number;
  current_players: number;
  stake_amount: string; // in lamports: '250000000', '500000000', '750000000', '1000000000'
  created_by: number;
  created_at: string;
  disbanded_at: string | null;
}

export interface LobbyParticipant {
  id: number;
  lobby_id: number;
  user_id: number;
  joined_at: string;
  is_ready: boolean;
  has_staked: boolean;
  stake_transaction_hash: string | null;
  staked_at: string | null;
}

// Extended interfaces for component usage
export interface LobbyWithDetails extends Lobby {
  tournament?: Tournament | null;
  created_by_user?: User | null;
  participants?: LobbyParticipant[];
}

export interface PendingLobby extends LobbyWithDetails {
  // Additional computed properties for display
  stake_amount_sol: number;
  total_prize_pool_sol: number;
  is_tournament: boolean;
  time_since_created: string;
}

export type ActiveLobbyDetails = {
  id: number;
  name: string | null;
  created_by: number;
  created_by_user_name: string | null; // From join
  stake_amount: string;
  stake_amount_sol: number;
  max_players: number;
  current_players: number;
  status: 'waiting' | 'in_game' | 'completed' | 'cancelled';
  type: '1v1' | 'tournament';
  total_prize_pool_sol?: number;
  // Array of participants with their user details
  participants: {
    user_id: number;
    username: string; // Assuming this comes from a join on lobby_participants -> users
    is_ready: boolean;
    has_staked: boolean;
  }[];
};