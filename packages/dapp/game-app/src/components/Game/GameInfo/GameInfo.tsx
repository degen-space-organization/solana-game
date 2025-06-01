import { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Spinner,
  Card,
  useBreakpointValue,
  Grid,
  GridItem,
  Badge,
} from '@chakra-ui/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { database } from '@/supabase/Database';
import { supabase } from '@/supabase';

export interface IGameDataWithTournament {
  match: {
    id: number;
    status: string;
    winner_id: number | null;
    stake_amount: string;
    total_prize_pool: string;
    tournament_id?: number | null;
  };
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
  tournamentParticipants?: Array<{
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
  tournament?: {
    id: number;
    name: string;
    status: string;
    max_players: number;
    current_players: number;
    prize_pool: string;
  } | null;
}

interface GameRound {
  id: number;
  round_number: number;
  player1_move: string | null;
  player2_move: string | null;
  winner_id: number | null;
  completed_at: string | null;
}

/**
 * @function GameInfo
 * 
 * @description Sleek horizontal game information display
 * Shows game details, participants in bracket format, and real-time scoring
 */
export default function GameInfo() {
  const { publicKey } = useWallet();
  const [gameData, setGameData] = useState<IGameDataWithTournament | null>(null);
  const [gameRounds, setGameRounds] = useState<GameRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMobile = useBreakpointValue({ base: true, md: false });

  // Fetch game data
  const fetchGameData = async () => {
    if (!publicKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await database.games.getCompleteGameDataByWallet(publicKey.toBase58());
      setGameData(data as IGameDataWithTournament);
      // TODO - handle this properly
      // const data = await database.games.getCurrentGameByWallet(publicKey.toBase58());
      // setGameData(data as IGameDataWithTournament);

      // Fetch game rounds if we have a match
      if (data?.match?.id) {
        const rounds = await database.games.getRoundsForMatch(data.match.id);
        setGameRounds(rounds || []);
      }
    } catch (err) {
      console.error('Error fetching game data:', err);
      setError('Failed to load game info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameData();
  }, [publicKey]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!gameData?.match?.id) return;

    const channel = supabase
      .channel(`gameinfo-${gameData.match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `match_id=eq.${gameData.match.id}`,
        },
        () => {
          fetchGameData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${gameData.match.id}`,
        },
        () => {
          fetchGameData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameData?.match?.id]);

  const formatSolAmount = (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
  };

  const truncateText = (text: string, maxLength: number = 12): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  };

  const getDisplayName = (user: any): string => {
    return user?.nickname || `${user?.solana_address?.slice(0, 4)}...${user?.solana_address?.slice(-4)}`;
  };

  const getCurrentUser = () => {
    if (!publicKey || !gameData) return null;
    return gameData.participants.find(p => 
      p.users.solana_address === publicKey.toBase58()
    );
  };

  const getPlayerScore = (userId: number): number => {
    return gameRounds.filter(round => 
      round.winner_id === userId && round.completed_at
    ).length;
  };

  const renderScoreDots = (score: number, maxScore: number = 3, isUser: boolean = false) => {
    const dots = [];
    for (let i = 0; i < maxScore; i++) {
      dots.push(
        <Box
          key={i}
          w="12px"
          h="12px"
          borderRadius="full"
          bg={i < score ? (isUser ? 'brutalist.green' : 'error') : 'brutalist.gray.300'}
          border="1px solid"
          borderColor="border.default"
        />
      );
    }
    return dots;
  };

  // Loading state
  if (loading) {
    return (
      <Box p={2} textAlign="center">
        <HStack justify="center" padding={2}>
          <Spinner size="sm" color="primary.emphasis" />
          <Text fontSize="xs" color="fg.muted" fontWeight="bold">
            Loading...
          </Text>
        </HStack>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box p={2} textAlign="center">
        <Text fontSize="xs" color="error" fontWeight="bold">
          {error}
        </Text>
      </Box>
    );
  }

  // No game data
  if (!gameData) {
    return (
      <Box p={2} textAlign="center">
        <Text fontSize="xs" color="fg.muted">
          No active game
        </Text>
      </Box>
    );
  }

