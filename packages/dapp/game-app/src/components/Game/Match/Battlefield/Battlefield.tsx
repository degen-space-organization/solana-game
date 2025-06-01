import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  VStack,
  HStack,
  Text,
  Image,
  Spinner,
} from '@chakra-ui/react';
import { supabase } from '@/supabase/index';

// Individual move GIFs
const moveGifs: Record<string, string> = {
  rock: '/gifs/rock.gif',
  paper: '/gifs/paper.gif',
  scissors: '/gifs/scissors.gif',
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

interface BattlefieldProps {
  roundId: number;
  userId: number;
}

export default function Battlefield({ roundId, userId }: BattlefieldProps) {
  const [round, setRound] = useState<GameRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerPosition, setPlayerPosition] = useState<1 | 2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

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
      .channel(`battlefield-${roundId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'game_rounds', 
          filter: `id=eq.${roundId}` 
        },
        (payload) => {
          console.log('🔄 Round updated:', payload.new);
          const updatedRound = payload.new as GameRound;
          setRound(updatedRound);
          
          // Trigger results animation when status changes to evaluating
          if (updatedRound.status === 'evaluating' && !showResults) {
            setTimeout(() => setShowResults(true), 500); // Small delay for effect
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [roundId, round?.id, showResults]);

  // Get the appropriate result GIF based on moves and user position
  const getResultGif = (userMove: string, opponentMove: string) => {
    if (!userMove || !opponentMove) return null;
    
    // Determine outcome
    if (userMove === opponentMove) {
      return `/gifs/draw-${userMove}-${opponentMove}.gif`;
    }
    
    const winMap: Record<string, string> = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper',
    };
    
    const userWins = winMap[userMove] === opponentMove;
    const resultType = userWins ? 'win' : 'lose';
    
    // User move is always on the left, opponent move on the right
    return `/gifs/${resultType}-${userMove}-${opponentMove}.gif`;
  };

  // Get result text
  const getResultText = (userMove: string | null, opponentMove: string | null) => {
    if (!userMove && !opponentMove) {
      return playerPosition === 1 ? 'You win this round!' : 'You lose this round!';
    }
    if (!userMove && opponentMove) return 'You lose this round!';
    if (userMove && !opponentMove) return 'You win this round!';
    if (userMove === opponentMove) return 'Draw!';
    
    const winMap: Record<string, string> = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper',
    };
    
    const userWins = winMap[userMove!] === opponentMove;
    return userWins ? 'You win this round!' : 'You lose this round!';
  };

  // Get result color
  const getResultColor = (userMove: string | null, opponentMove: string | null) => {
    if (!userMove && !opponentMove) {
      return playerPosition === 1 ? '#06D6A0' : '#DC143C';
    }
    if (!userMove && opponentMove) return '#DC143C';
    if (userMove && !opponentMove) return '#06D6A0';
    if (userMove === opponentMove) return '#7B2CBF';
    
    const winMap: Record<string, string> = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper',
    };
    
    const userWins = winMap[userMove!] === opponentMove;
    return userWins ? '#06D6A0' : '#DC143C';
  };

  if (loading) {
    return (
      <Card.Root
        bg="bg.default"
        border="4px solid"
        borderColor="border.default"
        borderRadius="0"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        p="6"
        textAlign="center"
        maxW="lg"
        mx="auto"
      >
        <Card.Body>
          <VStack gap="4">
            <Spinner size="xl" color="primary.emphasis" />
            <Text fontWeight="bold" color="fg.muted" textTransform="uppercase">
              Loading Battle...
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (error) {
    return (
      <Card.Root
        bg="error"
        color="fg.inverted"
        border="4px solid"
        borderColor="border.default"
        borderRadius="0"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        p="6"
        textAlign="center"
        maxW="lg"
        mx="auto"
      >
        <Card.Body>
          <VStack gap="2">
            <Text fontSize="lg" fontWeight="bold">Error</Text>
            <Text fontSize="md">{error}</Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (!round || !playerPosition) {
    return (
      <Card.Root
        bg="bg.muted"
        border="4px solid"
        borderColor="border.subtle"
        borderRadius="0"
        shadow="8px 8px 0px rgba(0,0,0,0.4)"
        p="6"
        textAlign="center"
        maxW="lg"
        mx="auto"
      >
        <Card.Body>
          <Text fontSize="md" color="fg.muted">No round data available</Text>
        </Card.Body>
      </Card.Root>
    );
  }

  // Determine user and opponent moves
  const userMove = playerPosition === 1 ? round.player1_move : round.player2_move;
  const opponentMove = playerPosition === 1 ? round.player2_move : round.player1_move;
  
  const isEvaluating = round.status === 'evaluating';
  const isCompleted = round.status === 'completed';
  const showMoves = isEvaluating || isCompleted;

  return (
    <Box maxW="2xl" mx="auto" p="4">
      <VStack gap="6" align="stretch">
        {/* Round Header */}
        <Card.Root
          bg="primary.subtle"
          border="2px solid"
          borderColor="border.default"
          borderRadius="0"
          shadow="4px 4px 0px rgba(0,0,0,0.4)"
        >
          <Card.Body p="4" textAlign="center">
            <Text
              fontSize="md"
              fontWeight="bold"
              color="fg.default"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              Round {round.round_number}
            </Text>
          </Card.Body>
        </Card.Root>

        {/* Main Battle Area */}
        <Card.Root
          bg="bg.default"
          border="4px solid"
          borderColor="border.default"
          borderRadius="0"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
        >
          <Card.Body p="6">
            {!showMoves ? (
              // Waiting state
              <VStack gap="6" align="center" py="8">
                <Text
                  fontSize="xl"
                  fontWeight="bold"
                  color="fg.default"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  textAlign="center"
                >
                  ⏳ Awaiting Players to Pick Moves
                </Text>
                
                <HStack gap="8" align="center">
                  {/* User side */}
                  <VStack gap="3" align="center">
                    <Text fontSize="sm" fontWeight="bold" color="primary.emphasis">
                      YOU
                    </Text>
                    <Box
                      w="80px"
                      h="80px"
                      bg="bg.subtle"
                      border="3px solid"
                      borderColor="border.default"
                      borderRadius="0"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="2xl">❓</Text>
                    </Box>
                  </VStack>

                  {/* VS */}
                  <Text fontSize="xl" fontWeight="black" color="fg.muted">
                    VS
                  </Text>

                  {/* Opponent side */}
                  <VStack gap="3" align="center">
                    <Text fontSize="sm" fontWeight="bold" color="error">
                      OPPONENT
                    </Text>
                    <Box
                      w="80px"
                      h="80px"
                      bg="bg.subtle"
                      border="3px solid"
                      borderColor="border.default"
                      borderRadius="0"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="2xl">❓</Text>
                    </Box>
                  </VStack>
                </HStack>
              </VStack>
            ) : (
              // Results state
              <VStack gap="6" align="center">
                {/* Results Header */}
                {isEvaluating && (
                  <Text
                    fontSize="lg"
                    fontWeight="bold"
                    color="primary.emphasis"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    textAlign="center"
                    animation={showResults ? "fadeInOut 1s ease-in-out" : "none"}
                  >
                    ⚡ Time for Results!
                  </Text>
                )}

                {/* Moves Display */}
                <HStack gap="8" align="center">
                  {/* User move */}
                  <VStack gap="3" align="center">
                    <Text fontSize="sm" fontWeight="bold" color="primary.emphasis">
                      YOU
                    </Text>
                    <Box
                      border="3px solid"
                      borderColor="border.default"
                      borderRadius="0"
                      overflow="hidden"
                      bg="bg.default"
                    >
                      <Image
                        src={userMove ? moveGifs[userMove] : "/gifs/question.gif"}
                        alt={userMove || "No move"}
                        w="80px"
                        h="80px"
                        objectFit="contain"
                      />
                    </Box>
                    {userMove && (
                      <Text fontSize="sm" fontWeight="bold" textTransform="capitalize">
                        {userMove}
                      </Text>
                    )}
                  </VStack>

                  {/* VS */}
                  <Text fontSize="xl" fontWeight="black" color="fg.default">
                    VS
                  </Text>

                  {/* Opponent move */}
                  <VStack gap="3" align="center">
                    <Text fontSize="sm" fontWeight="bold" color="error">
                      OPPONENT
                    </Text>
                    <Box
                      border="3px solid"
                      borderColor="border.default"
                      borderRadius="0"
                      overflow="hidden"
                      bg="bg.default"
                    >
                      <Image
                        src={opponentMove ? moveGifs[opponentMove] : "/gifs/question.gif"}
                        alt={opponentMove || "No move"}
                        w="80px"
                        h="80px"
                        objectFit="contain"
                      />
                    </Box>
                    {opponentMove && (
                      <Text fontSize="sm" fontWeight="bold" textTransform="capitalize">
                        {opponentMove}
                      </Text>
                    )}
                  </VStack>
                </HStack>

                {/* Result Animation */}
                {showResults && userMove && opponentMove && (
                  <VStack gap="4" align="center" animation="fadeIn 0.5s ease-in">
                    <Box
                      border="4px solid"
                      borderColor="border.default"
                      borderRadius="0"
                      overflow="hidden"
                      bg="bg.default"
                    >
                      <Image
                        src={getResultGif(userMove, opponentMove) || "/gifs/question.gif"}
                        alt="Battle Result"
                        w="150px"
                        h="150px"
                        objectFit="contain"
                      />
                    </Box>

                    <Text
                      fontSize="lg"
                      fontWeight="black"
                      color={getResultColor(userMove, opponentMove)}
                      textTransform="uppercase"
                      letterSpacing="wider"
                    >
                      {getResultText(userMove, opponentMove)}
                    </Text>
                  </VStack>
                )}

                {/* No moves case */}
                {showResults && (!userMove || !opponentMove) && (
                  <VStack gap="4" align="center">
                    <Text
                      fontSize="lg"
                      fontWeight="black"
                      color={getResultColor(userMove, opponentMove)}
                      textTransform="uppercase"
                      letterSpacing="wider"
                    >
                      {getResultText(userMove, opponentMove)}
                    </Text>
                  </VStack>
                )}
              </VStack>
            )}
          </Card.Body>
        </Card.Root>
      </VStack>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(-10px); }
          50% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0.8; transform: translateY(0); }
        }
        
        @keyframes fadeIn {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </Box>
  );
}