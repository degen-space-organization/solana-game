import React, { useState, useEffect, useMemo } from 'react';
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
  Grid,
  Spinner,
} from '@chakra-ui/react';
import { Trophy, Users, Crown, Target, Zap, Award } from 'lucide-react';
import { supabase } from '@/supabase';
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

interface TournamentParticipant {
  user_id: number;
  eliminated_at: string | null;
  final_position: number | null;
  users: Tables<'users'>;
}

interface TournamentInfoProps {
  gameData: GameData;
  currentUserId: number | null;
}

/**
 * @function TournamentInfo
 * 
 * @description Displays information about a tournament game
 * Shows tournament name, participating teams, bracket status, prize distribution
 * and current match information within the tournament context
 * 
 * @param gameData - The game data including match, tournament, participants, and rounds
 * @param currentUserId - The current user's ID to highlight their info
 * @returns JSX.Element representing the TournamentInfo Component
 */
export default function TournamentInfo({ gameData, currentUserId }: TournamentInfoProps) {
  const { match, tournament, participants, rounds } = gameData;
  const [tournamentParticipants, setTournamentParticipants] = useState<TournamentParticipant[]>([]);
  const [loadingTournament, setLoadingTournament] = useState(false);

  // Fetch all tournament participants
  useEffect(() => {
    const fetchTournamentParticipants = async () => {
      if (!tournament) return;

      setLoadingTournament(true);
      try {
        const { data, error } = await supabase
          .from('tournament_participants')
          .select(`
            user_id,
            eliminated_at,
            final_position,
            users (
              id,
              nickname,
              solana_address,
              matches_won,
              matches_lost
            )
          `)
          .eq('tournament_id', tournament.id);

        if (!error && data) {
          setTournamentParticipants(data as TournamentParticipant[]);
        }
      } catch (err) {
        console.error('Error fetching tournament participants:', err);
      } finally {
        setLoadingTournament(false);
      }
    };

    fetchTournamentParticipants();
  }, [tournament?.id]);

  // Calculate match and tournament stats
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
    };
  }, [participants, rounds]);

  const tournamentStats = useMemo(() => {
    if (!tournament || !tournamentParticipants.length) {
      return {
        activePlayers: 0,
        eliminatedPlayers: 0,
        prizePerWinner: '0',
        currentUserEliminated: false,
        currentUserPosition: null,
      };
    }

    const activePlayers = tournamentParticipants.filter(p => !p.eliminated_at).length;
    const eliminatedPlayers = tournamentParticipants.filter(p => p.eliminated_at).length;
    
    // Prize distribution - typically 70% to winner, 30% to runner-up
    const totalPrize = parseFloat(tournament.prize_pool || '0') / 1e9;
    const prizePerWinner = (totalPrize * 0.7).toFixed(2);

    const currentUserParticipant = tournamentParticipants.find(p => p.user_id === currentUserId);
    const currentUserEliminated = currentUserParticipant?.eliminated_at !== null;
    const currentUserPosition = currentUserParticipant?.final_position;

    return {
      activePlayers,
      eliminatedPlayers,
      prizePerWinner,
      currentUserEliminated,
      currentUserPosition,
    };
  }, [tournament, tournamentParticipants, currentUserId]);

  const getDisplayName = (user: Tables<'users'>): string => {
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  };

  const formatSolAmount = (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
  };

  const getTournamentStatusColor = (status: string): string => {
    switch (status) {
      case 'waiting': return '#FF6B35';
      case 'in_progress': return '#06D6A0';
      case 'completed': return '#7B2CBF';
      default: return '#118AB2';
    }
  };

  const getTournamentStatusText = (status: string): string => {
    switch (status) {
      case 'waiting': return 'WAITING TO START';
      case 'in_progress': return 'IN PROGRESS';
      case 'completed': return 'COMPLETED';
      default: return status.toUpperCase();
    }
  };

  const getMatchStatusColor = (status: string): string => {
    switch (status) {
      case 'in_progress': return '#06D6A0';
      case 'completed': return '#7B2CBF';
      default: return '#FF6B35';
    }
  };

  const isCurrentUser = (userId: number): boolean => {
    return currentUserId === userId;
  };

  if (!tournament) {
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
            Error: Tournament information not available
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

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
            Error: Could not load match participants
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <VStack gap="6" align="stretch" w="100%">
      {/* Tournament Header */}
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="#7B2CBF"
        bg="purple.50"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
        transform="rotate(-0.3deg)"
        _hover={{
          transform: "rotate(0deg) scale(1.01)",
          shadow: "12px 12px 0px rgba(0,0,0,0.8)",
        }}
        transition="all 0.2s ease"
      >
        <Card.Body p="0">
          <VStack gap="4">
            <HStack justify="space-between" align="center" w="100%">
              <HStack gap="3">
                <Trophy size={32} color="#7B2CBF" />
                <VStack align="flex-start" padding="0">
                  <Heading 
                    size="lg" 
                    fontWeight="black" 
                    color="purple.900" 
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    {tournament.name}
                  </Heading>
                  <Text fontSize="sm" color="purple.700" fontWeight="medium">
                    Tournament Match #{match.id} • Round {match.tournament_round || '?'}
                  </Text>
                </VStack>
              </HStack>
              
              <Badge
                bg={getTournamentStatusColor(tournament.status || 'waiting')}
                color="white"
                fontSize="sm"
                fontWeight="black"
                px="4"
                py="2"
                borderRadius="0"
                border="2px solid"
                borderColor="gray.900"
                shadow="3px 3px 0px rgba(0,0,0,0.8)"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                {getTournamentStatusText(tournament.status || 'waiting')}
              </Badge>
            </HStack>

            {/* Tournament Progress */}
            <Grid templateColumns="repeat(3, 1fr)" gap="4" w="100%">
              <Box textAlign="center">
                <Text fontSize="xs" fontWeight="bold" color="purple.700" textTransform="uppercase">
                  Total Players
                </Text>
                <Text fontSize="2xl" fontWeight="black" color="purple.900">
                  {tournament.max_players}
                </Text>
              </Box>
              <Box textAlign="center">
                <Text fontSize="xs" fontWeight="bold" color="purple.700" textTransform="uppercase">
                  Active
                </Text>
                <Text fontSize="2xl" fontWeight="black" color="green.600">
                  {tournamentStats.activePlayers}
                </Text>
              </Box>
              <Box textAlign="center">
                <Text fontSize="xs" fontWeight="bold" color="purple.700" textTransform="uppercase">
                  Eliminated
                </Text>
                <Text fontSize="2xl" fontWeight="black" color="red.600">
                  {tournamentStats.eliminatedPlayers}
                </Text>
              </Box>
            </Grid>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Current Match Players */}
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="white"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
        transform="rotate(0.2deg)"
      >
        <Card.Body p="0">
          <VStack gap="4">
            <HStack gap="2" align="center">
              <Target size={24} color="#FF6B35" />
              <Heading size="md" fontWeight="black" color="gray.900" textTransform="uppercase">
                Current Match
              </Heading>
              <Badge
                bg={getMatchStatusColor(match.status || 'waiting')}
                color="white"
                fontSize="xs"
                fontWeight="black"
                px="2"
                py="1"
                borderRadius="0"
                textTransform="uppercase"
              >
                {match.status}
              </Badge>
            </HStack>

            <Flex align="center" justify="space-between" w="100%">
              {/* Player 1 */}
              <VStack gap="3" align="center" flex="1">
                <Box position="relative">
                  <Avatar.Root 
                    size="lg" 
                    border="4px solid" 
                    borderColor={isCurrentUser(gameStats.player1.user_id) ? "#06D6A0" : "gray.900"}
                  >
                    <Avatar.Fallback 
                      bg="#FF6B35" 
                      color="white" 
                      fontSize="lg" 
                      fontWeight="black"
                    >
                      {getDisplayName(gameStats.player1.users).charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  {isCurrentUser(gameStats.player1.user_id) && (
                    <Box
                      position="absolute"
                      top="-1"
                      right="-1"
                      bg="#06D6A0"
                      color="white"
                      borderRadius="50%"
                      w="6"
                      h="6"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      border="2px solid white"
                      fontSize="xs"
                      fontWeight="black"
                    >
                      ★
                    </Box>
                  )}
                </Box>
                
                <VStack gap="1" align="center">
                  <Text 
                    fontSize="md" 
                    fontWeight="black" 
                    color="gray.900"
                    textAlign="center"
                  >
                    {getDisplayName(gameStats.player1.users)}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {gameStats.player1.users.matches_won || 0}W - {gameStats.player1.users.matches_lost || 0}L
                  </Text>
                </VStack>
              </VStack>

              {/* Score */}
              <VStack gap="3" align="center" px="6">
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
                  <Text fontSize="lg" fontWeight="black" textTransform="uppercase">
                    VS
                  </Text>
                </Box>
                
                <HStack gap="2">
                  <Box
                    bg={gameStats.player1Score > gameStats.player2Score ? "#06D6A0" : "#FF6B35"}
                    color="white"
                    w="12"
                    h="12"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    border="3px solid"
                    borderColor="gray.900"
                    borderRadius="0"
                    shadow="3px 3px 0px rgba(0,0,0,0.8)"
                  >
                    <Text fontSize="xl" fontWeight="black">
                      {gameStats.player1Score}
                    </Text>
                  </Box>
                  
                  <Text fontSize="lg" fontWeight="black" color="gray.700">
                    :
                  </Text>
                  
                  <Box
                    bg={gameStats.player2Score > gameStats.player1Score ? "#06D6A0" : "#FF6B35"}
                    color="white"
                    w="12"
                    h="12"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    border="3px solid"
                    borderColor="gray.900"
                    borderRadius="0"
                    shadow="3px 3px 0px rgba(0,0,0,0.8)"
                  >
                    <Text fontSize="xl" fontWeight="black">
                      {gameStats.player2Score}
                    </Text>
                  </Box>
                </HStack>
              </VStack>

              {/* Player 2 */}
              <VStack gap="3" align="center" flex="1">
                <Box position="relative">
                  <Avatar.Root 
                    size="lg" 
                    border="4px solid" 
                    borderColor={isCurrentUser(gameStats.player2.user_id) ? "#06D6A0" : "gray.900"}
                  >
                    <Avatar.Fallback 
                      bg="#7B2CBF" 
                      color="white" 
                      fontSize="lg" 
                      fontWeight="black"
                    >
                      {getDisplayName(gameStats.player2.users).charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  {isCurrentUser(gameStats.player2.user_id) && (
                    <Box
                      position="absolute"
                      top="-1"
                      right="-1"
                      bg="#06D6A0"
                      color="white"
                      borderRadius="50%"
                      w="6"
                      h="6"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      border="2px solid white"
                      fontSize="xs"
                      fontWeight="black"
                    >
                      ★
                    </Box>
                  )}
                </Box>
                
                <VStack gap="1" align="center">
                  <Text 
                    fontSize="md" 
                    fontWeight="black" 
                    color="gray.900"
                    textAlign="center"
                  >
                    {getDisplayName(gameStats.player2.users)}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {gameStats.player2.users.matches_won || 0}W - {gameStats.player2.users.matches_lost || 0}L
                  </Text>
                </VStack>
              </VStack>
            </Flex>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Tournament Prize & Status */}
      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="6">
        {/* Prize Information */}
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="white"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="6"
          transform="rotate(-0.4deg)"
        >
          <Card.Body p="0">
            <VStack gap="4" align="stretch">
              <HStack gap="2">
                <Award size={24} color="#FFD700" />
                <Text fontSize="sm" fontWeight="bold" color="gray.700" textTransform="uppercase">
                  Tournament Prizes
                </Text>
              </HStack>

              <Box
                bg="yellow.100"
                border="3px solid"
                borderColor="yellow.600"
                p="4"
                borderRadius="0"
              >
                <VStack gap="3" align="stretch">
                  <HStack justify="space-between">
                    <Text fontSize="xs" fontWeight="bold" color="yellow.800">
                      TOTAL PRIZE POOL
                    </Text>
                    <Text fontSize="lg" fontWeight="black" color="yellow.900">
                      {formatSolAmount(tournament.prize_pool || '0')} ◎
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs" fontWeight="bold" color="yellow.800">
                      1ST PLACE (~70%)
                    </Text>
                    <Text fontSize="md" fontWeight="black" color="yellow.900">
                      ~{tournamentStats.prizePerWinner} ◎
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs" fontWeight="bold" color="yellow.800">
                      2ND PLACE (~30%)
                    </Text>
                    <Text fontSize="md" fontWeight="black" color="yellow.900">
                      ~{((parseFloat(tournament.prize_pool || '0') / 1e9) * 0.3).toFixed(2)} ◎
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Your Tournament Status */}
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor={tournamentStats.currentUserEliminated ? "red.500" : "#06D6A0"}
          bg={tournamentStats.currentUserEliminated ? "red.50" : "green.50"}
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="6"
          transform="rotate(0.4deg)"
        >
          <Card.Body p="0">
            <VStack gap="4" align="stretch">
              <HStack gap="2">
                <Users size={24} color={tournamentStats.currentUserEliminated ? "#DC2626" : "#06D6A0"} />
                <Text fontSize="sm" fontWeight="bold" color="gray.700" textTransform="uppercase">
                  Your Status
                </Text>
              </HStack>

              {loadingTournament ? (
                <VStack gap="2">
                  <Spinner size="md" color="purple.500" />
                  <Text fontSize="sm" color="gray.600">Loading tournament status...</Text>
                </VStack>
              ) : tournamentStats.currentUserEliminated ? (
                <VStack gap="3" align="center">
                  <Box fontSize="3xl">😢</Box>
                  <VStack gap="1" align="center">
                    <Text fontSize="lg" fontWeight="black" color="red.600" textTransform="uppercase">
                      Eliminated
                    </Text>
                    {tournamentStats.currentUserPosition && (
                      <Text fontSize="sm" color="red.500">
                        Final Position: #{tournamentStats.currentUserPosition}
                      </Text>
                    )}
                    <Text fontSize="xs" color="red.400">
                      Better luck next time!
                    </Text>
                  </VStack>
                </VStack>
              ) : (
                <VStack gap="3" align="center">
                  <Box fontSize="3xl">🔥</Box>
                  <VStack gap="1" align="center">
                    <Text fontSize="lg" fontWeight="black" color="green.600" textTransform="uppercase">
                      Still In The Game!
                    </Text>
                    <Text fontSize="sm" color="green.500">
                      {tournamentStats.activePlayers} players remaining
                    </Text>
                    <Text fontSize="xs" color="green.400">
                      Fight for the crown! 👑
                    </Text>
                  </VStack>
                </VStack>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>
      </Grid>

      {/* Match Status Banner */}
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
              <Zap size={24} color="#06D6A0" />
              <Text fontSize="lg" fontWeight="black" color="green.700" textTransform="uppercase">
                🏆 Tournament Match In Progress - Show Them What You've Got! 🏆
              </Text>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}

      {match.status === 'completed' && match.winner_id && (
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="#7B2CBF"
          bg="purple.50"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="6"
          textAlign="center"
          transform="rotate(0.2deg)"
        >
          <Card.Body p="0">
            <HStack justify="center" gap="3">
              <Crown size={24} color="#7B2CBF" />
              <Text fontSize="lg" fontWeight="black" color="purple.700" textTransform="uppercase">
                Match Complete - {getDisplayName(
                  participants.find(p => p.user_id === match.winner_id)?.users!
                )} Advances! 
              </Text>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
}