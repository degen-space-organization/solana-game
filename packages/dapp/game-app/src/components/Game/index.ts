// components/Game/index.ts
export { default as GameMatch } from './GameMatch';
export { default as MoveSelector } from './MoveSelector';
export { default as OpponentCards } from './OpponentCards';
export { default as Battlefield } from './Battlefield';
export { default as MatchInfo } from './MatchInfo';
export { default as GameDemo } from './GameDemo';

// Re-export types for convenience
export type {
  Move,
  GameState,
  GameRound,
  MatchData,
  MoveOption,
  RoundWinner,
  MatchWinner,
} from '@/types/game';