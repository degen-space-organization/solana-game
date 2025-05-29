import { useEffect, useState } from "react";
import { Flex, Text, Image, Spinner } from "@chakra-ui/react";
import { supabase } from "@/supabase/index";

// Individual move GIFs
const moveGifs: Record<string, string> = {
  rock: '/gifs/rock.gif',
  paper: '/gifs/paper.gif',
  scissors: '/gifs/scissors.gif',
};

// Result GIFs
const resultWinGif = '/gifs/result-win.gif';
const resultLoseGif = '/gifs/result-lose.gif';
const resultDrawGif = '/gifs/result-draw.gif';

// Fighting animation GIFs
const fightingGifs = {
  // Win scenarios (user wins)
  'win-scissors-paper': '/gifs/win-scissors-paper.gif',
  'win-paper-rock': '/gifs/win-paper-rock.gif',
  'win-rock-scissors': '/gifs/win-rock-scissors.gif',
  
  // Lose scenarios (user loses)
  'lose-scissors-rock': '/gifs/lose-scissors-rock.gif',
  'lose-paper-scissors': '/gifs/lose-paper-scissors.gif',
  'lose-rock-paper': '/gifs/lose-rock-paper.gif',
  
  // Draw scenarios
  'draw-rock-rock': '/gifs/draw-rock-rock.gif',
  'draw-paper-paper': '/gifs/draw-paper-paper.gif',
  'draw-scissors-scissors': '/gifs/draw-scissors-scissors.gif',
};

interface GameRound {
  id: number;
  match_id: number;
  round_number: number;
  player1_move: string | null;
  player2_move: string | null;
  winner_id: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
}

interface MatchParticipant {
  user_id: number;
  position: number;
}

