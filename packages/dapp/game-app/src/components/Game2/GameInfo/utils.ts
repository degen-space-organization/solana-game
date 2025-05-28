// utils/gameInfoUtils.ts
import type { Tables } from '@/supabase/types';

/**
 * Get display name for a user (nickname or shortened address)
 */
export const getDisplayName = (user: Tables<'users'>): string => {
  return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
};

/**
 * Format lamports to SOL with 2 decimal places
 */
export const formatSolAmount = (lamports: string): string => {
  return (parseInt(lamports) / 1e9).toFixed(2);
};

/**
 * Get color for match status
 */
export const getMatchStatusColor = (status: string): string => {
  switch (status) {
    case 'in_progress': return '#06D6A0';
    case 'completed': return '#7B2CBF';
    case 'waiting': return '#FF6B35';
    default: return '#118AB2';
  }
};

/**
 * Get human readable text for match status
 */
export const getMatchStatusText = (status: string): string => {
  switch (status) {
    case 'in_progress': return 'IN PROGRESS';
    case 'completed': return 'COMPLETED';
    case 'waiting': return 'WAITING';
    default: return status.toUpperCase();
  }
};

/**
 * Get color for tournament status
 */
export const getTournamentStatusColor = (status: string): string => {
  switch (status) {
    case 'waiting': return '#FF6B35';
    case 'in_progress': return '#06D6A0';
    case 'completed': return '#7B2CBF';
    default: return '#118AB2';
  }
};

/**
 * Get human readable text for tournament status
 */
export const getTournamentStatusText = (status: string): string => {
  switch (status) {
    case 'waiting': return 'WAITING TO START';
    case 'in_progress': return 'IN PROGRESS';
    case 'completed': return 'COMPLETED';
    default: return status.toUpperCase();
  }
};

/**
 * Get emoji for rock-paper-scissors move
 */
export const getMoveEmoji = (move: string | null): string => {
  if (!move) return '❓';
  switch (move) {
    case 'rock': return '🗿';
    case 'paper': return '📄';
    case 'scissors': return '✂️';
    default: return '❓';
  }
};

/**
 * Get winner display text for a game round
 */
export const getRoundWinnerText = (
  round: Tables<'game_rounds'>, 
  participants: Array<{ user_id: number; users: Tables<'users'> }>
): string => {
  if (!round.winner_id) return 'TIE';
  const winner = participants.find(p => p.user_id === round.winner_id);
  return winner ? getDisplayName(winner.users) : 'Unknown';
};

/**
 * Calculate game statistics from rounds and participants
 */
export const calculateGameStats = (
  participants: Array<{
    user_id: number;
    position: number;
    users: Tables<'users'>;
  }>,
  rounds: Tables<'game_rounds'>[]
) => {
  const player1 = participants.find(p => p.position === 1);
  const player2 = participants.find(p => p.position === 2);
  
  if (!player1 || !player2) {
    return {
      player1: null,
      player2: null,
      player1Score: 0,
      player2Score: 0,
      totalRounds: 0,
      completedRounds: 0,
      recentRounds: [],
    };
  }

  let player1Score = 0;
  let player2Score = 0;
  const completedRounds = rounds.filter(r => r.winner_id !== null);
  
  completedRounds.forEach(round => {
    if (round.winner_id === player1.user_id) {
      player1Score++;
    } else if (round.winner_id === player2.user_id) {
      player2Score++;
    }
  });

  return {
    player1,
    player2,
    player1Score,
    player2Score,
    totalRounds: rounds.length,
    completedRounds: completedRounds.length,
    recentRounds: completedRounds.slice(-3).reverse(), // Last 3 rounds, most recent first
  };
};

/**
 * Format date to localized string
 */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

/**
 * Calculate time elapsed since a timestamp
 */
export const getTimeElapsed = (timestamp: string): string => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

/**
 * Check if a user is the current authenticated user
 */
export const isCurrentUser = (userId: number, currentUserId: number | null): boolean => {
  return currentUserId === userId;
};

/**
 * Get user win rate as percentage
 */
export const getUserWinRate = (user: Tables<'users'>): number => {
  const totalMatches = (user.matches_won || 0) + (user.matches_lost || 0);
  if (totalMatches === 0) return 0;
  return Math.round(((user.matches_won || 0) / totalMatches) * 100);
};

/**
 * Get prize distribution for tournament (70% winner, 30% runner-up)
 */
export const getTournamentPrizeDistribution = (totalPrizePool: string) => {
  const totalPrize = parseFloat(totalPrizePool) / 1e9;
  return {
    firstPlace: (totalPrize * 0.7).toFixed(2),
    secondPlace: (totalPrize * 0.3).toFixed(2),
    totalPrize: totalPrize.toFixed(2),
  };
};