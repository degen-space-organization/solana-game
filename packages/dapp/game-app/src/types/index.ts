// Shared types for the application

export interface User {
  id: number;
  solana_address: string;
  nickname: string | null;
  matches_won: number;
  matches_lost: number;
  created_at: string;
  updated_at: string;
}

export interface Lobby {
  id: number;
  name: string;
  description: string | null;
  host_id: number;
  max_players: number;
  current_players: number;
  is_private: boolean;
  entry_fee: number;
  game_mode: 'classic' | 'best-of-3' | 'best-of-5' | 'tournament';
  time_limit: number;
  status: 'waiting' | 'in-progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  lobby_id?: number | null;
  user_id: number;
  message: string;
  created_at: string;
  users?: User | null;
}

export interface LobbyCreationData {
  name: string;
  description: string;
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
  entryFee: number;
  gameMode: 'classic' | 'best-of-3' | 'best-of-5' | 'tournament';
  timeLimit: number;
}