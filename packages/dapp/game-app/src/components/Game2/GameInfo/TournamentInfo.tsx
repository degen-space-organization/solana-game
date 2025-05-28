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
import { Trophy, Users, Crown, Target, Coins, Zap } from 'lucide-react';
import { supabase } from '@/supabase';

interface TournamentData {
  id: number;
  name: string;
  status: string;
  max_players: number;
  current_players: number;
  prize_pool: string;
  participants: Array<{
    user_id: number;
    users: {
      id: number;
      nickname: string | null;
      solana_address: string;
      matches_won: number;
      matches_lost: number;
    };
    eliminated_at: string | null;
    final_position: number | null;
  }>;
}

interface CurrentMatchData {
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

interface TournamentInfoProps {
  tournament: TournamentData;
  currentMatch?: CurrentMatchData;
}

interface TournamentStats {
  activeMatches: number;
  completedMatches: number;
  remainingPlayers: number;
  currentRound: number;
}

export default function TournamentInfo({ tournament, currentMatch }: TournamentInfoProps) {
  const [tournamentStats, setTournamentStats] = useState<TournamentStats>({
    activeMatches: 0,
    completedMatches: 0,
    remainingPlayers: 0,
    currentRound: 1,
  });
  const [loading, setLoading] = useState(true);

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
      case 'waiting': return 'WAITING FOR PLAYERS';
      case 'in_progress': return 'TOURNAMENT IN PROGRESS';
      case 'completed': return 'TOURNAMENT COMPLETED';
      default: return status.toUpperCase();
    }
  };

  const formatSolAmount = (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
  };

  // Get active (non-eliminated) participants
  const activePlayers = tournament.participants.filter(p => !p.eliminated_at);
  const eliminatedPlayers = tournament.participants.filter(p => p.eliminated_at);
  
  // Get winner (final_position = 1)
  const winner = tournament.participants.find(p => p.final_position === 1);

  useEffect(() => {
    const fetchTournamentStats = async () => {
      try {
        // Get tournament matches
        const { data: matches } = await supabase
          .from('matches')
          .select('id, status')
          .eq('tournament_id', tournament.id);

        const activeMatches = matches?.filter(m => m.status === 'in_progress').length || 0;
        const completedMatches = matches?.filter(m => m.status === 'completed').length || 0;
        
        // Calculate current round based on tournament structure
        // For 8 players: Round 1 (4 matches), Round 2 (2 matches), Round 3 (1 match)
        // For 4 players: Round 1 (2 matches), Round 2 (1 match)
        let currentRound = 1;
        if (tournament.max_players === 8) {
          if (completedMatches >= 4) currentRound = 2;
          if (completedMatches >= 6) currentRound = 3;
        } else if (tournament.max_players === 4) {
          if (completedMatches >= 2) currentRound = 2;
        }

        setTournamentStats({
          activeMatches,
          completedMatches,
          remainingPlayers: activePlayers.length,
          currentRound,
        });
      } catch (error) {
        console.error('Error fetching tournament stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTournamentStats();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`tournament-${tournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournament.id}`,
        },
        () => {
          fetchTournamentStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_participants',
          filter: `tournament_id=eq.${tournament.id}`,
        },
        () => {
          fetchTournamentStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament.id, activePlayers.length]);

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
          <Text fontWeight="bold" color="gray.600">Loading tournament details...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <VStack gap="6" align="stretch">
      {/* Tournament Header */}
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="purple.50"
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
                <Trophy size={32} color="#7B2CBF" />
                <VStack align="flex-start" padding="0">
                  <Heading 
                    size="xl" 
                    fontWeight="black" 
                    color="gray.900" 
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    🏆 {tournament.name}
                  </Heading>
                  <Text fontSize="md" color="gray.600" fontWeight="medium">
                    Tournament #{tournament.id} • {tournament.max_players} Player Bracket
                  </Text>
                </VStack>
              </HStack>
              
              <Badge
                bg={getStatusColor(tournament.status)}
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
                {getStatusText(tournament.status)}
              </Badge>
            </Flex>

            {/* Tournament Progress */}
            <Box
              bg="white"
              border="3px solid"
              borderColor="purple.500"
              p="4"
              borderRadius="0"
              shadow="3px 3px 0px rgba(123,44,191,0.3)"
            >
              <VStack gap="3" align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="sm" fontWeight="bold" color="purple.800">
                    CURRENT ROUND
                  </Text>
                  <Text fontSize="xl" fontWeight="black" color="purple.900">
                    Round {tournamentStats.currentRound}
                  </Text>
                </HStack>
                
                <HStack justify="space-between">
                  <Text fontSize="sm" fontWeight="bold" color="purple.700">
                    PLAYERS REMAINING
                  </Text>
                  <Text fontSize="lg" fontWeight="black" color="purple.900">
                    {tournamentStats.remainingPlayers} / {tournament.max_players}
                  </Text>
                </HStack>
              </VStack>
            </Box>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Current Match Display (if user is in active match) */}
      {currentMatch && (
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="orange.50"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          transform="rotate(0.3deg)"
        >
          <Card.Body p="6">
            <VStack gap="4" align="stretch">
              <HStack gap="3">
                <Zap size={24} color="#FF6B35" />
                <Heading 
                  size="lg" 
                  fontWeight="black" 
                  color="gray.900" 
                  textTransform="uppercase"
                >
                  YOUR CURRENT MATCH
                </Heading>
              </HStack>
              
              <Flex align="center" justify="center" gap="8">
                {currentMatch.participants.map((participant, index) => (
                  <VStack key={participant.user_id} gap="2" align="center">
                    <Avatar.Root size="lg" border="3px solid black">
                      <Avatar.Fallback 
                        bg={index === 0 ? "#FF6B35" : "#06D6A0"} 
                        color="white" 
                        fontSize="lg" 
                        fontWeight="black"
                      >
                        {getDisplayName(participant.users).charAt(0).toUpperCase()}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <Text fontSize="md" fontWeight="bold" color="gray.900" textAlign="center">
                      {getDisplayName(participant.users)}
                    </Text>
                  </VStack>
                ))}
              </Flex>
              
              <Text fontSize="sm" color="gray.600" textAlign="center" fontWeight="medium">
                Match #{currentMatch.id} • {currentMatch.status === 'in_progress' ? 'Battle in progress!' : 'Waiting to start...'}
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}

      {/* Tournament Stats */}
      <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="6">
        {/* Prize Pool */}
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="yellow.100"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          transform="rotate(-0.3deg)"
        >
          <Card.Body p="6">
            <VStack gap="3" align="center">
              <Coins size={32} color="#D69E2E" />
              <Text fontSize="sm" fontWeight="bold" color="yellow.800" textTransform="uppercase">
                Total Prize Pool
              </Text>
              <Text fontSize="2xl" fontWeight="black" color="yellow.900">
                {formatSolAmount(tournament.prize_pool)} ◎
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Matches Progress */}
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
            <VStack gap="3" align="center">
              <Target size={32} color="#118AB2" />
              <Text fontSize="sm" fontWeight="bold" color="blue.800" textTransform="uppercase">
                Matches Completed
              </Text>
              <Text fontSize="2xl" fontWeight="black" color="blue.900">
                {tournamentStats.completedMatches}
              </Text>
              <Text fontSize="xs" color="blue.700" fontWeight="medium">
                {tournamentStats.activeMatches} Active
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Players Status */}
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="green.50"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          transform="rotate(-0.1deg)"
        >
          <Card.Body p="6">
            <VStack gap="3" align="center">
              <Users size={32} color="#06D6A0" />
              <Text fontSize="sm" fontWeight="bold" color="green.800" textTransform="uppercase">
                Active Players
              </Text>
              <Text fontSize="2xl" fontWeight="black" color="green.900">
                {tournamentStats.remainingPlayers}
              </Text>
              <Text fontSize="xs" color="green.700" fontWeight="medium">
                {eliminatedPlayers.length} Eliminated
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Grid>

      {/* Winner Display (if tournament completed) */}
      {winner && tournament.status === 'completed' && (
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="gold"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          transform="rotate(-0.5deg)"
          _hover={{
            transform: "rotate(0deg) scale(1.02)",
            shadow: "12px 12px 0px rgba(0,0,0,0.8)",
          }}
          transition="all 0.2s ease"
        >
          <Card.Body p="8">
            <VStack gap="4" align="center">
              <Crown size={48} color="#000" />
              <Heading 
                size="2xl" 
                fontWeight="black" 
                color="black" 
                textTransform="uppercase"
                letterSpacing="wider"
                textAlign="center"
              >
                🏆 TOURNAMENT CHAMPION 🏆
              </Heading>
              
              <Avatar.Root size="2xl" border="4px solid black">
                <Avatar.Fallback 
                  bg="#FFD700" 
                  color="black" 
                  fontSize="3xl" 
                  fontWeight="black"
                >
                  {getDisplayName(winner.users).charAt(0).toUpperCase()}
                </Avatar.Fallback>
              </Avatar.Root>
              
              <VStack gap="1" align="center">
                <Heading 
                  size="xl" 
                  fontWeight="black" 
                  color="black"
                  textAlign="center"
                  textTransform="uppercase"
                >
                  {getDisplayName(winner.users)}
                </Heading>
                <Text fontSize="lg" fontWeight="bold" color="black">
                  Prize: {formatSolAmount(tournament.prize_pool)} ◎
                </Text>
              </VStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}

      {/* Active Players List */}
      {activePlayers.length > 0 && tournament.status !== 'completed' && (
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="white"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          transform="rotate(0.2deg)"
        >
          <Card.Body p="6">
            <VStack gap="4" align="stretch">
              <HStack gap="3">
                <Users size={24} color="#118AB2" />
                <Heading 
                  size="md" 
                  fontWeight="black" 
                  color="gray.900" 
                  textTransform="uppercase"
                >
                  Remaining Players
                </Heading>
              </HStack>
              
              <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap="4">
                {activePlayers.map((participant) => (
                  <Box
                    key={participant.user_id}
                    bg="gray.50"
                    border="2px solid"
                    borderColor="gray.900"
                    p="3"
                    borderRadius="0"
                    textAlign="center"
                  >
                    <VStack gap="2">
                      <Avatar.Root size="sm" border="2px solid black">
                        <Avatar.Fallback 
                          bg="#06D6A0" 
                          color="white" 
                          fontSize="sm" 
                          fontWeight="black"
                        >
                          {getDisplayName(participant.users).charAt(0).toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar.Root>
                      <Text fontSize="xs" fontWeight="bold" color="gray.900">
                        {getDisplayName(participant.users)}
                      </Text>
                      <HStack gap="1" justify="center">
                        <Badge colorScheme="green" variant="solid" fontSize="xs" px="1" borderRadius="0">
                          {participant.users.matches_won}W
                        </Badge>
                        <Badge colorScheme="red" variant="solid" fontSize="xs" px="1" borderRadius="0">
                          {participant.users.matches_lost}L
                        </Badge>
                      </HStack>
                    </VStack>
                  </Box>
                ))}
              </Grid>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
}