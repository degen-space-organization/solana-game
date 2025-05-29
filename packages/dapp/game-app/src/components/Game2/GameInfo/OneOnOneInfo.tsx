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
  Spinner,
} from '@chakra-ui/react';
import { Swords, Trophy, Coins, Clock, Target } from 'lucide-react';
import { supabase } from '@/supabase';

interface MatchData {
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
      matches_won: number;
      matches_lost: number;
    };
  }>;
  stake_amount: string;
  total_prize_pool: string;
}

interface GameRound {
  id: number;
  round_number: number;
  player1_move: string | null;
  player2_move: string | null;
  winner_id: number | null;
  completed_at: string | null;
}

interface OneOnOneInfoProps {
  match: MatchData;
}

export default function OneOnOneInfo({ match }: OneOnOneInfoProps) {
  const [gameRounds, setGameRounds] = useState<GameRound[]>([]);
  const [loading, setLoading] = useState(true);

  const player1 = match.participants.find(p => p.position === 1);
  const player2 = match.participants.find(p => p.position === 2);

  const getDisplayName = (user: any): string => {
    return user?.nickname || `${user?.solana_address?.slice(0, 4)}...${user?.solana_address?.slice(-4)}` || 'Unknown';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'waiting': return '#FF6B35';
      case 'in_progress': return '#06D6A0';
      case 'completed': return '#7B2CBF';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'waiting': return 'WAITING TO START';
      case 'in_progress': return 'BATTLE IN PROGRESS';
      case 'completed': return 'MATCH COMPLETED';
      default: return status.toUpperCase();
    }
  };

  const formatSolAmount = (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
  };

  // Calculate scores
  const player1Score = gameRounds.filter(round => round.winner_id === player1?.user_id).length;
  const player2Score = gameRounds.filter(round => round.winner_id === player2?.user_id).length;
  const totalRounds = gameRounds.length;
  const completedRounds = gameRounds.filter(round => round.completed_at !== null).length;

  useEffect(() => {
    const fetchGameRounds = async () => {
      try {
        const { data: rounds } = await supabase
          .from('game_rounds')
          .select('*')
          .eq('match_id', match.id)
          .order('round_number', { ascending: true });

        setGameRounds(rounds || []);
      } catch (error) {
        console.error('Error fetching game rounds:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGameRounds();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`match-${match.id}-rounds`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `match_id=eq.${match.id}`,
        },
        () => {
          fetchGameRounds();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match.id]);

  if (loading) {
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
          <Text fontWeight="bold" color="gray.600">Loading match details...</Text>
        </VStack>
      </Box>
    );
  }

  const winner = match.winner_id === player1?.user_id ? player1 : 
                 match.winner_id === player2?.user_id ? player2 : null;

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
        transform="rotate(-0.5deg)"
        _hover={{
          transform: "rotate(0deg) scale(1.01)",
          shadow: "12px 12px 0px rgba(0,0,0,0.8)",
        }}
        transition="all 0.2s ease"
      >
        <Card.Body p="6">
          <VStack gap="4" align="stretch">
            {/* Title and Status */}
            <Flex justify="space-between" align="center">
              <HStack gap="3">
                <Swords size={32} color="#FF6B35" />
                <Heading 
                  size="xl" 
                  fontWeight="black" 
                  color="gray.900" 
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  ⚔️ 1v1 DUEL
                </Heading>
              </HStack>
              
              <Badge
                bg={getStatusColor(match.status)}
                color="white"
                fontSize="sm"
                fontWeight="black"
                px="4"
                py="2"
                borderRadius="0"
                border="2px solid"
                borderColor="gray.900"
                shadow="2px 2px 0px rgba(0,0,0,0.8)"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                {getStatusText(match.status)}
              </Badge>
            </Flex>

            {/* Match Info */}
            <Text fontSize="md" color="gray.600" fontWeight="medium">
              Match #{match.id} • Best of 5 Rounds • Rock Paper Scissors
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Players Versus Display */}
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="gray.50"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        transform="rotate(0.3deg)"
        _hover={{
          transform: "rotate(0deg) scale(1.01)",
          shadow: "12px 12px 0px rgba(0,0,0,0.8)",
        }}
        transition="all 0.2s ease"
      >
        <Card.Body p="8">
          <Flex align="center" justify="space-between">
            {/* Player 1 */}
            <VStack gap="4" align="center" flex="1">
              <Avatar.Root size="xl" border="4px solid black">
                <Avatar.Fallback 
                  bg="#FF6B35" 
                  color="white" 
                  fontSize="2xl" 
                  fontWeight="black"
                >
                  {getDisplayName(player1?.users).charAt(0).toUpperCase()}
                </Avatar.Fallback>
              </Avatar.Root>
              
              <VStack gap="2" align="center">
                <Heading 
                  size="lg" 
                  fontWeight="black" 
                  color="gray.900"
                  textAlign="center"
                  textTransform="uppercase"
                >
                  {getDisplayName(player1?.users)}
                </Heading>
                <HStack gap="4">
                  <Badge colorScheme="green" variant="solid" px="2" py="1" borderRadius="0">
                    {player1?.users?.matches_won || 0}W
                  </Badge>
                  <Badge colorScheme="red" variant="solid" px="2" py="1" borderRadius="0">
                    {player1?.users?.matches_lost || 0}L
                  </Badge>
                </HStack>
                {winner?.user_id === player1?.user_id && (
                  <Badge 
                    bg="#06D6A0" 
                    color="white" 
                    fontSize="sm" 
                    fontWeight="black" 
                    px="3" 
                    py="1" 
                    borderRadius="0"
                    border="2px solid black"
                  >
                    👑 WINNER
                  </Badge>
                )}
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
                  bg={player1Score > player2Score ? "#06D6A0" : player1Score < player2Score ? "#FF6B35" : "#6B7280"}
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
                >
                  <Text fontSize="2xl" fontWeight="black">
                    {player1Score}
                  </Text>
                </Box>
                
                <Text fontSize="xl" fontWeight="black" color="gray.700">
                  -
                </Text>
                
                <Box
                  bg={player2Score > player1Score ? "#06D6A0" : player2Score < player1Score ? "#FF6B35" : "#6B7280"}
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
                >
                  <Text fontSize="2xl" fontWeight="black">
                    {player2Score}
                  </Text>
                </Box>
              </HStack>
            </VStack>

            {/* Player 2 */}
            <VStack gap="4" align="center" flex="1">
              <Avatar.Root size="xl" border="4px solid black">
                <Avatar.Fallback 
                  bg="#06D6A0" 
                  color="white" 
                  fontSize="2xl" 
                  fontWeight="black"
                >
                  {getDisplayName(player2?.users).charAt(0).toUpperCase()}
                </Avatar.Fallback>
              </Avatar.Root>
              
              <VStack gap="2" align="center">
                <Heading 
                  size="lg" 
                  fontWeight="black" 
                  color="gray.900"
                  textAlign="center"
                  textTransform="uppercase"
                >
                  {getDisplayName(player2?.users)}
                </Heading>
                <HStack gap="4">
                  <Badge colorScheme="green" variant="solid" px="2" py="1" borderRadius="0">
                    {player2?.users?.matches_won || 0}W
                  </Badge>
                  <Badge colorScheme="red" variant="solid" px="2" py="1" borderRadius="0">
                    {player2?.users?.matches_lost || 0}L
                  </Badge>
                </HStack>
                {winner?.user_id === player2?.user_id && (
                  <Badge 
                    bg="#06D6A0" 
                    color="white" 
                    fontSize="sm" 
                    fontWeight="black" 
                    px="3" 
                    py="1" 
                    borderRadius="0"
                    border="2px solid black"
                  >
                    👑 WINNER
                  </Badge>
                )}
              </VStack>
            </VStack>
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* Match Stats */}
      <Flex gap="6">
        {/* Rounds Progress */}
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="white"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          flex="1"
          transform="rotate(-0.2deg)"
        >
          <Card.Body p="6">
            <VStack gap="4" align="stretch">
              <HStack gap="2">
                <Target size={24} color="#7B2CBF" />
                <Text fontSize="lg" fontWeight="black" color="gray.900" textTransform="uppercase">
                  Round Progress
                </Text>
              </HStack>
              
              <VStack gap="2" align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="sm" fontWeight="bold" color="gray.700">
                    COMPLETED ROUNDS
                  </Text>
                  <Text fontSize="lg" fontWeight="black" color="gray.900">
                    {completedRounds} / 5
                  </Text>
                </HStack>
                
                <Progress.Root value={(completedRounds / 5) * 100} bg="gray.200" borderRadius="0" h="4">
                  <Progress.Track bg="gray.200">
                    <Progress.Range bg="#7B2CBF" />
                  </Progress.Track>
                </Progress.Root>
              </VStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Prize Info */}
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="yellow.100"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          flex="1"
          transform="rotate(0.2deg)"
        >
          <Card.Body p="6">
            <VStack gap="4" align="stretch">
              <HStack gap="2">
                <Coins size={24} color="#D69E2E" />
                <Text fontSize="lg" fontWeight="black" color="yellow.900" textTransform="uppercase">
                  Prize Pool
                </Text>
              </HStack>
              
              <VStack gap="1" align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="sm" fontWeight="bold" color="yellow.800">
                    TOTAL PRIZE
                  </Text>
                  <Text fontSize="xl" fontWeight="black" color="yellow.900">
                    {formatSolAmount(match.total_prize_pool)} ◎
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="xs" fontWeight="bold" color="yellow.700">
                    STAKE PER PLAYER
                  </Text>
                  <Text fontSize="md" fontWeight="bold" color="yellow.800">
                    {formatSolAmount(match.stake_amount)} ◎
                  </Text>
                </HStack>
              </VStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Flex>
    </VStack>
  );
}