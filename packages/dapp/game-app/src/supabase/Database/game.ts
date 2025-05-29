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


  async isInTournamentOrMatch(walletAddress: string): Promise<boolean> {
    try {
      // First, get the user's database ID from their wallet address
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('solana_address', walletAddress)
        .single();
      if (userError || !userData) {
        console.error('User not found:', userError);
        return false;
      }

      // Check if user is in any active match
      const { data: matchParticipant, error: participantError } = await supabase
        .from('match_participants')
        .select('match_id')
        .eq('user_id', userData.id)
        // .in('matches.status', ['waiting', 'in_progress'])
        .single();

      if (participantError || !matchParticipant) {
        console.log('User not in any active match');
        return false;
      }
      // If we reach here, user is in an active match
      return true;
    } catch (error) {
      console.error('Error checking if user is in tournament or match:', error);
      return false;
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
   * Get users current tournament or game, if any
   * This will return the match details, participants, and user position
   * otherwise it will return null
   */
  async getUserTournamentOrGame(userId: number) {
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
      console.error('Error fetching user tournament or game:', error);
      throw error;
    }
  },

  /**
   * Get last game round for a user
   */
  async findLatestGameRoundForUser(solanaAddress: string) {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('solana_address', solanaAddress)
      .single();
    if (userError || !user) {
      throw new Error('User not found');
    }

    // 2. Get all match_ids where user is a participant
    const { data: matchParticipants, error: matchError } = await supabase
      .from('match_participants')
      .select('match_id, position')
      .eq('user_id', user.id)
      // .single();

    if (matchError || !matchParticipants || matchParticipants.length === 0) {
      throw new Error('User not in any matches');
    }

    const matchIds = matchParticipants.map(mp => mp.match_id);

    // 3. Get the latest game round for those matches
    const { data: rounds, error: roundsError } = await supabase
      .from('game_rounds')
      .select('*')
      .in('match_id', matchIds)
      .order('created_at', { ascending: false })
      .limit(1);

    console.log('nigger', rounds)
    

    if (roundsError || !rounds || rounds.length === 0) {
      throw new Error('No game rounds found for user');
    }
    console.log('niggerino')

    return rounds[0];
  },

  /**
 * Get game round by ID
 */
  async getGameRoundById(roundId: number) {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('id', roundId)
        .single();

      if (error) {
        console.error('Error fetching game round:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getGameRoundById:', error);
      throw error;
    }
  },

  /**
   * Get current active round for a match
   */
  async getCurrentRoundForMatch(matchId: number) {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('match_id', matchId)
        .order('round_number', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching current round:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getCurrentRoundForMatch:', error);
      throw error;
    }
  },

  /**
   * Get all rounds for a match
   */
  async getRoundsForMatch(matchId: number) {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('match_id', matchId)
        .order('round_number', { ascending: true });

      if (error) {
        console.error('Error fetching match rounds:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRoundsForMatch:', error);
      throw error;
    }
  },


  /**
   * Check if there's a newer round for the same match
   */
  async checkForNewerRound(currentRoundId: number, matchId: number) {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('match_id', matchId)
        .gt('id', currentRoundId) // Greater than current round ID
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking for newer round:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error in checkForNewerRound:', error);
      return null;
    }
  },

  /**
   * Get active match for user (more efficient than finding rounds)
   */
  async getActiveMatchForUser(solanaAddress: string) {
    try {
      // Get user ID
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('solana_address', solanaAddress)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      // Get active match
      const { data: matchParticipants, error: matchError } = await supabase
        .from('match_participants')
        .select(`
        match_id,
        matches!inner (
          id,
          status,
          started_at,
          tournament_id
        )
      `)
        .eq('user_id', user.id)
        .in('matches.status', ['waiting', 'in_progress'])
        .single();

      if (matchError || !matchParticipants) {
        return null;
      }

      return matchParticipants.matches;
    } catch (error) {
      console.error('Error getting active match:', error);
      return null;
    }
  },

  /**
   * Get latest round for specific match
   */
  async getLatestRoundForMatch(matchId: number) {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('match_id', matchId)
        .order('round_number', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error getting latest round for match:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getLatestRoundForMatch:', error);
      return null;
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