export default function Battlefield({ roundId, userId }: { roundId: number; userId: number }) {
  const [round, setRound] = useState<GameRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerPosition, setPlayerPosition] = useState<1 | 2 | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial round data and match participants
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch round data
        const { data: roundData, error: roundError } = await supabase
          .from('game_rounds')
          .select('*')
          .eq('id', roundId)
          .single();

        if (roundError) {
          throw new Error(`Failed to fetch round: ${roundError.message}`);
        }

        if (!roundData) {
          throw new Error('Round not found');
        }

        setRound(roundData as GameRound);

        // Fetch match participants
        const { data: participants, error: participantsError } = await supabase
          .from('match_participants')
          .select('user_id, position')
          .eq('match_id', roundData.match_id);

        if (participantsError) {
          throw new Error(`Failed to fetch participants: ${participantsError.message}`);
        }

        if (!participants || participants.length !== 2) {
          throw new Error('Invalid match participants');
        }

        // Find user's position
        const userParticipant = participants.find(p => p.user_id === userId);
        if (userParticipant && (userParticipant.position === 1 || userParticipant.position === 2)) {
          setPlayerPosition(userParticipant.position as 1 | 2);
        } else {
          throw new Error('User is not a participant in this match');
        }

      } catch (err) {
        console.error('Error fetching initial data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [roundId, userId]);

  // Subscribe to round updates
  useEffect(() => {
    if (!round) return;

    const subscription = supabase
      .channel(`game_rounds-battlefield-${roundId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'game_rounds', 
          filter: `id=eq.${roundId}` 
        },
        (payload) => {
          console.log('Round updated:', payload.new);
          setRound(payload.new as GameRound);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [roundId, round?.id]);

  // Helper function to get fighting gif and result
  const getFightingGifAndResult = (userMove: string | null, opponentMove: string | null) => {
    // Both players failed to submit - player 1 always wins
    if (!userMove && !opponentMove) {
      return {
        fightingGif: '/gifs/rock.gif', // Default to rock
        resultGif: playerPosition === 1 ? resultWinGif : resultLoseGif,
        resultText: playerPosition === 1 ? 'You win this round!' : 'You lose this round!',
        resultColor: playerPosition === 1 ? '#06D6A0' : '#DC143C'
      };
    }

    // Only user submitted - user wins
    if (userMove && !opponentMove) {
      return {
        fightingGif: moveGifs[userMove], // Show user's move
        resultGif: resultWinGif,
        resultText: 'You win this round!',
        resultColor: '#06D6A0'
      };
    }

    // Only opponent submitted - user loses
    if (!userMove && opponentMove) {
      return {
        fightingGif: moveGifs[opponentMove], // Show opponent's move
        resultGif: resultLoseGif,
        resultText: 'You lose this round!',
        resultColor: '#DC143C'
      };
    }

    // Both submitted - determine winner
    if (userMove && opponentMove) {
      // Draw
      if (userMove === opponentMove) {
        return {
          fightingGif: fightingGifs[`draw-${userMove}-${opponentMove}` as keyof typeof fightingGifs],
          resultGif: resultDrawGif,
          resultText: 'Draw!',
          resultColor: '#7B2CBF'
        };
      }

      // Determine win/lose
      const winMap: Record<string, string> = {
        rock: 'scissors',
        paper: 'rock',
        scissors: 'paper',
      };

      const userWins = winMap[userMove] === opponentMove;
      
      if (userWins) {
        return {
          fightingGif: fightingGifs[`win-${userMove}-${opponentMove}` as keyof typeof fightingGifs],
          resultGif: resultWinGif,
          resultText: 'You win this round!',
          resultColor: '#06D6A0'
        };
      } else {
        return {
          fightingGif: fightingGifs[`lose-${userMove}-${opponentMove}` as keyof typeof fightingGifs],
          resultGif: resultLoseGif,
          resultText: 'You lose this round!',
          resultColor: '#DC143C'
        };
      }
    }

    // Fallback
    return {
      fightingGif: '/gifs/rock.gif',
      resultGif: resultDrawGif,
      resultText: 'Unknown result',
      resultColor: '#7B2CBF'
    };
  };

  // Loading state
  if (loading) {
    return (
      <Flex align="center" justify="center" h="200px">
        <Spinner size="xl" />
        <Text ml={4}>Loading battle...</Text>
      </Flex>
    );
  }

  // Error state
  if (error) {
    return (
      <Flex align="center" justify="center" h="200px" direction="column">
        <Text color="red.500" fontSize="lg" fontWeight="bold">Error</Text>
        <Text color="red.400">{error}</Text>
      </Flex>
    );
  }

  // No round data
  if (!round || !playerPosition) {
    return (
      <Flex align="center" justify="center" h="200px">
        <Text>No round data available</Text>
      </Flex>
    );
  }

  // Determine user and opponent moves (user always on left, opponent on right)
  const userMove = playerPosition === 1 ? round.player1_move : round.player2_move;
  const opponentMove = playerPosition === 1 ? round.player2_move : round.player1_move;

  // Determine what to show based on status
  const showMovesAndAnimations = round.status === 'evaluating' || round.status === 'completed';
  
  // Get fighting gif and result info
  const { fightingGif, resultGif, resultText, resultColor } = getFightingGifAndResult(userMove, opponentMove);

  // Determine what to show for individual moves
  const leftMoveDisplay = showMovesAndAnimations && userMove ? moveGifs[userMove] : "/gifs/question.gif";
  const rightMoveDisplay = showMovesAndAnimations && opponentMove ? moveGifs[opponentMove] : "/gifs/question.gif";

  return (
    <Flex 
      direction="column"
      align="center" 
      justify="center" 
      w="100%" 
      p={8} 
      gap={6} 
      bg="#F3E8FF" 
      border="4px solid #222" 
      borderRadius="0" 
      boxShadow="8px 8px 0px rgba(0,0,0,0.8)"
    >
      {/* Status and Round Info */}
      <Text fontSize="lg" fontWeight="bold" color="gray.700">
        Round {round.round_number} • Status: {round.status}
      </Text>

      {/* Main Battle Area */}
      <Flex direction="row" align="center" justify="center" w="100%" gap={8}>
        {/* User (left) */}
        <Flex direction="column" align="center" flex={1}>
          <Text fontWeight="bold" mb={2} color="blue.600">
            You (Player {playerPosition})
          </Text>
          <Image 
            src={leftMoveDisplay} 
            alt={showMovesAndAnimations && userMove ? userMove : "?"} 
            w="80px" 
            h="80px" 
            border="3px solid #222" 
            borderRadius="0" 
            bg="white" 
          />
          {showMovesAndAnimations && userMove && (
            <Text fontSize="sm" mt={1} textTransform="capitalize" fontWeight="bold">
              {userMove}
            </Text>
          )}
        </Flex>

        {/* VS Text */}
        <Text fontSize="2xl" fontWeight="black" color="gray.800">
          VS
        </Text>

        {/* Opponent (right) */}
        <Flex direction="column" align="center" flex={1}>
          <Text fontWeight="bold" mb={2} color="red.600">
            Opponent (Player {playerPosition === 1 ? 2 : 1})
          </Text>
          <Image 
            src={rightMoveDisplay} 
            alt={showMovesAndAnimations && opponentMove ? opponentMove : "?"} 
            w="80px" 
            h="80px" 
            border="3px solid #222" 
            borderRadius="0" 
            bg="white" 
          />
          {showMovesAndAnimations && opponentMove && (
            <Text fontSize="sm" mt={1} textTransform="capitalize" fontWeight="bold">
              {opponentMove}
            </Text>
          )}
        </Flex>
      </Flex>

      {/* Animation and Result Area */}
      {showMovesAndAnimations ? (
        <Flex direction="column" align="center" gap={4}>
          {/* Result GIF */}
          <Image
            src={resultGif}
            alt="Result"
            w="100px"
            h="100px"
          />
          
          {/* Fighting Animation */}
          <Image
            src={fightingGif}
            alt="Fighting Animation"
            w="120px"
            h="120px"
            border="2px solid #222"
            borderRadius="0"
            bg="white"
          />
          
          
          {/* Result Text */}
          <Text fontWeight="bold" color={resultColor} fontSize="xl">
            {resultText}
          </Text>
        </Flex>
      ) : (
        <Flex direction="column" align="center" gap={4}>
          <Text fontSize="xl" fontWeight="bold" color="gray.600">
            {round.status === 'in_progress' ? 'Waiting for moves...' : 'Get ready...'}
          </Text>
        </Flex>
      )}
    </Flex>
  );
}