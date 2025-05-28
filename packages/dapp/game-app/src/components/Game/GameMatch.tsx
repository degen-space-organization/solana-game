// components/Game/GameMatch.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Container, VStack } from '@chakra-ui/react';

// Import all the game components
import MoveSelector from './MoveSelector';
import OpponentCards from './OpponentCards';
import Battlefield from './Battlefield';
import MatchInfo from './MatchInfo';

// Import types
import type { 
  GameState, 
  GameRound, 
  Move, 
  MatchData, 
  RoundWinner, 
  MatchWinner 
} from '@/types/game';

interface GameMatchProps {
  matchData: MatchData;
  currentUserId: number;
  onLeaveMatch: () => void;
}

const GameMatch: React.FC<GameMatchProps> = ({ 
  matchData, 
  currentUserId, 
  onLeaveMatch 
}) => {
  // Game state management
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [matchFinished, setMatchFinished] = useState(false);
  const [matchWinner, setMatchWinner] = useState<MatchWinner>(null);

  // Mock states for opponent (replace with real-time data)
  const [opponentHasSubmitted, setOpponentHasSubmitted] = useState(false);
  const [opponentMove, setOpponentMove] = useState<Move | null>(null);
  const [roundWinner, setRoundWinner] = useState<RoundWinner>(null);

  // Get player and opponent data
  const playerData = matchData.participants.find(p => p.user_id === currentUserId);
  const opponentData = matchData.participants.find(p => p.user_id !== currentUserId);
  
  const playerName = playerData?.users.nickname || 
    `${playerData?.users.solana_address.slice(0, 4)}...${playerData?.users.solana_address.slice(-4)}`;
  const opponentName = opponentData?.users.nickname || 
    `${opponentData?.users.solana_address.slice(0, 4)}...${opponentData?.users.solana_address.slice(-4)}`;

  // API call to submit move
  const submitMove = useCallback(async (move: Move) => {
    try {
      const response = await fetch('http://localhost:4000/api/v1/game/submit-move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          match_id: matchData.id,
          user_id: currentUserId,
          round_number: currentRound?.round_number || 1,
          player_move: move,
        }),
      });

      if (response.ok) {
        console.log('Move submitted successfully');
        
        // For demo purposes, simulate opponent behavior
        // In a real app, this would come from real-time updates
        setTimeout(() => {
          setOpponentHasSubmitted(true);
          setOpponentMove(['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] as Move);
          setGameState('revealing');
          
          // Simulate round result
          const results: RoundWinner[] = ['player', 'opponent', 'tie'];
          const result = results[Math.floor(Math.random() * results.length)];
          setRoundWinner(result);
          
          // Update scores
          if (result === 'player') {
            setPlayerScore(prev => prev + 1);
          } else if (result === 'opponent') {
            setOpponentScore(prev => prev + 1);
          }
          
          // After 3 seconds, start next round or end match
          setTimeout(() => {
            const newPlayerScore = result === 'player' ? playerScore + 1 : playerScore;
            const newOpponentScore = result === 'opponent' ? opponentScore + 1 : opponentScore;
            
            if (newPlayerScore >= 3 || newOpponentScore >= 3) {
              setMatchFinished(true);
              setMatchWinner(newPlayerScore >= 3 ? 'player' : 'opponent');
            } else {
              // Start next round
              setGameState('choosing');
              setSelectedMove(null);
              setOpponentMove(null);
              setOpponentHasSubmitted(false);
              setRoundWinner(null);
              setTimeRemaining(20);
              setCurrentRound(prev => prev ? {...prev, round_number: prev.round_number + 1} : null);
            }
          }, 3000);
        }, 1000);
      }
    } catch (error) {
      console.error('Error submitting move:', error);
    }
  }, [matchData.id, currentUserId, currentRound, playerScore, opponentScore]);

  // Handle move selection
  const handleMoveSelect = (move: Move) => {
    setSelectedMove(move);
    submitMove(move);
  };

  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (gameState === 'choosing' && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Time's up - auto submit or handle timeout
            if (!selectedMove) {
              // Player didn't select anything, they lose the round
              setGameState('revealing');
              setOpponentMove(['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] as Move);
              setRoundWinner('opponent');
              setOpponentScore(prev => prev + 1);
              
              setTimeout(() => {
                if (opponentScore + 1 >= 3) {
                  setMatchFinished(true);
                  setMatchWinner('opponent');
                } else {
                  // Start next round
                  setGameState('choosing');
                  setSelectedMove(null);
                  setOpponentMove(null);
                  setOpponentHasSubmitted(false);
                  setRoundWinner(null);
                  setTimeRemaining(20);
                  setCurrentRound(prev => prev ? {...prev, round_number: prev.round_number + 1} : null);
                }
              }, 3000);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [gameState, timeRemaining, selectedMove, opponentScore]);

  // Initialize game state when match starts
  useEffect(() => {
    if (matchData.status === 'in_progress') {
      setGameState('choosing');
      setTimeRemaining(20);
      setCurrentRound({
        id: 1,
        round_number: 1,
        player1_move: null,
        player2_move: null,
        winner_id: null,
        completed_at: null,
      });
    }
  }, [matchData]);

  // Check if match is already finished
  useEffect(() => {
    if (matchData.status === 'completed') {
      setMatchFinished(true);
      setMatchWinner(matchData.winner_id === currentUserId ? 'player' : 'opponent');
    }
  }, [matchData.status, matchData.winner_id, currentUserId]);

  return (
    <Container maxW="100%" p="6">
      <VStack align="stretch" gap="6">
        {/* Match Info */}
        <MatchInfo
          playerScore={playerScore}
          opponentScore={opponentScore}
          playerName={playerName}
          opponentName={opponentName}
          currentRound={currentRound?.round_number || 1}
          maxRounds={5}
        />

        {/* Opponent Cards */}
        <OpponentCards
          opponentName={opponentName}
          hasSubmitted={opponentHasSubmitted}
          isRevealing={gameState === 'revealing'}
          opponentMove={gameState === 'revealing' ? opponentMove : null}
        />

        {/* Battlefield */}
        <Battlefield
          gameState={gameState}
          currentRound={currentRound}
          playerMove={selectedMove}
          opponentMove={opponentMove}
          roundWinner={roundWinner}
          onLeaveMatch={onLeaveMatch}
          matchFinished={matchFinished}
          matchWinner={matchWinner}
        />

        {/* Player Move Selector */}
        {!matchFinished && (
          <MoveSelector
            onMoveSelect={handleMoveSelect}
            selectedMove={selectedMove}
            disabled={gameState !== 'choosing' || selectedMove !== null}
            timeRemaining={timeRemaining}
          />
        )}
      </VStack>
    </Container>
  );
};

export default GameMatch;