// types/game.ts
export type Move = 'rock' | 'paper' | 'scissors';
export type GameState = 'waiting' | 'choosing' | 'revealing' | 'finished';
export type RoundWinner = 'player' | 'opponent' | 'tie' | null;
export type MatchWinner = 'player' | 'opponent' | null;

export interface GameRound {
  id: number;
  round_number: number;
  player1_move: Move | null;
  player2_move: Move | null;
  winner_id: number | null;
  completed_at: string | null;
  timeRemaining?: number;
}

export interface MatchData {
  id: number;
  status: string;
  winner_id: number | null;
  participants: Array<{
    user_id: number;
    position: number;
    users: {
      id: number;
      nickname: string | null;
      solana_address: string;
    };
  }>;
}

export interface MoveOption {
  type: Move;
  emoji: string;
  name: string;
  color: string;
}