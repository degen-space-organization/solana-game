import type { Tables } from '@/supabase/types';
import type { User } from './index'

export interface Tournament {
  id: number;
  name: string;
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  max_players: number;
  current_players: number;
  prize_pool: string; // in lamports
  created_by: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TournamentParticipant {
  user_id: number;
  eliminated_at: string | null;
  final_position: number | null;
  users: Tables<'users'>;
}

export interface TournamentStats {
  activePlayers: number;
  eliminatedPlayers: number;
  prizePerWinner: string;
  currentUserEliminated: boolean;
  currentUserPosition: number | null;
}

export interface TournamentParticipant {
    id: number;
    tournament_id: number;
    user_id: number;
    joined_at: string;
    eliminated_at: string | null;
    final_position: number | null;
    is_ready: boolean;
    has_staked: boolean;
}

export interface TournamentWithDetails extends Tournament {
    created_by_user?: User | null;
    participants?: TournamentParticipant[];
}

export interface PendingTournament extends TournamentWithDetails {
    // Additional computed properties for display
    prize_pool_sol: number;
    entry_fee_sol: number; // Calculated from prize_pool / max_players
    time_since_created: string;
    can_start: boolean; // true if current_players === max_players
    slots_remaining: number;
}

export interface ActiveTournamentDetails {
    id: number;
    name: string;
    created_by: number;
    created_by_user_name: string | null;
    prize_pool: string;
    prize_pool_sol: number;
    max_players: number;
    current_players: number;
    status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
    entry_fee_sol: number;
    // Array of participants with their user details
    participants: {
        user_id: number;
        username: string;
        is_ready: boolean;
        has_staked: boolean;
        eliminated_at: string | null;
        final_position: number | null;
    }[];
    // Tournament bracket/standings info
    active_matches?: number;
    completed_matches?: number;
}