  const { match, tournament, participants } = gameData;
  const currentUser = getCurrentUser();
  const isMatch = !tournament;

  // Get tournament participants for bracket display
  const getTournamentParticipants = () => {
    if (!tournament || !gameData.tournamentParticipants) {
      return participants;
    }
    const tournamentParticipants = gameData.tournamentParticipants;
    return tournamentParticipants;
  };

  const player1 = participants.find(p => p.position === 1);
  const player2 = participants.find(p => p.position === 2);
  const player1Score = player1 ? getPlayerScore(player1.user_id) : 0;
  const player2Score = player2 ? getPlayerScore(player2.user_id) : 0;

  return (
    <VStack align="stretch">
      {/* Main Game Info - Horizontal Layout */}
      <HStack 
        justify="space-between" 
        align="center" 
        padding={2}
        flexDirection={{ base: 'column', md: 'row' }}
        gap={{ base: 1, md: 2 }}
      >
        {/* Left Side - Game Details */}
        <HStack padding={3} align="center">
          {/* Game Type Icon */}
          <Box
            bg="primary.subtle"
            p={2}
            borderRadius="sm"
            border="2px solid"
            borderColor="border.default"
          >
            <Text fontSize="lg">
              {isMatch ? '⚔️' : '🏆'}
            </Text>
          </Box>

          {/* Game Info */}
          <VStack padding={0} align="flex-start">
            <HStack padding={2}>
              <Text fontSize="sm" fontWeight="black" color="fg.default">
                {isMatch ? '1v1 DUEL' : tournament?.name || 'TOURNAMENT'}
              </Text>
              <Badge
                bg="primary.emphasis"
                color="fg.inverted"
                fontSize="xs"
                px={2}
                py={0.5}
                borderRadius="sm"
              >
                #{match.id}
              </Badge>
            </HStack>
            <HStack padding={2}>
              <Text fontSize="sm" color="fg.muted" fontWeight="bold">
                💰 {formatSolAmount(match.total_prize_pool)} SOL
              </Text>
              {tournament && (
                <Text fontSize="xs" color="fg.muted">
                  • {tournament.max_players} players
                </Text>
              )}
            </HStack>
          </VStack>
        </HStack>

        {/* Right Side - Participants (Bracket Style) */}
        <HStack 
          padding={2} 
          flexWrap="wrap" 
          justify={{ base: 'center', md: 'flex-end' }}
        >
          {isMatch ? (
            // 1v1 Match - Single pair
            <HStack padding={1}>
              {participants.map((participant) => (
                <Box
                  key={participant.user_id}
                  bg={currentUser?.user_id === participant.user_id ? 'brutalist.green' : 'bg.subtle'}
                  color={currentUser?.user_id === participant.user_id ? 'fg.inverted' : 'fg.default'}
                  px={2}
                  py={1}
                  borderRadius="sm"
                  border="2px solid"
                  borderColor={currentUser?.user_id === participant.user_id ? 'border.default' : 'border.subtle'}
                  fontSize="xs"
                  fontWeight="bold"
                  position="relative"
                >
                  {currentUser?.user_id === participant.user_id && (
                    <Text
                      position="absolute"
                      top="-6px"
                      left="50%"
                      transform="translateX(-50%)"
                      fontSize="8px"
                      fontWeight="black"
                      bg="brutalist.green"
                      color="fg.inverted"
                      px={1}
                      borderRadius="sm"
                    >
                      YOU
                    </Text>
                  )}
                  {truncateText(getDisplayName(participant.users))}
                </Box>
              ))}
            </HStack>
          ) : (
            // Tournament - Bracket pairs
            <Grid
              templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }}
              gap={2}
              maxW={{ base: '200px', md: 'none' }}
            >
              {getTournamentParticipants().map((participant) => (
                <GridItem key={participant.user_id}>
                  <Box
                    bg={currentUser?.user_id === participant.user_id ? 'brutalist.green' : 'bg.subtle'}
                    color={currentUser?.user_id === participant.user_id ? 'fg.inverted' : 'fg.default'}
                    px={2}
                    py={1}
                    borderRadius="sm"
                    border="2px solid"
                    borderColor={currentUser?.user_id === participant.user_id ? 'border.default' : 'border.subtle'}
                    fontSize="xs"
                    fontWeight="bold"
                    textAlign="center"
                    position="relative"
                  >
                    {currentUser?.user_id === participant.user_id && (
                      <Text
                        position="absolute"
                        top="-6px"
                        left="50%"
                        transform="translateX(-50%)"
                        fontSize="8px"
                        fontWeight="black"
                        bg="brutalist.green"
                        color="fg.inverted"
                        px={1}
                        borderRadius="sm"
                      >
                        YOU
                      </Text>
                    )}
                    {truncateText(getDisplayName(participant.users))}
                  </Box>
                </GridItem>
              ))}
            </Grid>
          )}
        </HStack>
      </HStack>

      {/* Current Match Scoring - Only show if match is in progress */}
      {match.status === 'in_progress' && player1 && player2 && (
        <Card.Root
          bg="violet.300"
          border="1px solid"
          // borderColor="border.subtle"
          borderRadius="sm"
          width="100%"
          shadow="brutalist.sm"
        >
          <Card.Body p={2}>
            <HStack justify="space-between" align="center">
              {/* Player 1 */}
              <HStack padding={2}>
                {!isMobile && (
                  <Box
                    bg={currentUser?.user_id === player1.user_id ? 'brutalist.green' : 'bg.default'}
                    color={currentUser?.user_id === player1.user_id ? 'fg.inverted' : 'fg.default'}
                    px={2}
                    py={1}
                    borderRadius="sm"
                    border="2px solid"
                    borderColor="border.default"
                    fontSize="xs"
                    fontWeight="bold"
                    position="relative"
                  >
                    {currentUser?.user_id === player1.user_id && (
                      <Text
                        position="absolute"
                        top="-6px"
                        left="50%"
                        transform="translateX(-50%)"
                        fontSize="8px"
                        fontWeight="black"
                        bg="brutalist.green"
                        color="fg.inverted"
                        px={1}
                        borderRadius="sm"
                      >
                        YOU
                      </Text>
                    )}
                    {truncateText(getDisplayName(player1.users), 8)}
                  </Box>
                )}
                <HStack padding={1}>
                  {currentUser?.user_id === player1.user_id ? (
                    <Text>You</Text>
                  ) : (
                    <Text>Opps</Text>
                  )}
                  {renderScoreDots(player1Score, 3, currentUser?.user_id === player1.user_id)}
                </HStack>
              </HStack>

              {/* VS */}
              <Box
                bg="primary.emphasis"
                color="fg.inverted"
                px={2}
                py={1}
                borderRadius="sm"
                border="2px solid"
                borderColor="border.default"
                fontSize="xs"
                fontWeight="black"
              >
                VS
              </Box>

              {/* Player 2 */}
              <HStack padding={2}>
                <HStack padding={1}>
                  {renderScoreDots(player2Score, 3, currentUser?.user_id === player2.user_id)}
                  {currentUser?.user_id === player2.user_id ? (
                    <Text>You</Text>
                  ) : (
                    <Text>Opps</Text>
                  )}
                </HStack>
                {!isMobile && (
                  <Box
                    bg={currentUser?.user_id === player2.user_id ? 'brutalist.green' : 'bg.default'}
                    color={currentUser?.user_id === player2.user_id ? 'fg.inverted' : 'fg.default'}
                    px={2}
                    py={1}
                    borderRadius="sm"
                    border="2px solid"
                    borderColor="border.default"
                    fontSize="xs"
                    fontWeight="bold"
                    position="relative"
                  >
                    {currentUser?.user_id === player2.user_id && (
                      <Text
                        position="absolute"
                        top="-6px"
                        left="50%"
                        transform="translateX(-50%)"
                        fontSize="8px"
                        fontWeight="black"
                        bg="brutalist.green"
                        color="fg.inverted"
                        px={1}
                        borderRadius="sm"
                      >
                        YOU
                      </Text>
                    )}
                    {truncateText(getDisplayName(player2.users), 8)}
                  </Box>
                )}
              </HStack>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
}