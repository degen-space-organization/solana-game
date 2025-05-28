// components/Game/GameInfo.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Text,
  Heading,
  HStack,
  VStack,
  Badge,
  Progress,
  Spinner,
  Button,
  Grid,
  Flex,
  Icon,
} from '@chakra-ui/react';
import { 
  Trophy, 
  Users, 
  Coins, 
  Clock, 
  Target, 
  Gamepad2,
  Crown,
  Zap,
  Star
} from 'lucide-react';
import { database } from '@/supabase/Database';

import type { CurrentGameInfo, GameInformationProps } from './interfaces';


const GameInfo: React.FC<GameInformationProps> = ({ userWalletAddress }) => {
  const [gameInfo, setGameInfo] = useState<CurrentGameInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current game information
  const fetchCurrentGame = async () => {
    if (!userWalletAddress) {
      setGameInfo(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use the database helper to get current game
      const gameData = await database.games.getCurrentGameByWallet(userWalletAddress);

      if (!gameData) {
        console.log('User not in any active match');
        setGameInfo(null);
        setLoading(false);
        return;
      }

      setGameInfo({
        match: {
            id: gameData.match.id,
            tournament_id: gameData.match.tournament_id,
            status: gameData.match.status!,
            stake_amount: gameData.match.stake_amount,
            total_prize_pool: gameData.match.total_prize_pool,
            winner_id: gameData.match.winner_id,
            started_at: gameData.match.started_at,
            completed_at: gameData.match.completed_at,
        },
        tournament: {
            id: gameData.tournament?.id || 0,
            name: gameData.tournament?.name || '',
            status: gameData.tournament?.status || '',
            max_players: gameData.tournament?.max_players || 0,
            current_players: gameData.tournament?.current_players || 0,
            prize_pool: gameData.tournament?.prize_pool || '0',
            created_at: gameData.tournament?.created_at || '',
            started_at: gameData.tournament?.started_at || null,
        },
        participants: gameData.participants,
        isUserInGame: true,
      });

    } catch (err) {
      console.error('Error fetching current game:', err);
      setError('Failed to load game information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentGame();
  }, [userWalletAddress]);

  // Helper functions
  const formatSolAmount = database.games.formatSolAmount;
  const getDisplayName = database.games.getDisplayName;

  const getGameTypeDisplay = () => {
    if (!gameInfo) return '';
    return gameInfo.tournament ? 'TOURNAMENT' : '1v1 DUEL';
  };

  const getGameStatusColor = () => {
    if (!gameInfo) return '#6B7280';
    return database.games.getGameStatusColor(gameInfo.match.status || '');
  };

  const getGameStatusText = () => {
    if (!gameInfo) return '';
    return database.games.getGameStatusText(gameInfo.match.status || '');
  };

  // Loading state
  if (loading) {
    return (
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="white"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
      >
        <Card.Body>
          <VStack justify="center" align="center" minH="200px">
            <Spinner size="lg" color="blue.500" />
            <Text fontSize="lg" fontWeight="bold" color="gray.600">
              Loading game information...
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  // Error state
  if (error) {
    return (
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="red.500"
        bg="red.50"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
      >
        <Card.Body>
          <VStack align="center" textAlign="center">
            <Text fontSize="xl" fontWeight="black" color="red.600" mb="2">
              ⚠️ ERROR
            </Text>
            <Text fontSize="md" color="red.500" mb="4">
              {error}
            </Text>
            <Button
              onClick={fetchCurrentGame}
              bg="red.500"
              color="white"
              fontWeight="bold"
              borderRadius="0"
              border="3px solid"
              borderColor="gray.900"
              shadow="4px 4px 0px rgba(0,0,0,0.8)"
              _hover={{
                bg: "red.600",
                transform: "translate(-2px, -2px)",
                shadow: "6px 6px 0px rgba(0,0,0,0.8)",
              }}
            >
              Retry
            </Button>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  // No game state
  if (!gameInfo) {
    return (
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.400"
        bg="gray.50"
        shadow="8px 8px 0px rgba(0,0,0,0.4)"
        borderRadius="0"
        p="8"
        textAlign="center"
      >
        <Card.Body>
          <VStack align="center" padding="4">
            <Gamepad2 size={48} color="#9CA3AF" />
            <Heading
              size="lg"
              fontWeight="black"
              color="gray.600"
              textTransform="uppercase"
              mb="2"
            >
              No Active Game
            </Heading>
            <Text fontSize="md" color="gray.500" mb="4">
              You're not currently participating in any game.
            </Text>
            <Button
              onClick={fetchCurrentGame}
              bg="#118AB2"
              color="white"
              fontWeight="black"
              fontSize="md"
              px="6"
              py="3"
              borderRadius="0"
              border="3px solid"
              borderColor="gray.900"
              shadow="4px 4px 0px rgba(0,0,0,0.8)"
              textTransform="uppercase"
              _hover={{
                bg: "#0E7FA1",
                transform: "translate(-2px, -2px)",
                shadow: "6px 6px 0px rgba(0,0,0,0.8)",
              }}
            >
              🔄 Refresh
            </Button>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  // Game information display
  return (
    <Card.Root
      borderWidth="4px"
      borderStyle="solid"
      borderColor="gray.900"
      bg="white"
      shadow="8px 8px 0px rgba(0,0,0,0.8)"
      borderRadius="0"
    >
      {/* Header */}
      <Card.Header
        p="6"
        borderBottom="4px solid"
        borderColor="gray.900"
        bg={gameInfo.tournament ? "#F3E8FF" : "#E0F4FF"}
      >
        <Flex justify="space-between" align="flex-start">
          <VStack align="flex-start" padding="0">
            <HStack>
              {gameInfo.tournament ? (
                <Trophy size={24} color="#7B2CBF" />
              ) : (
                <Target size={24} color="#118AB2" />
              )}
              <Badge
                bg={gameInfo.tournament ? "#7B2CBF" : "#118AB2"}
                color="white"
                fontSize="sm"
                fontWeight="black"
                px="3"
                py="1"
                borderRadius="0"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                {getGameTypeDisplay()}
              </Badge>
            </HStack>
            
            <Heading
              size="lg"
              fontWeight="black"
              color="gray.900"
              textTransform="uppercase"
              letterSpacing="tight"
            >
              {gameInfo.tournament 
                ? gameInfo.tournament.name 
                : `Match #${gameInfo.match.id}`
              }
            </Heading>
          </VStack>

          <Box
            bg={getGameStatusColor()}
            color="white"
            px="3"
            py="2"
            fontSize="xs"
            fontWeight="black"
            borderRadius="0"
            border="2px solid"
            borderColor="gray.900"
            transform="rotate(-2deg)"
            shadow="3px 3px 0px rgba(0,0,0,0.8)"
          >
            {getGameStatusText()}
          </Box>
        </Flex>
      </Card.Header>

      <Card.Body p="6">
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="6">
          {/* Left Column - Game Stats */}
          <VStack align="stretch" padding="2">
            {/* Prize Pool */}
            <Box
              bg="yellow.100"
              border="3px solid"
              borderColor="yellow.600"
              p="4"
              mb="4"
            >
              <HStack justify="space-between" align="center">
                <HStack>
                  <Coins size={20} color="#D69E2E" />
                  <Text fontSize="sm" fontWeight="bold" color="yellow.800">
                    TOTAL PRIZE POOL
                  </Text>
                </HStack>
                <Text fontSize="xl" fontWeight="black" color="yellow.900">
                  {formatSolAmount(
                    gameInfo.tournament 
                      ? gameInfo.tournament.prize_pool 
                      : gameInfo.match.total_prize_pool
                  )} SOL
                </Text>
              </HStack>
            </Box>

            {/* Player Count */}
            {gameInfo.tournament ? (
              <Box
                bg="purple.100"
                border="3px solid"
                borderColor="purple.600"
                p="4"
                mb="4"
              >
                <VStack align="stretch" padding="0">
                  <HStack justify="space-between">
                    <HStack>
                      <Users size={20} color="#7B2CBF" />
                      <Text fontSize="sm" fontWeight="bold" color="purple.800">
                        TOURNAMENT PLAYERS
                      </Text>
                    </HStack>
                    <Text fontSize="xl" fontWeight="black" color="purple.900">
                      {gameInfo.tournament.current_players}/{gameInfo.tournament.max_players}
                    </Text>
                  </HStack>
                  <Progress.Root
                    value={(gameInfo.tournament.current_players / gameInfo.tournament.max_players) * 100}
                    bg="purple.200"
                    borderRadius="0"
                    h="4"
                  >
                    <Progress.Track bg="purple.200">
                      <Progress.Range bg="purple.600" />
                    </Progress.Track>
                  </Progress.Root>
                </VStack>
              </Box>
            ) : (
              <Box
                bg="blue.100"
                border="3px solid"
                borderColor="blue.600"
                p="4"
                mb="4"
              >
                <HStack justify="space-between">
                  <HStack>
                    <Target size={20} color="#118AB2" />
                    <Text fontSize="sm" fontWeight="bold" color="blue.800">
                      1v1 DUEL
                    </Text>
                  </HStack>
                  <Text fontSize="xl" fontWeight="black" color="blue.900">
                    2/2 PLAYERS
                  </Text>
                </HStack>
              </Box>
            )}

            {/* Stake Amount */}
            <Box
              bg="green.100"
              border="3px solid"
              borderColor="green.600"
              p="4"
            >
              <HStack justify="space-between">
                <HStack>
                  <Zap size={20} color="#059669" />
                  <Text fontSize="sm" fontWeight="bold" color="green.800">
                    STAKE PER PLAYER
                  </Text>
                </HStack>
                <Text fontSize="lg" fontWeight="black" color="green.900">
                  {formatSolAmount(gameInfo.match.stake_amount)} SOL
                </Text>
              </HStack>
            </Box>
          </VStack>

          {/* Right Column - Match Participants */}
          <VStack align="stretch" padding="2">
            <Heading
              size="md"
              fontWeight="black"
              color="gray.900"
              textTransform="uppercase"
              mb="4"
            >
              {gameInfo.tournament ? '🏆 Current Match' : '⚔️ Opponents'}
            </Heading>

            {gameInfo.participants.map((participant, index) => (
              <Box
                key={participant.user_id}
                bg={index % 2 === 0 ? "gray.50" : "white"}
                border="3px solid"
                borderColor="gray.900"
                p="4"
                mb="3"
                position="relative"
              >
                <HStack justify="space-between">
                  <VStack align="flex-start" padding="0">
                    <HStack>
                      <Box
                        bg={index === 0 ? "#FF6B35" : "#118AB2"}
                        color="white"
                        px="2"
                        py="1"
                        fontSize="xs"
                        fontWeight="black"
                        borderRadius="0"
                      >
                        P{participant.position}
                      </Box>
                      <Text fontSize="md" fontWeight="bold" color="gray.900">
                        {getDisplayName(participant.users)}
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color="gray.600">
                      {participant.users.matches_won}W - {participant.users.matches_lost}L
                    </Text>
                  </VStack>

                  {gameInfo.match.winner_id === participant.user_id && (
                    <Crown size={24} color="#FFD700" />
                  )}
                </HStack>
              </Box>
            ))}

            {/* Game Rules Reminder */}
            <Box
              bg="orange.100"
              border="3px solid"
              borderColor="orange.500"
              p="4"
              mt="4"
            >
              <HStack mb="2">
                <Star size={16} color="#EA580C" />
                <Text fontSize="sm" fontWeight="bold" color="orange.800">
                  GAME RULES
                </Text>
              </HStack>
              <Text fontSize="xs" color="orange.700">
                First to score 3 points wins! Rock beats Scissors, 
                Scissors beats Paper, Paper beats Rock.
              </Text>
            </Box>
          </VStack>
        </Grid>
      </Card.Body>

      {/* Footer with refresh button */}
      <Card.Footer p="4" borderTop="4px solid" borderColor="gray.900" bg="gray.100">
        <Flex justify="space-between" align="center" w="100%">
          <Text fontSize="xs" color="gray.600">
            Match ID: #{gameInfo.match.id}
          </Text>
          <Button
            onClick={fetchCurrentGame}
            size="sm"
            bg="gray.700"
            color="white"
            fontWeight="bold"
            borderRadius="0"
            border="2px solid"
            borderColor="gray.900"
            shadow="2px 2px 0px rgba(0,0,0,0.8)"
            _hover={{
              bg: "gray.800",
              transform: "translate(-1px, -1px)",
              shadow: "3px 3px 0px rgba(0,0,0,0.8)",
            }}
          >
            🔄 Refresh
          </Button>
        </Flex>
      </Card.Footer>
    </Card.Root>
  );
};

export default GameInfo;