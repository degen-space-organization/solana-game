import React, { useMemo } from 'react';
import {
  Box,
  Card,
  Text,
  Heading,
  HStack,
  VStack,
  Flex,
  Badge,
  Avatar,
  Progress,
  Grid,
} from '@chakra-ui/react';
import { Crown, Zap, Target, Clock } from 'lucide-react';
import type { Tables } from '@/supabase/types';

interface GameData {
  match: Tables<'matches'>;
  tournament?: Tables<'tournaments'> | null;
  participants: Array<{
    user_id: number;
    position: number;
    users: Tables<'users'>;
  }>;
  rounds: Tables<'game_rounds'>[];
}

interface OneOnOneInfoProps {
  gameData: GameData;
  currentUserId: number | null;
}

/**
 * @function OneOnOneInfo
 * 
 * @description Displays information about a one-on-one game
 * Shows player names, scores, match status, and other relevant information
 * 
 * @param gameData - The game data including match, participants, and rounds
 * @param currentUserId - The current user's ID to highlight their info
 * @returns JSX.Element representing the OneOnOneInfo Component
 */
export default function OneOnOneInfo({ gameData, currentUserId }: OneOnOneInfoProps) {
  const { match, participants, rounds } = gameData;

  // Calculate scores and game state
  const gameStats = useMemo(() => {
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
  }, [participants, rounds]);

  const getDisplayName = (user: Tables<'users'>): string => {
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  };

  const formatSolAmount = (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
  };

  const getMatchStatusColor = (status: string): string => {
    switch (status) {
      case 'in_progress': return '#06D6A0';
      case 'completed': return '#7B2CBF';
      default: return '#FF6B35';
    }
  };

  const getMatchStatusText = (status: string): string => {
    switch (status) {
      case 'in_progress': return 'IN PROGRESS';
      case 'completed': return 'COMPLETED';
      default: return status.toUpperCase();
    }
  };

  const getMoveEmoji = (move: string | null): string => {
    if (!move) return '❓';
    switch (move) {
      case 'rock': return '🗿';
      case 'paper': return '📄';
      case 'scissors': return '✂️';
      default: return '❓';
    }
  };

  const getRoundWinnerText = (round: Tables<'game_rounds'>): string => {
    if (!round.winner_id) return 'TIE';
    const winner = participants.find(p => p.user_id === round.winner_id);
    return winner ? getDisplayName(winner.users) : 'Unknown';
  };

  const isCurrentUser = (userId: number): boolean => {
    return currentUserId === userId;
  };

  if (!gameStats.player1 || !gameStats.player2) {
    return (
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="red.500"
        bg="red.50"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
        textAlign="center"
      >
        <Card.Body p="0">
          <Text color="red.600" fontWeight="bold">
            Error: Could not load player information
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <VStack gap="6" align="stretch" w="100%">
      {/* Players vs Players */}
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="white"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
        transform="rotate(0.3deg)"
        _hover={{
          transform: "rotate(0deg) scale(1.01)",
          shadow: "12px 12px 0px rgba(0,0,0,0.8)",
        }}
        transition="all 0.2s ease"
      >
        <Card.Body p="0">
          <Flex align="center" justify="space-between">
            {/* Player 1 */}
            <VStack gap="4" align="center" flex="1">
              <Box position="relative">
                <Avatar.Root 
                  size="xl" 
                  border="4px solid" 
                  borderColor={isCurrentUser(gameStats.player1.user_id) ? "#06D6A0" : "gray.900"}
                >
                  <Avatar.Fallback 
                    bg="#FF6B35" 
                    color="white" 
                    fontSize="xl" 
                    fontWeight="black"
                  >
                    {getDisplayName(gameStats.player1.users).charAt(0).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                {isCurrentUser(gameStats.player1.user_id) && (
                  <Box
                    position="absolute"
                    top="-2"
                    right="-2"
                    bg="#06D6A0"
                    color="white"
                    borderRadius="50%"
                    w="8"
                    h="8"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    border="2px solid white"
                    fontSize="sm"
                    fontWeight="black"
                  >
                    YOU
                  </Box>
                )}
              </Box>
              
              <VStack gap="2" align="center">
                <Text 
                  fontSize="lg" 
                  fontWeight="black" 
                  color="gray.900"
                  textAlign="center"
                  textTransform="uppercase"
                >
                  {getDisplayName(gameStats.player1.users)}
                </Text>
                <Text fontSize="sm" color="gray.600" fontWeight="medium">
                  {gameStats.player1.users.matches_won || 0}W - {gameStats.player1.users.matches_lost || 0}L
                </Text>
              </VStack>
            </VStack>

            {/* VS and Score */}
            <VStack gap="4" align="center" px="8">
              <Box
                bg="#118AB2"
                color="white"
                px="6"
                py="3"
                border="4px solid"
                borderColor="gray.900"
                borderRadius="0"
                shadow="4px 4px 0px rgba(0,0,0,0.8)"
                transform="rotate(-3deg)"
              >
                <Text 
                  fontSize="2xl" 
                  fontWeight="black" 
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  VS
                </Text>
              </Box>
              
              <HStack gap="3" align="center">
                <Box
                  bg={gameStats.player1Score > gameStats.player2Score ? "#06D6A0" : "#FF6B35"}
                  color="white"
                  w="16"
                  h="16"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  border="4px solid"
                  borderColor="gray.900"
                  borderRadius="0"
                  shadow="4px 4px 0px rgba(0,0,0,0.8)"
                  transform="rotate(-2deg)"
                >
                  <Text fontSize="2xl" fontWeight="black">
                    {gameStats.player1Score}
                  </Text>
                </Box>
                
                <Text fontSize="xl" fontWeight="black" color="gray.700">
                  -
                </Text>
                
                <Box
                  bg={gameStats.player2Score > gameStats.player1Score ? "#06D6A0" : "#FF6B35"}
                  color="white"
                  w="16"
                  h="16"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  border="4px solid"
                  borderColor="gray.900"
                  borderRadius="0"
                  shadow="4px 4px 0px rgba(0,0,0,0.8)"
                  transform="rotate(2deg)"
                >
                  <Text fontSize="2xl" fontWeight="black">
                    {gameStats.player2Score}
                  </Text>
                </Box>
              </HStack>
            </VStack>

            {/* Player 2 */}
            <VStack gap="4" align="center" flex="1">
              <Box position="relative">
                <Avatar.Root 
                  size="xl" 
                  border="4px solid" 
                  borderColor={isCurrentUser(gameStats.player2.user_id) ? "#06D6A0" : "gray.900"}
                >
                  <Avatar.Fallback 
                    bg="#7B2CBF" 
                    color="white" 
                    fontSize="xl" 
                    fontWeight="black"
                  >
                    {getDisplayName(gameStats.player2.users).charAt(0).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                {isCurrentUser(gameStats.player2.user_id) && (
                  <Box
                    position="absolute"
                    top="-2"
                    right="-2"
                    bg="#06D6A0"
                    color="white"
                    borderRadius="50%"
                    w="8"
                    h="8"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    border="2px solid white"
                    fontSize="sm"
                    fontWeight="black"
                  >
                    YOU
                  </Box>
                )}
              </Box>
              
              <VStack gap="2" align="center">
                <Text 
                  fontSize="lg" 
                  fontWeight="black" 
                  color="gray.900"
                  textAlign="center"
                  textTransform="uppercase"
                >
                  {getDisplayName(gameStats.player2.users)}
                </Text>
                <Text fontSize="sm" color="gray.600" fontWeight="medium">
                  {gameStats.player2.users.matches_won || 0}W - {gameStats.player2.users.matches_lost || 0}L
                </Text>
              </VStack>
            </VStack>
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* Match Details Grid */}
      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="6">
        {/* Match Status & Prize */}
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="white"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="6"
          transform="rotate(-0.5deg)"
        >
          <Card.Body p="0">
            <VStack gap="4" align="stretch">
              {/* Status */}
              <HStack justify="space-between" align="center">
                <HStack gap="2">
                  <Zap size={24} color="#FF6B35" />
                  <Text fontSize="sm" fontWeight="bold" color="gray.700" textTransform="uppercase">
                    Match Status
                  </Text>
                </HStack>
                <Badge
                  bg={getMatchStatusColor(match.status || 'waiting')}
                  color="white"
                  fontSize="sm"
                  fontWeight="black"
                  px="3"
                  py="1"
                  borderRadius="0"
                  border="2px solid"
                  borderColor="gray.900"
                  shadow="2px 2px 0px rgba(0,0,0,0.8)"
                  textTransform="uppercase"
                >
                  {getMatchStatusText(match.status || 'waiting')}
                </Badge>
              </HStack>

              {/* Prize Pool */}
              <Box
                bg="yellow.100"
                border="3px solid"
                borderColor="yellow.600"
                p="4"
                borderRadius="0"
              >
                <HStack justify="space-between">
                  <VStack align="flex-start" padding="0">
                    <Text fontSize="xs" fontWeight="bold" color="yellow.800">
                      STAKE AMOUNT
                    </Text>
                    <Text fontSize="lg" fontWeight="black" color="yellow.900">
                      {formatSolAmount(match.stake_amount)} ◎
                    </Text>
                  </VStack>
                  <VStack align="flex-end" padding="0">
                    <Text fontSize="xs" fontWeight="bold" color="yellow.800">
                      WINNER TAKES
                    </Text>
                    <Text fontSize="lg" fontWeight="black" color="yellow.900">
                      {formatSolAmount(match.total_prize_pool)} ◎
                    </Text>
                  </VStack>
                </HStack>
              </Box>

              {/* Winner Display */}
              {match.status === 'completed' && match.winner_id && (
                <Box
                  bg="#06D6A0"
                  color="white"
                  p="4"
                  border="3px solid"
                  borderColor="gray.900"
                  borderRadius="0"
                  shadow="4px 4px 0px rgba(0,0,0,0.8)"
                  textAlign="center"
                  transform="rotate(-1deg)"
                >
                  <HStack justify="center" gap="2">
                    <Crown size={20} />
                    <Text fontSize="lg" fontWeight="black" textTransform="uppercase" letterSpacing="wider">
                      Winner: {getDisplayName(
                        participants.find(p => p.user_id === match.winner_id)?.users!
                      )}
                    </Text>
                  </HStack>
                </Box>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Game Progress */}
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="white"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="6"
          transform="rotate(0.5deg)"
        >
          <Card.Body p="0">
            <VStack gap="4" align="stretch">
              <HStack gap="2">
                <Target size={24} color="#7B2CBF" />
                <Text fontSize="sm" fontWeight="bold" color="gray.700" textTransform="uppercase">
                  Game Progress
                </Text>
              </HStack>

              {/* Rounds Progress */}
              <Box>
                <HStack justify="space-between" mb="2">
                  <Text fontSize="xs" fontWeight="bold" color="gray.600">
                    ROUNDS PLAYED
                  </Text>
                  <Text fontSize="sm" fontWeight="black" color="gray.900">
                    {gameStats.completedRounds} rounds
                  </Text>
                </HStack>
                <Box
                  bg="gray.200"
                  h="4"
                  borderRadius="0"
                  border="2px solid"
                  borderColor="gray.900"
                  overflow="hidden"
                >
                  <Box
                    bg="#7B2CBF"
                    h="100%"
                    w={`${Math.min((gameStats.completedRounds / 5) * 100, 100)}%`}
                    transition="width 0.3s ease"
                  />
                </Box>
                <Text fontSize="xs" color="gray.500" mt="1">
                  Best of 5 format (first to 3 wins)
                </Text>
              </Box>

              {/* Recent Rounds */}
              {gameStats.recentRounds.length > 0 && (
                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="gray.600" mb="3" textTransform="uppercase">
                    Recent Rounds
                  </Text>
                  <VStack gap="2" align="stretch">
                    {gameStats.recentRounds.map((round) => (
                      <Box
                        key={round.id}
                        bg="gray.50"
                        border="2px solid"
                        borderColor="gray.300"
                        p="3"
                        borderRadius="0"
                        shadow="2px 2px 0px rgba(0,0,0,0.3)"
                      >
                        <HStack justify="space-between" align="center">
                          <Text fontSize="xs" fontWeight="bold" color="gray.600">
                            R{round.round_number}
                          </Text>
                          <HStack gap="2">
                            <Text fontSize="sm">
                              {getMoveEmoji(round.player1_move)}
                            </Text>
                            <Text fontSize="xs" color="gray.500">vs</Text>
                            <Text fontSize="sm">
                              {getMoveEmoji(round.player2_move)}
                            </Text>
                          </HStack>
                          <Text fontSize="xs" fontWeight="black" color="gray.900">
                            {getRoundWinnerText(round)}
                          </Text>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>
      </Grid>

      {/* Timer Info (if match is in progress) */}
      {match.status === 'in_progress' && (
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="#06D6A0"
          bg="green.50"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="6"
          textAlign="center"
          transform="rotate(-0.2deg)"
        >
          <Card.Body p="0">
            <HStack justify="center" gap="3">
              <Clock size={24} color="#06D6A0" />
              <Text fontSize="lg" fontWeight="black" color="green.700" textTransform="uppercase">
                🔥 Game in Progress - Good Luck! 🔥
              </Text>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
}