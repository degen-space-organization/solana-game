import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Flex,
  VStack,
  HStack,
  Text,
  Heading,
  Badge,
  Avatar,
  Progress,
  Grid,
  Spinner,
} from '@chakra-ui/react';
import { Gamepad2, Clock, Zap, Play, Pause, CheckCircle } from 'lucide-react';
import { supabase } from '@/supabase';

interface GameRound {
  id: number;
  round_number: number;
  player1_move: string | null;
  player2_move: string | null;
  winner_id: number | null;
  completed_at: string | null;
  created_at: string | null;
  status: string | null;
}

interface MatchParticipant {
  user_id: number;
  position: number;
  users: {
    id: number;
    nickname: string | null;
    solana_address: string;
    matches_won: number;
    matches_lost: number;
  };
}

interface MatchInfoProps {
  matchId?: number;
  participants?: MatchParticipant[];
  status: string;
}

type Move = 'rock' | 'paper' | 'scissors';

export default function MatchInfo({ matchId, participants = [], status }: MatchInfoProps) {
  const [gameRounds, setGameRounds] = useState<GameRound[]>([]);
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const player1 = participants?.find(p => p.position === 1);
  const player2 = participants?.find(p => p.position === 2);

  const getDisplayName = (user: any): string => {
    return user?.nickname || `${user?.solana_address?.slice(0, 4)}...${user?.solana_address?.slice(-4)}` || 'Unknown';
  };

  const getMoveEmoji = (move: Move | null): string => {
    switch (move) {
      case 'rock': return '🗿';
      case 'paper': return '📄';
      case 'scissors': return '✂️';
      default: return '❓';
    }
  };

  const getMoveColor = (move: Move | null): string => {
    switch (move) {
      case 'rock': return '#8B4513';
      case 'paper': return '#4169E1';
      case 'scissors': return '#DC143C';
      default: return '#6B7280';
    }
  };

  const getRoundResult = (round: GameRound): { result: string; color: string } => {
    if (!round.player1_move || !round.player2_move) {
      return { result: 'PENDING', color: '#6B7280' };
    }

    if (round.player1_move === round.player2_move) {
      return { result: 'TIE', color: '#FF6B35' };
    }

    const isPlayer1Winner = 
      (round.player1_move === 'rock' && round.player2_move === 'scissors') ||
      (round.player1_move === 'paper' && round.player2_move === 'rock') ||
      (round.player1_move === 'scissors' && round.player2_move === 'paper');

    if (isPlayer1Winner) {
      return { result: `${getDisplayName(player1?.users)} WINS`, color: '#06D6A0' };
    } else {
      return { result: `${getDisplayName(player2?.users)} WINS`, color: '#06D6A0' };
    }
  };

  // Calculate scores
  const player1Score = gameRounds.filter(round => round.winner_id === player1?.user_id && round.completed_at).length;
  const player2Score = gameRounds.filter(round => round.winner_id === player2?.user_id && round.completed_at).length;

  // Get current active round
  const activeRound = gameRounds.find(round => !round.completed_at) || null;

  useEffect(() => {
    // Don't fetch if matchId is not provided
    if (!matchId || typeof matchId !== 'number') {
      setLoading(false);
      return;
    }

    const fetchGameRounds = async () => {
      try {
        const { data: rounds } = await supabase
          .from('game_rounds')
          .select('*')
          .eq('match_id', matchId)
          .order('round_number', { ascending: true });

        setGameRounds(rounds || []);
        
        // Find current active round
        const active = rounds?.find(round => !round.completed_at) || null;
        setCurrentRound(active);

        // Start timer for active round if it exists
        if (active && active.created_at) {
          const startTime = new Date(active.created_at).getTime();
          const roundDuration = 20000; // 20 seconds per round
          
          const updateTimer = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const remaining = Math.max(0, roundDuration - elapsed);
            
            setTimeRemaining(Math.ceil(remaining / 1000));
            
            if (remaining > 0) {
              setTimeout(updateTimer, 1000);
            }
          };
          
          updateTimer();
        } else {
          setTimeRemaining(null);
        }
      } catch (error) {
        console.error('Error fetching game rounds:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGameRounds();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`match-${matchId}-info`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          fetchGameRounds();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  if (loading || !participants || participants.length === 0) {
    return (
      <Box
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="white"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
        textAlign="center"
      >
        <VStack gap="4">
          <Spinner color="purple.500" />
          <Text fontWeight="bold" color="gray.600">
            {loading ? "Loading match info..." : "No participants found..."}
          </Text>
        </VStack>
      </Box>
    );
  }

  // Don't render if matchId is invalid
  if (!matchId || typeof matchId !== 'number') {
    return (
      <Box
        borderWidth="4px"
        borderStyle="solid"
        borderColor="red.500"
        bg="red.50"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
        textAlign="center"
      >
        <Text fontSize="lg" fontWeight="black" color="red.700" textTransform="uppercase">
          ⚠️ Invalid Match ID
        </Text>
      </Box>
    );
  }

  return (
    <VStack gap="6" align="stretch">
      {/* Match Header */}
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="white"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        transform="rotate(-0.3deg)"
        _hover={{
          transform: "rotate(0deg) scale(1.01)",
          shadow: "12px 12px 0px rgba(0,0,0,0.8)",
        }}
        transition="all 0.2s ease"
      >
        <Card.Body p="6">
          <Flex justify="space-between" align="center">
            <HStack gap="3">
              <Gamepad2 size={32} color="#118AB2" />
              <VStack align="flex-start" padding="0">
                <Heading 
                  size="lg" 
                  fontWeight="black" 
                  color="gray.900" 
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  🎮 Match #{matchId}
                </Heading>
                <Text fontSize="sm" color="gray.600" fontWeight="medium">
                  Best of 5 • Rock Paper Scissors
                </Text>
              </VStack>
            </HStack>
            
            <HStack gap="4">
              {/* Round Counter */}
              <Badge
                bg="#7B2CBF"
                color="white"
                fontSize="sm"
                fontWeight="black"
                px="4"
                py="2"
                borderRadius="0"
                border="2px solid"
                borderColor="gray.900"
                shadow="2px 2px 0px rgba(0,0,0,0.8)"
              >
                ROUND {currentRound?.round_number || gameRounds.length}
              </Badge>
              
              {/* Timer */}
              {timeRemaining !== null && timeRemaining > 0 && (
                <Badge
                  bg="#FF6B35"
                  color="white"
                  fontSize="lg"
                  fontWeight="black"
                  px="4"
                  py="2"
                  borderRadius="0"
                  border="2px solid"
                  borderColor="gray.900"
                  shadow="2px 2px 0px rgba(0,0,0,0.8)"
                  animation={timeRemaining <= 5 ? "pulse 1s infinite" : "none"}
                >
                  ⏰ {timeRemaining}s
                </Badge>
              )}
            </HStack>
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* Current Round Status */}
      {currentRound && (
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="blue.50"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          transform="rotate(0.2deg)"
        >
          <Card.Body p="6">
            <VStack gap="4" align="stretch">
              <HStack gap="3" justify="center">
                <Zap size={24} color="#118AB2" />
                <Heading 
                  size="md" 
                  fontWeight="black" 
                  color="gray.900" 
                  textTransform="uppercase"
                >
                  Current Round Status
                </Heading>
              </HStack>
              
              <Flex align="center" justify="space-between">
                {/* Player 1 Status */}
                <VStack gap="3" align="center" flex="1">
                  <Avatar.Root size="lg" border="3px solid black">
                    <Avatar.Fallback 
                      bg="#FF6B35" 
                      color="white" 
                      fontSize="lg" 
                      fontWeight="black"
                    >
                      {getDisplayName(player1?.users).charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  
                  <VStack gap="1" align="center">
                    <Text fontSize="md" fontWeight="bold" color="gray.900">
                      {getDisplayName(player1?.users)}
                    </Text>
                    <Badge
                      bg={currentRound.player1_move ? "#06D6A0" : "#FF6B35"}
                      color="white"
                      fontSize="sm"
                      fontWeight="black"
                      px="3"
                      py="1"
                      borderRadius="0"
                    >
                      {currentRound.player1_move ? "✅ READY" : "⏳ CHOOSING..."}
                    </Badge>
                  </VStack>
                </VStack>

                {/* VS */}
                <Box
                  bg="#118AB2"
                  color="white"
                  px="4"
                  py="2"
                  border="3px solid"
                  borderColor="gray.900"
                  borderRadius="0"
                  shadow="3px 3px 0px rgba(0,0,0,0.8)"
                  transform="rotate(-2deg)"
                >
                  <Text fontSize="lg" fontWeight="black">VS</Text>
                </Box>

                {/* Player 2 Status */}
                <VStack gap="3" align="center" flex="1">
                  <Avatar.Root size="lg" border="3px solid black">
                    <Avatar.Fallback 
                      bg="#06D6A0" 
                      color="white" 
                      fontSize="lg" 
                      fontWeight="black"
                    >
                      {getDisplayName(player2?.users).charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  
                  <VStack gap="1" align="center">
                    <Text fontSize="md" fontWeight="bold" color="gray.900">
                      {getDisplayName(player2?.users)}
                    </Text>
                    <Badge
                      bg={currentRound.player2_move ? "#06D6A0" : "#FF6B35"}
                      color="white"
                      fontSize="sm"
                      fontWeight="black"
                      px="3"
                      py="1"
                      borderRadius="0"
                    >
                      {currentRound.player2_move ? "✅ READY" : "⏳ CHOOSING..."}
                    </Badge>
                  </VStack>
                </VStack>
              </Flex>

              {/* Round Progress */}
              <Box
                bg="white"
                border="2px solid"
                borderColor="blue.500"
                p="3"
                borderRadius="0"
              >
                <VStack gap="2">
                  <HStack justify="space-between" w="100%">
                    <Text fontSize="sm" fontWeight="bold" color="blue.700">
                      BOTH PLAYERS READY
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="blue.900">
                      {(currentRound.player1_move && currentRound.player2_move) ? "2/2" : 
                       (currentRound.player1_move || currentRound.player2_move) ? "1/2" : "0/2"}
                    </Text>
                  </HStack>
                  
                  <Progress.Root 
                    value={((currentRound.player1_move ? 1 : 0) + (currentRound.player2_move ? 1 : 0)) * 50} 
                    bg="blue.200" 
                    borderRadius="0" 
                    h="3"
                  >
                    <Progress.Track bg="blue.200">
                      <Progress.Range bg="blue.600" />
                    </Progress.Track>
                  </Progress.Root>
                </VStack>
              </Box>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}

      {/* Score Display */}
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="gray.900"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        transform="rotate(-0.1deg)"
      >
        <Card.Body p="6">
          <Flex align="center" justify="center" gap="8">
            <VStack gap="2" align="center">
              <Text fontSize="md" fontWeight="bold" color="white">
                {getDisplayName(player1?.users)}
              </Text>
              <Box
                bg={player1Score > player2Score ? "#06D6A0" : "#FF6B35"}
                color="white"
                w="20"
                h="20"
                display="flex"
                alignItems="center"
                justifyContent="center"
                border="4px solid"
                borderColor="white"
                borderRadius="0"
                shadow="4px 4px 0px rgba(255,255,255,0.3)"
              >
                <Text fontSize="3xl" fontWeight="black">
                  {player1Score}
                </Text>
              </Box>
            </VStack>

            <Text fontSize="2xl" fontWeight="black" color="white">
              -
            </Text>

            <VStack gap="2" align="center">
              <Text fontSize="md" fontWeight="bold" color="white">
                {getDisplayName(player2?.users)}
              </Text>
              <Box
                bg={player2Score > player1Score ? "#06D6A0" : "#FF6B35"}
                color="white"
                w="20"
                h="20"
                display="flex"
                alignItems="center"
                justifyContent="center"
                border="4px solid"
                borderColor="white"
                borderRadius="0"
                shadow="4px 4px 0px rgba(255,255,255,0.3)"
              >
                <Text fontSize="3xl" fontWeight="black">
                  {player2Score}
                </Text>
              </Box>
            </VStack>
          </Flex>

          <Box textAlign="center" mt="4">
            <Text fontSize="sm" color="gray.300" fontWeight="medium">
              First to 3 wins • {gameRounds.filter(r => r.completed_at).length} rounds completed
            </Text>
          </Box>
        </Card.Body>
      </Card.Root>

      {/* Rounds History */}
      {gameRounds.length > 0 && (
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="white"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          transform="rotate(0.1deg)"
        >
          <Card.Body p="6">
            <VStack gap="4" align="stretch">
              <HStack gap="3">
                <Clock size={24} color="#7B2CBF" />
                <Heading 
                  size="md" 
                  fontWeight="black" 
                  color="gray.900" 
                  textTransform="uppercase"
                >
                  Round History
                </Heading>
              </HStack>
              
              <VStack gap="3" align="stretch">
                {gameRounds.slice(-3).reverse().map((round) => {
                  const { result, color } = getRoundResult(round);
                  const bothMoved = round.player1_move && round.player2_move;
                  
                  return (
                    <Box
                      key={round.id}
                      bg="gray.50"
                      border="2px solid"
                      borderColor="gray.900"
                      p="4"
                      borderRadius="0"
                    >
                      <Flex justify="space-between" align="center">
                        <HStack gap="4">
                          <Badge
                            bg="#7B2CBF"
                            color="white"
                            fontSize="sm"
                            fontWeight="black"
                            px="2"
                            py="1"
                            borderRadius="0"
                          >
                            R{round.round_number}
                          </Badge>
                          
                          {bothMoved ? (
                            <HStack gap="4">
                              <HStack gap="2">
                                <Text fontSize="lg">{getMoveEmoji(round.player1_move as Move)}</Text>
                                <Text fontSize="sm" fontWeight="bold" color="gray.700">
                                  {getDisplayName(player1?.users)}
                                </Text>
                              </HStack>
                              
                              <Text fontSize="sm" color="gray.500">vs</Text>
                              
                              <HStack gap="2">
                                <Text fontSize="lg">{getMoveEmoji(round.player2_move as Move)}</Text>
                                <Text fontSize="sm" fontWeight="bold" color="gray.700">
                                  {getDisplayName(player2?.users)}
                                </Text>
                              </HStack>
                            </HStack>
                          ) : (
                            <Text fontSize="sm" color="gray.500" fontStyle="italic">
                              {round.completed_at ? "Round completed" : "Waiting for moves..."}
                            </Text>
                          )}
                        </HStack>
                        
                        <Badge
                          bg={color}
                          color="white"
                          fontSize="xs"
                          fontWeight="black"
                          px="3"
                          py="1"
                          borderRadius="0"
                          border="2px solid"
                          borderColor="gray.900"
                        >
                          {result}
                        </Badge>
                      </Flex>
                    </Box>
                  );
                })}
              </VStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
}