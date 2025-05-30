// packages/dapp/game-app/src/components/Leaderboard/Leaderboard.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Container,
  Text,
  VStack,
  HStack,
  Spinner,
  Button,
  Badge,
  Input,
  IconButton,
  Card,
  Grid,
  GridItem,
  useBreakpointValue,
} from '@chakra-ui/react';
import { 
  Crown, 
  RefreshCw, 
  Search, 
  Copy, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { database } from '@/supabase/Database';
import { toaster } from '@/components/ui/toaster';
import type { User } from '@/types/lobby';

// Define a type for a player with calculated net wins and rank
interface RankedPlayer extends User {
  net_wins: number;
  rank: 'Unranked' | 'Bronze' | 'Silver' | 'Gold' | 'Legendary';
}

const ITEMS_PER_PAGE = 15;

const Leaderboard: React.FC = () => {
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const isMobile = useBreakpointValue({ base: true, md: false });

  // Function to determine player rank based on net wins
  const getPlayerRank = (netWins: number): RankedPlayer['rank'] => {
    if (netWins > 20) return 'Legendary';
    if (netWins > 15) return 'Gold';
    if (netWins > 10) return 'Silver';
    if (netWins > 5) return 'Bronze';
    return 'Unranked';
  };

  // Function to get color scheme for rank badge
  const getRankColors = (rank: RankedPlayer['rank']) => {
    switch (rank) {
      case 'Bronze': return { bg: 'brutalist.orange', color: 'fg.default' };
      case 'Silver': return { bg: 'brutalist.gray.300', color: 'fg.default' };
      case 'Gold': return { bg: 'brutalist.yellow', color: 'fg.default' };
      case 'Legendary': return { bg: 'primary.emphasis', color: 'fg.inverted' };
      default: return { bg: 'bg.muted', color: 'fg.muted' };
    }
  };

  // Filter and paginate players
  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      const matchesSearch = searchTerm === '' || 
        player.solana_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (player.nickname && player.nickname.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesSearch;
    });
  }, [players, searchTerm]);

  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredPlayers.slice(startIndex, endIndex);
  }, [filteredPlayers, currentPage]);

  const totalPages = Math.ceil(filteredPlayers.length / ITEMS_PER_PAGE);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedUsers: User[] = await database.users.getAll();

      const rankedAndFilteredPlayers: RankedPlayer[] = fetchedUsers
        .map(user => {
          const wins = user.matches_won ?? 0;
          const losses = user.matches_lost ?? 0;
          const net_wins = wins - losses;
          const rank = getPlayerRank(net_wins);
          return { ...user, net_wins, rank };
        })
        .sort((a, b) => b.net_wins - a.net_wins);

      setPlayers(rankedAndFilteredPlayers);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const copyToClipboard = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toaster.create({
        title: "Copied! 📋",
        description: "Wallet address copied to clipboard",
        type: "success",
        duration: 2000,
      });
    } catch (err) {
      toaster.create({
        title: "Copy Failed",
        description: "Could not copy to clipboard",
        type: "error",
        duration: 3000,
      });
    }
  };

  const openSolscan = (address: string) => {
    window.open(`https://solscan.io/account/${address}`, '_blank');
  };

  const getDisplayName = (user: User): string => {
    return user.nickname || "no nickname";
  };

  const getPositionDisplay = (index: number) => {
    const position = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
    return position;
  };

  if (loading) {
    return (
      <Container maxW="6xl" py={8}>
        <VStack padding={6}>
          <Spinner 
            size="xl" 
            color="primary.emphasis"
            // thickness="4px"
          />
          <Text 
            fontSize="lg" 
            fontWeight="bold" 
            color="fg.muted"
            textTransform="uppercase"
            // letterpadding="wider"
          >
            Loading Champions...
          </Text>
        </VStack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="6xl" py={8}>
        <Card.Root
          bg="error"
          color="fg.inverted"
          border="border.default"
          borderRadius="sm"
          shadow="brutalist.lg"
        >
          <Card.Body p={8} textAlign="center">
            <Text fontSize="6xl" mb={4}>⚠️</Text>
            <Text fontSize="lg" mb={6}>{error}</Text>
            <Button
              onClick={fetchLeaderboard}
              bg="fg.inverted"
              color="error"
              fontWeight="bold"
              border="2px solid"
              borderColor="fg.inverted"
              borderRadius="sm"
              shadow="brutalist.md"
              _hover={{
                transform: "translate(-2px, -2px)",
                shadow: "brutalist.lg",
              }}
              _active={{
                transform: "translate(0px, 0px)",
                shadow: "brutalist.sm",
              }}
              // leftIcon={<RefreshCw size={20} />}
            >
              RETRY
            </Button>
          </Card.Body>
        </Card.Root>
      </Container>
    );
  }

  return (
    <Container maxW="6xl" py={6}>
      {/* One Big Table Container */}
      <Card.Root
        bg="bg.default"
        border="border.default"
        borderRadius="sm"
        shadow="brutalist.xl"
        overflow="hidden"
      >
        {/* Search Header */}
        <Box
          bg="primary.subtle"
          // bg="violet.500"
          borderBottom="2px solid"
          borderColor="border.default"
          p={4}
        >
          <VStack padding={0}>
            {/* Search Input */}
            <HStack w="100%" padding={2}>
              <Box position="relative" flex="1">
                <Input
                  placeholder="Search by wallet address or nickname..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  bg="bg.default"
                  border="border.default"
                  borderRadius="sm"
                  color="fg.default"
                  fontSize={{ base: "sm", md: "md" }}
                  py={3}
                  pl={10}
                  _focus={{
                    boxShadow: "0 0 0 2px var(--chakra-colors-primary-emphasis)",
                    borderColor: "primary.emphasis",
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
                onClick={fetchLeaderboard}
                bg="primary.emphasis"
                color="fg.inverted"
                border="border.default"
                borderRadius="sm"
                shadow="brutalist.sm"
                _hover={{
                  transform: "translate(-1px, -1px)",
                  shadow: "brutalist.md",
                }}
                // leftIcon={<RefreshCw size={16} />}
                size={{ base: "sm", md: "md" }}
              >
                {isMobile ? '' : 'REFRESH'}
              </Button>
            </HStack>

            {/* Results Info */}
            <Text 
              fontSize="sm" 
              color="fg.muted" 
              textAlign="center"
              fontWeight="medium"
            >
              Showing {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
              {searchTerm && ` matching "${searchTerm}"`}
            </Text>
          </VStack>
        </Box>

        {/* Table Content */}
        <Box bg="bg.default">
          {filteredPlayers.length === 0 ? (
            <Box p={12} textAlign="center">
              <Text fontSize="6xl" mb={4}>🏆</Text>
              <Text 
                fontSize="lg" 
                fontWeight="bold" 
                color="fg.muted" 
                mb={4}
                textTransform="uppercase"
              >
                {searchTerm ? 'NO MATCHES FOUND' : 'NO PLAYERS YET'}
              </Text>
              <Text fontSize="md" color="fg.subtle">
                {searchTerm 
                  ? `No players found matching "${searchTerm}"`
                  : 'Play some matches to appear on the leaderboard!'
                }
              </Text>
            </Box>
          ) : (
            <>
              {/* Table Header */}
              <Grid
                templateColumns={{
                  base: "auto 1fr auto auto",
                  md: "auto 2fr 1fr auto auto auto"
                }}
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
                // letterpadding="wider"
              >
                <GridItem>RANK</GridItem>
                <GridItem>PLAYER</GridItem>
                <GridItem display={{ base: "none", md: "block" }}>STATS</GridItem>
                <GridItem>TIER</GridItem>
                <GridItem display={{ base: "none", md: "block" }}>NET</GridItem>
                <GridItem>ACTIONS</GridItem>
              </Grid>

              {/* Table Body */}
              <VStack padding={0} align="stretch">
                {paginatedPlayers.map((player, index) => {
                  const position = getPositionDisplay(index);
                  const rankColors = getRankColors(player.rank);
                  const isTopThree = position <= 3;
                  
                  return (
                    <Grid
                      key={player.id}
                      templateColumns={{
                        base: "auto 1fr auto auto",
                        md: "auto 2fr 1fr auto auto auto"
                      }}
                      gap={4}
                      alignItems="center"
                      p={4}
                      bg="bg.default"
                      borderBottom="1px solid"
                      borderColor="border.subtle"
                      _hover={{
                        bg: "bg.subtle",
                      }}
                      transition="all 0.2s ease"
                    >
                      {/* Position & Crown */}
                      <GridItem>
                        <HStack padding={2}>
                          <Text 
                            fontSize={{ base: "md", md: "lg" }}
                            fontWeight="black" 
                            color={isTopThree ? "primary.emphasis" : "fg.default"}
                            minW="3ch"
                          >
                            #{position}
                          </Text>
                          {position === 1 && <Crown size={18} color="#FFD700" />}
                          {position === 2 && <Crown size={16} color="#C0C0C0" />}
                          {position === 3 && <Crown size={14} color="#CD7F32" />}
                        </HStack>
                      </GridItem>

                      {/* Player Info */}
                      <GridItem>
                        <VStack align="start" padding={0}>
                          <Text 
                            fontSize={{ base: "sm", md: "md" }}
                            fontWeight="bold" 
                            color="fg.default"
                          >
                            {getDisplayName(player)}
                          </Text>
                          <HStack padding={0} align="center">
                            <Text 
                              fontSize={{ base: "xs", md: "sm" }}
                              color="fg.muted"
                              fontFamily="mono"
                            >
                              {player.solana_address.slice(0, 8)}...{player.solana_address.slice(-8)}
                            </Text>
                            <IconButton
                              onClick={() => copyToClipboard(player.solana_address)}
                              bg="bg.subtle"
                              color="fg.default"
                              border="1px solid"
                              borderColor="border.subtle"
                              borderRadius="sm"
                              shadow="brutalist.sm"
                              size="xs"
                              _hover={{
                                bg: "bg.muted",
                                transform: "translate(-1px, -1px)",
                                shadow: "brutalist.sm",
                              }}
                            >
                              <Copy size={10} />
                            </IconButton>
                            <IconButton
                              onClick={() => openSolscan(player.solana_address)}
                              bg="brutalist.blue"
                              color="fg.inverted"
                              border="1px solid"
                              borderColor="border.default"
                              borderRadius="sm"
                              shadow="brutalist.sm"
                              size="xs"
                              _hover={{
                                transform: "translate(-1px, -1px)",
                                shadow: "brutalist.sm",
                              }}
                            >
                              <ExternalLink size={10} />
                            </IconButton>
                          </HStack>
                        </VStack>
                      </GridItem>

                      {/* Stats - Hidden on mobile */}
                      <GridItem display={{ base: "none", md: "block" }}>
                        <HStack padding={0} justify="center">
                          <Badge
                            bg="brutalist.green"
                            color="fg.default"
                            px={2}
                            py={1}
                            borderRadius="sm"
                            fontSize="xs"
                            fontWeight="bold"
                          >
                            {player.matches_won ?? 0}W
                          </Badge>
                          <Badge
                            bg="error"
                            color="fg.inverted"
                            px={2}
                            py={1}
                            borderRadius="sm"
                            fontSize="xs"
                            fontWeight="bold"
                          >
                            {player.matches_lost ?? 0}L
                          </Badge>
                        </HStack>
                      </GridItem>

                      {/* Rank Badge */}
                      {/* <GridItem>
                        <Badge
                          bg={rankColors.bg}
                          color={rankColors.color}
                          px={2}
                          py={1}
                          borderRadius="sm"
                          fontSize="xs"
                          fontWeight="bold"
                          textTransform="uppercase"
                          border="1px solid"
                          borderColor="border.default"
                          shadow="brutalist.sm"
                        >
                          {player.rank}
                        </Badge>
                      </GridItem> */}

                      {/* Net Wins - Hidden on mobile */}
                      <GridItem display={{ base: "none", md: "block" }}>
                        <Text
                          fontSize="sm"
                          fontWeight="bold"
                          color={player.net_wins > 0 ? "brutalist.green" : player.net_wins < 0 ? "error" : "fg.muted"}
                          textAlign="center"
                        >
                          {player.net_wins > 0 ? '+' : ''}{player.net_wins}
                        </Text>
                      </GridItem>

                      {/* Mobile Stats - Shown only on mobile */}
                      <GridItem display={{ base: "block", md: "none" }}>
                        <VStack padding={1} align="end">
                          <HStack padding={1}>
                            <Badge
                              bg="brutalist.green"
                              color="fg.default"
                              px={1}
                              py={0.5}
                              borderRadius="sm"
                              fontSize="xs"
                              fontWeight="bold"
                            >
                              {player.matches_won ?? 0}W
                            </Badge>
                            <Badge
                              bg="error"
                              color="fg.inverted"
                              px={1}
                              py={0.5}
                              borderRadius="sm"
                              fontSize="xs"
                              fontWeight="bold"
                            >
                              {player.matches_lost ?? 0}L
                            </Badge>
                          </HStack>
                          <Text
                            fontSize="xs"
                            fontWeight="bold"
                            color={player.net_wins > 0 ? "brutalist.green" : player.net_wins < 0 ? "error" : "fg.muted"}
                          >
                            {player.net_wins > 0 ? '+' : ''}{player.net_wins}
                          </Text>
                        </VStack>
                      </GridItem>
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
                  <HStack justify="center" padding={2}>
                    <IconButton
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      bg="bg.default"
                      color="fg.default"
                      border="border.default"
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
                    >
                      <ChevronLeft size={16} />
                    </IconButton>

                    <HStack padding={1}>
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
                            border="border.default"
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
                      isDisabled={currentPage === totalPages}
                      bg="bg.default"
                      color="fg.default"
                      border="border.default"
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
                    Page {currentPage} of {totalPages} • {filteredPlayers.length} total players
                  </Text>
                </Box>
              )}
            </>
          )}
        </Box>
      </Card.Root>
    </Container>
  );
};

export default Leaderboard;