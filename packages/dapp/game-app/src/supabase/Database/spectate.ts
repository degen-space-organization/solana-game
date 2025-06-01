import { supabase } from '../index';
import type { Tables } from '../types';
import type { GameData } from './game';



type Move = 'rock' | 'paper' | 'scissors';

export interface SpectateMatchData extends GameData {
  rounds: Array<{
    id: number;
    match_id: number;
    round_number: number;
    player1_move: Move | null;
    player2_move: Move | null;
    winner_id: number | null;
    created_at: string | null;
    completed_at: string | null;
  }>;
  player1Score: number;
  player2Score: number;
}

export const spectate = {
  /**
   * Get complete match data for spectating including all rounds
   */
  async getMatchForSpectating(matchId: number): Promise<SpectateMatchData | null> {
    try {
      // Fetch match details
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        throw new Error(`Match #${matchId} not found`);
      }

      // Fetch match participants with user details
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
        throw new Error('Failed to load match participants');
      }

      // Fetch tournament info if it's a tournament match
      let tournament: Tables<'tournaments'> | null = null;
      if (match.tournament_id) {
        const { data: tournamentData, error: tournamentError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', match.tournament_id)
          .single();

        if (!tournamentError && tournamentData) {
          tournament = tournamentData;
        }
      }

      // Fetch game rounds
      const { data: rounds, error: roundsError } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('match_id', matchId)
        .order('round_number', { ascending: true });

      if (roundsError) {
        throw new Error('Failed to load game rounds');
      }

      // Calculate scores
      const player1 = participants.find(p => p.position === 1);
      const player2 = participants.find(p => p.position === 2);
      
      let player1Score = 0;
      let player2Score = 0;

      rounds?.forEach(round => {
        if (round.winner_id === player1?.user_id) {
          player1Score++;
        } else if (round.winner_id === player2?.user_id) {
          player2Score++;
        }
      });

      return {
        match,
        tournament,
        participants: participants as Array<{
          user_id: number;
          position: number;
          users: Tables<'users'>;
        }>,
        // @ts-ignore
        rounds: rounds || [],
        player1Score,
        player2Score,
      };

    } catch (error) {
      console.error('Error fetching match for spectating:', error);
      throw error;
    }
  },

  /**
   * Get all available matches for spectating (completed and in-progress)
   */
  async getAvailableMatches(): Promise<Array<{
    id: number;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    tournament_id: number | null;
    participant_count: number;
  }>> {
    try {
      const { data: matches, error } = await supabase
        .from('matches')
        .select(`
          id,
          status,
          started_at,
          completed_at,
          tournament_id,
          match_participants (count)
        `)
        .in('status', ['in_progress', 'completed'])
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) {
        throw new Error('Failed to fetch available matches');
      }

      return matches?.map(match => ({
        id: match.id,
        status: match.status || 'unknown',
        started_at: match.started_at,
        completed_at: match.completed_at,
        tournament_id: match.tournament_id,
        participant_count: Array.isArray(match.match_participants) 
          ? match.match_participants.length 
          : 0,
      })) || [];

    } catch (error) {
      console.error('Error fetching available matches:', error);
      throw error;
    }
  },

  /**
   * Get recent matches for a specific user
   */
  async getUserMatches(userId: number): Promise<Array<{
    id: number;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    winner_id: number | null;
  }>> {
    try {
      const { data: matches, error } = await supabase
        .from('match_participants')
        .select(`
          match_id,
          matches (
            id,
            status,
            started_at,
            completed_at,
            winner_id
          )
        `)
        .eq('user_id', userId)
        .order('match_id', { ascending: false })
        .limit(20);

      if (error) {
        throw new Error('Failed to fetch user matches');
      }

      return matches?.map(item => ({
        id: item.matches?.id || 0,
        status: item.matches?.status || 'unknown',
        started_at: item.matches?.started_at || null,
        completed_at: item.matches?.completed_at || null,
        winner_id: item.matches?.winner_id || null,
      })).filter(match => match.id > 0) || [];

    } catch (error) {
      console.error('Error fetching user matches:', error);
      throw error;
    }
  },

  /**
   * Subscribe to real-time updates for a specific match
   */
  subscribeToMatch(matchId: number, callback: () => void) {
    const channel = supabase
      .channel(`spectate-match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `match_id=eq.${matchId}`,
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Utility functions for spectating
   */
  utils: {
    /**
     * Determine round winner based on moves
     */
    determineRoundWinner(player1Move: Move, player2Move: Move): 'player1' | 'player2' | 'tie' {
      if (player1Move === player2Move) return 'tie';
      
      const winConditions: Record<Move, Move> = {
        rock: 'scissors',
        paper: 'rock',
        scissors: 'paper'
      };
      
      return winConditions[player1Move] === player2Move ? 'player1' : 'player2';
    },

    /**
     * Format match duration
     */
    getMatchDuration(startedAt: string, completedAt?: string | null): string {
      const start = new Date(startedAt);
      const end = completedAt ? new Date(completedAt) : new Date();
      const diffMs = end.getTime() - start.getTime();
      
      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      
      if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      }
      return `${seconds}s`;
    },

    /**
     * Get match status display text
     */
    getStatusDisplay(status: string): { text: string; color: string } {
      switch (status) {
        case 'waiting':
          return { text: 'WAITING TO START', color: '#FF6B35' };
        case 'in_progress':
          return { text: 'IN PROGRESS', color: '#06D6A0' };
        case 'completed':
          return { text: 'COMPLETED', color: '#7B2CBF' };
        default:
          return { text: status.toUpperCase(), color: '#6B7280' };
      }
    },
  },
};