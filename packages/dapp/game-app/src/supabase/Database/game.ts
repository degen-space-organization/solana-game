// src/supabase/Database/games.ts
import { supabase } from '../index';
import type { Tables } from '../types';

export interface GameData {
  match: Tables<'matches'>;
  tournament?: Tables<'tournaments'> | null;
  participants: Array<{
    user_id: number;
    position: number;
    users: Tables<'users'>;
  }>;
  userPosition?: number;
}

export const games = {
  /**
   * Get current active game for a user by their wallet address
   */
  async getCurrentGameByWallet(walletAddress: string): Promise<GameData | null> {
    try {
      // First, get the user's database ID from their wallet address
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('solana_address', walletAddress)
        .single();

      if (userError || !userData) {
        console.error('User not found:', userError);
        return null;
      }

      return await this.getCurrentGameByUserId(userData.id);
    } catch (error) {
      console.error('Error fetching current game by wallet:', error);
      return null;
    }
  },

  /**
   * Get current active game for a user by their user ID
   */
  async getCurrentGameByUserId(userId: number): Promise<GameData | null> {
    try {
      // Check if user is in any active match
      const { data: matchParticipant, error: participantError } = await supabase
        .from('match_participants')
        .select(`
          match_id,
          position,
          matches!inner (
            id,
            tournament_id,
            status,
            stake_amount,
            total_prize_pool,
            winner_id,
            started_at,
            completed_at
          )
        `)
        .eq('user_id', userId)
        .in('matches.status', ['waiting', 'in_progress'])
        .single();

      if (participantError || !matchParticipant) {
        console.log('User not in any active match');
        return null;
      }

      const match = matchParticipant.matches as Tables<'matches'>;
      const userPosition = matchParticipant.position;

      // Get all match participants
      const { data: allParticipants, error: allParticipantsError } = await supabase
        .from('match_participants')
        .select(`
          user_id,
          position,
          users (
            id,
            nickname,
            solana_address,
            matches_won,
            matches_lost
          )
        `)
        .eq('match_id', match.id);

      if (allParticipantsError) {
        console.error('Error fetching match participants:', allParticipantsError);
        throw new Error('Failed to load match participants');
      }

      let tournament: Tables<'tournaments'> | null = null;

      // If it's a tournament match, get tournament details
      if (match.tournament_id) {
        const { data: tournamentData, error: tournamentError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', match.tournament_id)
          .single();

        if (tournamentError) {
          console.error('Error fetching tournament:', tournamentError);
        } else {
          tournament = tournamentData;
        }
      }

      return {
        match,
        tournament,
        participants: allParticipants as Array<{
          user_id: number;
          position: number;
          users: Tables<'users'>;
        }>,
        userPosition,
      };

    } catch (error) {
      console.error('Error fetching current game by user ID:', error);
      throw error;
    }
  },

  /**
   * Get match details by match ID
   */
  async getMatchById(matchId: number): Promise<GameData | null> {
    try {
      // Get match details
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        console.error('Match not found:', matchError);
        return null;
      }

      // Get all match participants
      const { data: participants, error: participantsError } = await supabase
        .from('match_participants')
        .select(`
          user_id,
          position,
          users (
            id,
            nickname,
            solana_address,
            matches_won,
            matches_lost
          )
        `)
        .eq('match_id', matchId);

      if (participantsError) {
        console.error('Error fetching match participants:', participantsError);
        throw new Error('Failed to load match participants');
      }

      let tournament: Tables<'tournaments'> | null = null;

      // If it's a tournament match, get tournament details
      if (match.tournament_id) {
        const { data: tournamentData, error: tournamentError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', match.tournament_id)
          .single();

        if (tournamentError) {
          console.error('Error fetching tournament:', tournamentError);
        } else {
          tournament = tournamentData;
        }
      }

      return {
        match,
        tournament,
        participants: participants as Array<{
          user_id: number;
          position: number;
          users: Tables<'users'>;
        }>,
      };

    } catch (error) {
      console.error('Error fetching match by ID:', error);
      throw error;
    }
  },

  /**
   * Check if a user is currently in any active game
   */
  async isUserInActiveGame(walletAddress: string): Promise<boolean> {
    try {
      const gameData = await this.getCurrentGameByWallet(walletAddress);
      return gameData !== null;
    } catch (error) {
      console.error('Error checking if user is in active game:', error);
      return false;
    }
  },

  /**
   * Get tournament standings/participants
   */
  async getTournamentStandings(tournamentId: number) {
    try {
      const { data: participants, error } = await supabase
        .from('tournament_participants')
        .select(`
          user_id,
          final_position,
          eliminated_at,
          users (
            id,
            nickname,
            solana_address,
            matches_won,
            matches_lost
          )
        `)
        .eq('tournament_id', tournamentId)
        .order('final_position', { ascending: true });

      if (error) {
        console.error('Error fetching tournament standings:', error);
        throw error;
      }

      return participants;
    } catch (error) {
      console.error('Error in getTournamentStandings:', error);
      throw error;
    }
  },

  /**
   * Get all active tournaments
   */
  async getActiveTournaments() {
    try {
      const { data: tournaments, error } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['waiting', 'in_progress'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active tournaments:', error);
        throw error;
      }

      return tournaments;
    } catch (error) {
      console.error('Error in getActiveTournaments:', error);
      throw error;
    }
  },

  /**
   * Get user's game history
   */
  async getUserGameHistory(walletAddress: string) {
    try {
      // First, get the user's database ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('solana_address', walletAddress)
        .single();

      if (userError || !userData) {
        console.error('User not found:', userError);
        return [];
      }

      const { data: matchHistory, error } = await supabase
        .from('match_participants')
        .select(`
          matches (
            id,
            tournament_id,
            status,
            stake_amount,
            total_prize_pool,
            winner_id,
            started_at,
            completed_at,
            tournaments (
              name
            )
          )
        `)
        .eq('user_id', userData.id)
        .eq('matches.status', 'completed')
        .order('matches.completed_at', { ascending: false });

      if (error) {
        console.error('Error fetching user game history:', error);
        throw error;
      }

      return matchHistory;
    } catch (error) {
      console.error('Error in getUserGameHistory:', error);
      throw error;
    }
  },

  /**
   * Utility functions
   */
  formatSolAmount: (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
  },

  getDisplayName: (user: Tables<'users'>): string => {
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  },

  getGameStatusColor: (status: string): string => {
    switch (status) {
      case 'waiting': return '#FF6B35';
      case 'in_progress': return '#06D6A0';
      case 'completed': return '#7B2CBF';
      default: return '#6B7280';
    }
  },

  getGameStatusText: (status: string): string => {
    switch (status) {
      case 'waiting': return 'WAITING TO START';
      case 'in_progress': return 'IN PROGRESS';
      case 'completed': return 'COMPLETED';
      default: return status.toUpperCase();
    }
  },
};