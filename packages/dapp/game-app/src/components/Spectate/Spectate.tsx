import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Text,
  VStack,
  HStack,
  Button,
  Input,
  IconButton,
  Card,
  Grid,
  GridItem,
  Badge,
  useBreakpointValue,
  Spinner,
} from '@chakra-ui/react';
import {
  Eye,
  Search,
  RefreshCw,
  Clock,
  Trophy,
  Users,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/supabase';
import type { Tables } from '@/supabase/types';

type Move = 'rock' | 'paper' | 'scissors';

interface GameRound extends Tables<'game_rounds'> {
  player1_move: Move | null;
  player2_move: Move | null;
}

interface MatchData {
  match: Tables<'matches'>;
  tournament?: Tables<'tournaments'> | null;
  participants: Array<{
    user_id: number;
    position: number;
    users: Tables<'users'>;
  }>;
}

interface OngoingMatch {
  id: number;
  status: string;
  started_at: string | null;
  tournament_name?: string;
  participant_count: number;
  stake_amount: string;
}

const Spectate: React.FC = () => {
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Match list state
  const [ongoingMatches, setOngoingMatches] = useState<OngoingMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);

  // Selected match state
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [gameRounds, setGameRounds] = useState<GameRound[]>([]);
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ROUNDS_PER_PAGE = 10;

  const isMobile = useBreakpointValue({ base: true, md: false });

  // Utility functions
  const getDisplayName = (user: any, fallback: string = 'Unknown'): string => {
    if (!user) return fallback;
    return user.nickname || `${user.solana_address?.slice(0, 4)}...${user.solana_address?.slice(-4)}` || fallback;
  };

  const formatSolAmount = (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
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
      case 'waiting': return 'WAITING';
      case 'in_progress': return 'LIVE';
      case 'completed': return 'COMPLETED';
      default: return status.toUpperCase();
    }
  };

  const getMoveEmoji = (move: Move | null): string => {
    if (!move) return '❓';
    switch (move) {
      case 'rock': return '🗿';
      case 'paper': return '📄';
      case 'scissors': return '✂️';
      default: return '❓';
    }
  };

  // Pagination logic
  const sortedRounds = gameRounds.sort((a, b) => b.round_number - a.round_number); // Latest rounds first
  const totalPages = Math.ceil(sortedRounds.length / ROUNDS_PER_PAGE);
  const paginatedRounds = sortedRounds.slice(
    (currentPage - 1) * ROUNDS_PER_PAGE,
    currentPage * ROUNDS_PER_PAGE
  );

  const getRoundResult = (round: GameRound, participants: MatchData['participants']): { result: string; winner: string | null } => {
    // Get participant info with fallbacks
    const player1 = participants?.find(p => p.position === 1);
    const player2 = participants?.find(p => p.position === 2);
    const player1Name = getDisplayName(player1?.users, 'Player 1');
    const player2Name = getDisplayName(player2?.users, 'Player 2');

    // Case 1: Both players failed to submit moves - Player 1 wins (anti-stalling rule)
    if (!round.player1_move && !round.player2_move) {
      return { result: 'WIN', winner: player1Name };
    }

    // Case 2: Player 1 submitted, Player 2 didn't - Player 1 wins
    if (round.player1_move && !round.player2_move) {
      return { result: 'WIN', winner: player1Name };
    }

    // Case 3: Player 2 submitted, Player 1 didn't - Player 2 wins
    if (!round.player1_move && round.player2_move) {
      return { result: 'WIN', winner: player2Name };
    }

    // Case 4: Both players submitted moves - normal rock-paper-scissors logic
    if (round.player1_move && round.player2_move) {
      if (round.player1_move === round.player2_move) {
        return { result: 'TIE', winner: null };
      }

      const isPlayer1Winner =
        (round.player1_move === 'rock' && round.player2_move === 'scissors') ||
        (round.player1_move === 'paper' && round.player2_move === 'rock') ||
        (round.player1_move === 'scissors' && round.player2_move === 'paper');

      const winner = isPlayer1Winner ? player1Name : player2Name;
      return { result: 'WIN', winner };
    }

    // Fallback case
    return { result: 'PENDING', winner: null };
  };

  // Fetch ongoing matches
  const fetchOngoingMatches = async () => {
    setIsLoadingMatches(true);
    try {
      const { data: matches, error } = await supabase
        .from('matches')
        .select(`
          id,
          status,
          started_at,
          stake_amount,
          tournament_id,
          tournaments (
            name
          ),
          match_participants (count)
        `)
        .in('status', ['waiting', 'in_progress'])
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedMatches: OngoingMatch[] = matches?.map(match => ({
        id: match.id,
        status: match.status || 'unknown',
        started_at: match.started_at,
        tournament_name: (match.tournaments as any)?.name || null,
        participant_count: Array.isArray(match.match_participants) ? match.match_participants.length : 0,
        stake_amount: match.stake_amount,
      })) || [];

      setOngoingMatches(formattedMatches);
    } catch (err) {
      console.error('Error fetching ongoing matches:', err);
      setError('Failed to load ongoing matches');
    } finally {
      setIsLoadingMatches(false);
    }
  };

  // Fetch specific match data
  const fetchMatchData = async (matchId: number): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch match details
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        throw new Error(`Match #${matchId} not found`);
      }

      // Fetch match participants with user details
      const { data: participants, error: participantsError } = await supabase
        .from('match_participants')
        .select(`
          user_id,
          position,
          users (
            id,
            nickname,
            solana_address,
            matches_won,
            matches_lost
          )
        `)
        .eq('match_id', matchId);

      if (participantsError) {
        throw new Error('Failed to load match participants');
      }

      // Fetch tournament info if it's a tournament match
      let tournament: Tables<'tournaments'> | null = null;
      if (match.tournament_id) {
        const { data: tournamentData, error: tournamentError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', match.tournament_id)
          .single();

        if (!tournamentError && tournamentData) {
          tournament = tournamentData;
        }
      }

      // Fetch game rounds
      const { data: rounds, error: roundsError } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('match_id', matchId)
        .order('round_number', { ascending: true });

      if (roundsError) {
        throw new Error('Failed to load game rounds');
      }

      // Calculate scores using the same logic as getRoundResult
      const player1 = participants?.find(p => p.position === 1);
      const player2 = participants?.find(p => p.position === 2);

      let p1Score = 0;
      let p2Score = 0;

      rounds?.forEach(round => {
        if (round.completed_at) {
          // @ts-ignore
          const { result, winner } = getRoundResult(round, participants || []);

          if (result === 'WIN') {
            const player1Name = getDisplayName(player1?.users, 'Player 1');
            const player2Name = getDisplayName(player2?.users, 'Player 2');

            if (winner === player1Name) {
              p1Score++;
            } else if (winner === player2Name) {
              p2Score++;
            }
          }
        }

        // Ties don't count towards score
      });

      setPlayer1Score(p1Score);
      setPlayer2Score(p2Score);
      setCurrentPage(1); // Reset pagination when viewing new match

      // Set the data
      setSelectedMatch({
        match,
        tournament,
        participants: participants as Array<{
          user_id: number;
          position: number;
          users: Tables<'users'>;
        }>,
      });

      setGameRounds(rounds as GameRound[] || []);

    } catch (err) {
      console.error('Error fetching match data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load match data');
      setSelectedMatch(null);
      setGameRounds([]);
      setPlayer1Score(0);
      setPlayer2Score(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search
  const handleSearch = async () => {
    const matchId = parseInt(searchTerm);
    if (isNaN(matchId) || matchId <= 0) {
      setError('Please enter a valid Match ID');
      return;
    }
    await fetchMatchData(matchId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedMatch(null);
    setGameRounds([]);
    setError(null);
    setPlayer1Score(0);
    setPlayer2Score(0);
    setCurrentPage(1);
  };

  // Real-time subscription for selected match
  useEffect(() => {
    if (!selectedMatch) return;

    const channel = supabase
      .channel(`spectate-match-${selectedMatch.match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `match_id=eq.${selectedMatch.match.id}`,
        },
        () => {
          fetchMatchData(selectedMatch.match.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${selectedMatch.match.id}`,
        },
        () => {
          fetchMatchData(selectedMatch.match.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMatch?.match.id]);

  // Load ongoing matches on mount
  useEffect(() => {
    fetchOngoingMatches();
  }, []);

  return (
    <Container maxW="6xl" py={6}>
      <Card.Root
        bg="bg.default"
        border="3px solid"
        borderColor="border.default"
        borderRadius="sm"
        shadow="brutalist.2xl"
        overflow="hidden"
      >
        {/* Header */}
        <Box
          bg="primary.subtle"
          borderBottom="3px solid"
          borderColor="border.default"
          p={4}
        >
          <VStack gap={4} align="stretch">
            {/* Title */}
            <HStack gap="3" align="center" justify="center">
              <Eye size={28} color="#7B2CBF" />
              <Text
                fontSize="2xl"
                fontWeight="black"
                color="fg.default"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                👁️ SPECTATE MODE
              </Text>
            </HStack>

            {/* Search Bar */}
            <HStack gap={3}>
              <Box position="relative" flex="1">
                <Input
                  placeholder="Enter Match ID to spectate (e.g. 123)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  bg="bg.default"
                  border="3px solid"
                  borderColor="border.default"
                  borderRadius="sm"
                  color="fg.default"
                  fontSize={{ base: "sm", md: "md" }}
                  py={3}
                  pl={10}
                  _focus={{
                    borderColor: "primary.emphasis",
                    boxShadow: "0 0 0 2px var(--chakra-colors-primary-emphasis)",
                  }}
                />
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--chakra-colors-fg-muted)'
                  }}
                />
              </Box>

              <Button
                onClick={handleSearch}
                disabled={!searchTerm.trim() || isLoading}
                bg="primary.emphasis"
                color="fg.inverted"
                border="3px solid"
                borderColor="border.default"
                borderRadius="sm"
                shadow="brutalist.md"
                px={4}
                py={3}
                fontWeight="black"
                textTransform="uppercase"
                _hover={{
                  transform: "translate(-1px, -1px)",
                  shadow: "brutalist.lg",
                }}
                size={{ base: "sm", md: "md" }}
              >
                {isLoading ? <Spinner size="sm" /> : "SEARCH"}
              </Button>

              {(selectedMatch || searchTerm) && (
                <Button
                  onClick={clearSearch}
                  bg="bg.default"
                  color="fg.default"
                  border="3px solid"
                  borderColor="border.default"
                  borderRadius="sm"
                  shadow="brutalist.md"
                  px={4}
                  py={3}
                  fontWeight="black"
                  textTransform="uppercase"
                  _hover={{
                    transform: "translate(-1px, -1px)",
                    shadow: "brutalist.lg",
                  }}
                  size={{ base: "sm", md: "md" }}
                >
                  CLEAR
                </Button>
              )}

              <IconButton
                onClick={fetchOngoingMatches}
                bg="brutalist.green"
                color="fg.inverted"
                border="3px solid"
                borderColor="border.default"
                borderRadius="sm"
                shadow="brutalist.md"
                _hover={{
                  transform: "translate(-1px, -1px)",
                  shadow: "brutalist.lg",
                }}
                size={{ base: "sm", md: "md" }}
              >
                <RefreshCw size={16} />
              </IconButton>
            </HStack>

            {/* Status Text */}
            <Text
              fontSize="sm"
              color="fg.muted"
              textAlign="center"
              fontWeight="medium"
            >
              {selectedMatch
                ? `Viewing Match #${selectedMatch.match.id} • Score: ${player1Score}-${player2Score} • ${sortedRounds.length} rounds`
                : `${ongoingMatches.length} ongoing matches available`
              }
            </Text>
          </VStack>
        </Box>

        {/* Content */}
        <Box bg="bg.default">
          {error && (
            <Box
              bg="error"
              color="fg.inverted"
              p={4}
              borderBottom="3px solid"
              borderColor="border.default"
            >
              <Text fontWeight="bold" fontSize="sm">
                ❌ {error}
              </Text>
            </Box>
          )}

          {/* Selected Match View */}
          {selectedMatch ? (
            <VStack gap={0} align="stretch">
              {/* Match Info Header */}
              <Box
                bg="bg.subtle"
                borderBottom="2px solid"
                borderColor="border.subtle"
                p={4}
              >
                <Grid
                  templateColumns={{ base: "1fr", md: "1fr auto 1fr" }}
                  gap={4}
                  alignItems="center"
                >
                  {/* Player 1 */}
                  <VStack align={{ base: "center", md: "start" }}>
                    <Text fontSize="lg" fontWeight="black" color="fg.default">
                      {getDisplayName(selectedMatch.participants?.find(p => p.position === 1)?.users, 'Player 1')}
                    </Text>
                    {selectedMatch.participants?.find(p => p.position === 1)?.users && (
                      <Text fontSize="sm" color="fg.muted">
                        {selectedMatch.participants.find(p => p.position === 1)?.users?.matches_won || 0}W - {selectedMatch.participants.find(p => p.position === 1)?.users?.matches_lost || 0}L
                      </Text>
                    )}
                  </VStack>

                  {/* VS and Score */}
                  <VStack align="center" gap={2}>
                    <Badge
                      bg={getStatusColor(selectedMatch.match.status || 'waiting')}
                      color="white"
                      fontSize="xs"
                      fontWeight="black"
                      px={2}
                      py={1}
                      borderRadius="sm"
                      textTransform="uppercase"
                    >
                      {getStatusText(selectedMatch.match.status || 'waiting')}
                    </Badge>
                    <HStack gap={2}>
                      <Badge
                        bg={player1Score > player2Score ? "brutalist.green" : "fg.muted"}
                        color="white"
                        fontSize="lg"
                        fontWeight="black"
                        px={3}
                        py={1}
                        borderRadius="sm"
                      >
                        {player1Score}
                      </Badge>
                      <Text fontSize="lg" fontWeight="black" color="fg.default">-</Text>
                      <Badge
                        bg={player2Score > player1Score ? "brutalist.green" : "fg.muted"}
                        color="white"
                        fontSize="lg"
                        fontWeight="black"
                        px={3}
                        py={1}
                        borderRadius="sm"
                      >
                        {player2Score}
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" color="fg.muted">
                      Stake: {formatSolAmount(selectedMatch.match.stake_amount)} ◎
                    </Text>
                  </VStack>

                  {/* Player 2 */}
                  <VStack align={{ base: "center", md: "end" }}>
                    <Text fontSize="lg" fontWeight="black" color="fg.default">
                      {getDisplayName(selectedMatch.participants?.find(p => p.position === 2)?.users, 'Player 2')}
                    </Text>
                    {selectedMatch.participants?.find(p => p.position === 2)?.users && (
                      <Text fontSize="sm" color="fg.muted">
                        {selectedMatch.participants.find(p => p.position === 2)?.users?.matches_won || 0}W - {selectedMatch.participants.find(p => p.position === 2)?.users?.matches_lost || 0}L
                      </Text>
                    )}
                  </VStack>
                </Grid>

                {/* Tournament Info */}
                {selectedMatch.tournament && (
                  <Box mt={3} p={3} bg="primary.muted" borderRadius="sm">
                    <HStack gap={2} align="center" justify="center">
                      <Trophy size={16} />
                      <Text fontSize="sm" fontWeight="bold">
                        Tournament: {selectedMatch.tournament.name}
                      </Text>
                    </HStack>
                  </Box>
                )}

                {/* Final Result for Completed Matches */}
                {selectedMatch.match.status === 'completed' && (
                  <Box mt={3} p={3} bg="brutalist.green" borderRadius="sm">
                    <Text fontSize="sm" fontWeight="bold" color="white" textAlign="center">
                      🏆 MATCH COMPLETED: {player1Score > player2Score
                        ? `${getDisplayName(selectedMatch.participants?.find(p => p.position === 1)?.users, 'Player 1')} WINS ${player1Score}-${player2Score}!`
                        : player2Score > player1Score
                          ? `${getDisplayName(selectedMatch.participants?.find(p => p.position === 2)?.users, 'Player 2')} WINS ${player2Score}-${player1Score}!`
                          : `TIE GAME ${player1Score}-${player2Score}!`
                      }
                    </Text>
                  </Box>
                )}
              </Box>

              {/* Rounds Table */}
              {gameRounds.length === 0 ? (
                <Box p={8} textAlign="center">
                  <Text fontSize="lg" color="fg.muted" fontWeight="medium">
                    No rounds have been played yet
                  </Text>
                </Box>
              ) : (
                <>
                  {/* Rounds Header */}
                  <Grid
                    templateColumns={{ base: "auto 1fr auto", md: "auto 1fr 1fr 1fr auto" }}
                    gap={4}
                    alignItems="center"
                    p={4}
                    bg="bg.subtle"
                    borderBottom="2px solid"
                    borderColor="border.default"
                    fontWeight="bold"
                    fontSize="sm"
                    color="fg.muted"
                    textTransform="uppercase"
                  >
                    <Text>ROUND</Text>
                    <Text textAlign="center">PLAYER 1</Text>
                    <Text textAlign="center" display={{ base: "none", md: "block" }}>PLAYER 2</Text>
                    <Text textAlign="center" display={{ base: "none", md: "block" }}>RESULT</Text>
                    <Text textAlign="center">STATUS</Text>
                  </Grid>

                  {/* Rounds List */}
                  <VStack gap={0} align="stretch">
                    {paginatedRounds.map((round) => {
                      const { result, winner } = getRoundResult(round, selectedMatch.participants || []);
                      const isCompleted = round.completed_at !== null;
                      const bothMovesSubmitted = round.player1_move !== null && round.player2_move !== null;
                      const showMoves = bothMovesSubmitted && isCompleted;

                      return (
                        <Grid
                          key={round.id}
                          templateColumns={{ base: "auto 1fr auto", md: "auto 1fr 1fr 1fr auto" }}
                          gap={4}
                          alignItems="center"
                          p={4}
                          borderBottom="1px solid"
                          borderColor="border.subtle"
                          _hover={{ bg: "bg.subtle" }}
                        >
                          <Text fontWeight="bold" fontSize="lg">
                            #{round.round_number}
                          </Text>

                          {/* Player 1 Move */}
                          <VStack align="center" gap={1}>
                            <Text fontSize="2xl">
                              {showMoves ? getMoveEmoji(round.player1_move) : (round.player1_move ? '🤐' : '❓')}
                            </Text>
                            <Text fontSize="xs" color="fg.muted" textAlign="center">
                              {showMoves
                                ? (round.player1_move || 'No move').toUpperCase()
                                : round.player1_move ? 'SUBMITTED' : 'WAITING'
                              }
                            </Text>
                          </VStack>

                          {/* Player 2 Move - Desktop */}
                          <VStack align="center" gap={1} display={{ base: "none", md: "flex" }}>
                            <Text fontSize="2xl">
                              {showMoves ? getMoveEmoji(round.player2_move) : (round.player2_move ? '🤐' : '❓')}
                            </Text>
                            <Text fontSize="xs" color="fg.muted" textAlign="center">
                              {showMoves
                                ? (round.player2_move || 'No move').toUpperCase()
                                : round.player2_move ? 'SUBMITTED' : 'WAITING'
                              }
                            </Text>
                          </VStack>

                          {/* Result - Desktop */}
                          <Box textAlign="center" display={{ base: "none", md: "block" }}>
                            {showMoves && (
                              <Badge
                                bg={result === 'WIN' ? "brutalist.green" : result === 'TIE' ? "brutalist.orange" : "fg.muted"}
                                color="white"
                                fontSize="xs"
                                fontWeight="black"
                                px={2}
                                py={1}
                                borderRadius="sm"
                                textTransform="uppercase"
                              >
                                {result === 'WIN' ? `${winner} WINS` : result}
                              </Badge>
                            )}
                          </Box>

                          {/* Status */}
                          <Box textAlign="center">
                            <Badge
                              bg={isCompleted ? "brutalist.green" : bothMovesSubmitted ? "brutalist.blue" : "brutalist.orange"}
                              color="white"
                              fontSize="xs"
                              fontWeight="black"
                              px={2}
                              py={1}
                              borderRadius="sm"
                              textTransform="uppercase"
                            >
                              {isCompleted ? 'DONE' : bothMovesSubmitted ? 'PROCESSING' : 'WAITING'}
                            </Badge>
                          </Box>
                        </Grid>
                      );
                    })}
                  </VStack>

                  {/* Pagination Footer */}
                  {totalPages > 1 && (
                    <Box
                      p={4}
                      bg="bg.subtle"
                      borderTop="2px solid"
                      borderColor="border.default"
                    >
                      <HStack justify="center" gap={2}>
                        <IconButton
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          bg="bg.default"
                          color="fg.default"
                          border="3px solid"
                          borderColor="border.default"
                          borderRadius="sm"
                          shadow="brutalist.sm"
                          _hover={{
                            transform: "translate(-1px, -1px)",
                            shadow: "brutalist.md",
                          }}
                          _disabled={{
                            opacity: 0.5,
                            cursor: "not-allowed",
                            transform: "none",
                          }}
                          size="sm"
                        >
                          <ChevronLeft size={16} />
                        </IconButton>

                        <HStack gap={1}>
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <Button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                bg={currentPage === pageNum ? "primary.emphasis" : "bg.default"}
                                color={currentPage === pageNum ? "fg.inverted" : "fg.default"}
                                border="3px solid"
                                borderColor="border.default"
                                borderRadius="sm"
                                shadow="brutalist.sm"
                                size="sm"
                                minW="8"
                                fontWeight="bold"
                                _hover={{
                                  transform: "translate(-1px, -1px)",
                                  shadow: "brutalist.md",
                                }}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </HStack>

                        <IconButton
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          bg="bg.default"
                          color="fg.default"
                          border="3px solid"
                          borderColor="border.default"
                          borderRadius="sm"
                          shadow="brutalist.sm"
                          _hover={{
                            transform: "translate(-1px, -1px)",
                            shadow: "brutalist.md",
                          }}
                          _disabled={{
                            opacity: 0.5,
                            cursor: "not-allowed",
                            transform: "none",
                          }}
                          size="sm"
                        >
                          <ChevronRight size={16} />
                        </IconButton>
                      </HStack>

                      <Text
                        fontSize="sm"
                        color="fg.muted"
                        textAlign="center"
                        mt={2}
                        fontWeight="medium"
                      >
                        Page {currentPage} of {totalPages} • {sortedRounds.length} total rounds
                      </Text>
                    </Box>
                  )}
                </>
              )}
            </VStack>
          ) : (
            /* Ongoing Matches List */
            <>
              {isLoadingMatches ? (
                <Box p={8} textAlign="center">
                  <Spinner size="lg" color="primary.emphasis" />
                  <Text fontSize="lg" fontWeight="bold" color="fg.muted" mt={4}>
                    Loading ongoing matches...
                  </Text>
                </Box>
              ) : ongoingMatches.length === 0 ? (
                <Box p={12} textAlign="center">
                  <Text fontSize="6xl" mb={4}>🎮</Text>
                  <Text fontSize="lg" fontWeight="bold" color="fg.muted" mb={4}>
                    NO ONGOING MATCHES
                  </Text>
                  <Text fontSize="md" color="fg.subtle">
                    No matches are currently in progress. Check back later!
                  </Text>
                </Box>
              ) : (
                <>
                  {/* Matches Header */}
                  <Grid
                    templateColumns={{ base: "auto 1fr auto", md: "auto 1fr auto auto auto" }}
                    gap={4}
                    alignItems="center"
                    p={4}
                    bg="bg.subtle"
                    borderBottom="2px solid"
                    borderColor="border.default"
                    fontWeight="bold"
                    fontSize="sm"
                    color="fg.muted"
                    textTransform="uppercase"
                  >
                    <Text>ID</Text>
                    <Text>DETAILS</Text>
                    <Text display={{ base: "none", md: "block" }}>STAKE</Text>
                    <Text display={{ base: "none", md: "block" }}>PLAYERS</Text>
                    <Text>STATUS</Text>
                  </Grid>

                  {/* Matches List */}
                  <VStack gap={0} align="stretch">
                    {ongoingMatches.map((match) => (
                      <Grid
                        key={match.id}
                        templateColumns={{ base: "auto 1fr auto", md: "auto 1fr auto auto auto" }}
                        gap={4}
                        alignItems="center"
                        p={4}
                        borderBottom="1px solid"
                        borderColor="border.subtle"
                        _hover={{ bg: "bg.subtle" }}
                        cursor="pointer"
                        onClick={() => fetchMatchData(match.id)}
                      >
                        <Text fontWeight="bold" fontSize="lg" color="primary.emphasis">
                          #{match.id}
                        </Text>

                        <VStack align="start" gap={1}>
                          <Text fontSize="md" fontWeight="bold" color="fg.default">
                            {match.tournament_name || '1v1 Match'}
                          </Text>
                          {match.started_at && (
                            <HStack gap={1} align="center">
                              <Clock size={12} color="var(--chakra-colors-fg-muted)" />
                              <Text fontSize="xs" color="fg.muted">
                                Started: {new Date(match.started_at).toLocaleTimeString()}
                              </Text>
                            </HStack>
                          )}
                        </VStack>

                        <Text
                          fontSize="sm"
                          fontWeight="bold"
                          color="fg.default"
                          display={{ base: "none", md: "block" }}
                        >
                          {formatSolAmount(match.stake_amount)} ◎
                        </Text>

                        <HStack
                          gap={1}
                          align="center"
                          display={{ base: "none", md: "flex" }}
                        >
                          <Users size={14} color="var(--chakra-colors-fg-muted)" />
                          <Text fontSize="sm" color="fg.muted">
                            {match.participant_count}
                          </Text>
                        </HStack>

                        <Badge
                          bg={getStatusColor(match.status)}
                          color="white"
                          fontSize="xs"
                          fontWeight="black"
                          px={2}
                          py={1}
                          borderRadius="sm"
                          textTransform="uppercase"
                        >
                          {getStatusText(match.status)}
                        </Badge>
                      </Grid>
                    ))}
                  </VStack>
                </>
              )}
            </>
          )}
        </Box>
      </Card.Root>
    </Container>
  );
};

export default Spectate;