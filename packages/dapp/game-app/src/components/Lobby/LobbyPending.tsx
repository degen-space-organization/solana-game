// components/Lobby/LobbyPending.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Grid,
  Heading,
  Text,
  Badge,
  HStack,
  VStack,
  Container,
  IconButton,
  useBreakpointValue,
} from '@chakra-ui/react';
import { ChevronLeft, ChevronRight, Users, Trophy, Swords, RotateCcw } from 'lucide-react';
import type { PendingLobby } from '../../types/lobby';
import { database } from '@/supabase/Database';
import { useWallet } from '@solana/wallet-adapter-react';

interface LobbyCardProps {
  lobby: PendingLobby;
  onJoin: (lobbyId: number) => void;
}

const LobbyCard: React.FC<LobbyCardProps> = ({ lobby, onJoin }) => {
  const getDisplayName = (user: any) => {
    if (!user) return 'Unknown';
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  };

  const isFull = lobby.current_players >= lobby.max_players;
  const isEmpty = lobby.current_players === 0;

  return (
    <Card.Root
      borderWidth="4px"
      borderStyle="solid"
      borderColor="border.default"
      bg="bg.default"
      shadow="brutalist.lg"
      borderRadius="0"
      _hover={{
        shadow: "brutalist.xl",
      }}
      transition="all 0.2s ease"
      h="100%"
    >
      <Card.Body p={6}>
        {/* Header */}
        <VStack align="flex-start" padding={3} mb={4}>
          <HStack justify="space-between" w="100%">
            <Badge
              bg={lobby.is_tournament ? "brutalist.purple" : "brutalist.blue"}
              color="fg.inverted"
              fontSize="xs"
              fontWeight="black"
              px={3}
              py={1}
              borderRadius="0"
              textTransform="uppercase"
              letterSpacing="wider"
              border="2px solid"
              borderColor="border.default"
            >
              {lobby.is_tournament ? (
                <HStack padding={1}>
                  <Trophy size={12} />
                  <Text>TOURNAMENT</Text>
                </HStack>
              ) : (
                <HStack padding={1}>
                  <Swords size={12} />
                  <Text>1v1 DUEL</Text>
                </HStack>
              )}
            </Badge>

            <Badge
              bg={isEmpty ? "brutalist.orange" : isFull ? "error" : "success"}
              color="fg.inverted"
              fontSize="xs"
              fontWeight="black"
              px={2}
              py={1}
              borderRadius="0"
              border="2px solid"
              borderColor="border.default"
            >
              {isEmpty ? "EMPTY" : isFull ? "FULL" : "ACTIVE"}
            </Badge>
          </HStack>

          <Heading
            size="md"
            fontWeight="black"
            color="fg.default"
            textTransform="uppercase"
            letterSpacing="tight"
            lineHeight="1.2"
          >
            {lobby.name || `Game #${lobby.id}`}
          </Heading>
        </VStack>

        {/* Players Info */}
        <Box
          bg="bg.subtle"
          border="3px solid"
          borderColor="border.default"
          p={4}
          mb={4}
          borderRadius="0"
        >
          <HStack justify="space-between" mb={2}>
            <HStack padding={2}>
              <Users size={16} />
              <Text fontSize="sm" fontWeight="bold" color="fg.default">
                PLAYERS
              </Text>
            </HStack>
            <Text
              fontSize="lg"
              fontWeight="black"
              color={isFull ? "error" : "success"}
            >
              {lobby.current_players}/{lobby.max_players}
            </Text>
          </HStack>

          {/* Progress Bar */}
          <Box bg="bg.muted" h={3} borderRadius="0" overflow="hidden" border="2px solid" borderColor="border.subtle">
            <Box
              bg={isFull ? "error" : "success"}
              h="100%"
              w={`${(lobby.current_players / lobby.max_players) * 100}%`}
              transition="width 0.3s ease"
            />
          </Box>
        </Box>

        {/* Stake Info */}
        <Box
          bg="brutalist.yellow"
          border="3px solid"
          borderColor="border.default"
          p={4}
          mb={4}
          borderRadius="0"
          color="fg.default"
        >
          <Grid templateColumns="1fr 1fr" gap={2}>
            <VStack align="flex-start" padding={1}>
              <Text fontSize="xs" fontWeight="black">
                STAKE
              </Text>
              <Text fontSize="lg" fontWeight="black">
                {lobby.stake_amount_sol} SOL
              </Text>
            </VStack>
            <VStack align="flex-end" padding={1}>
              <Text fontSize="xs" fontWeight="black">
                PRIZE
              </Text>
              <Text fontSize="lg" fontWeight="black">
                {lobby.total_prize_pool_sol} SOL
              </Text>
            </VStack>
          </Grid>
        </Box>

        {/* Creator Info */}
        <Box mb={4}>
          <Text fontSize="xs" fontWeight="bold" color="fg.muted" mb={1}>
            CREATED BY
          </Text>
          <VStack align="flex-start" padding={1}>
            <Text fontSize="sm" fontWeight="bold" color="fg.default" >
              {getDisplayName(lobby.created_by_user)}
            </Text>
            {lobby.created_by_user && (
              <Text fontSize="xs" color="fg.muted">
                {lobby.created_by_user.matches_won}W-{lobby.created_by_user.matches_lost}L
              </Text>
            )}
          </VStack>
        </Box>
      </Card.Body>

      <Card.Footer p={6} pt={0}>
        <Button
          onClick={() => onJoin(lobby.id)}
          disabled={isFull}
          size="lg"
          width="100%"
          bg={isFull ? "bg.muted" : "brutalist.green"}
          color={isFull ? "fg.muted" : "fg.inverted"}
          fontWeight="black"
          fontSize="md"
          textTransform="uppercase"
          letterSpacing="wider"
          borderRadius="0"
          border="3px solid"
          borderColor="border.default"
          shadow="brutalist.md"
          _hover={!isFull ? {
            bg: "#26C6B3",
            transform: "translate(-2px, -2px)",
            shadow: "brutalist.lg",
          } : {}}
          _active={!isFull ? {
            transform: "translate(0px, 0px)",
            shadow: "brutalist.sm",
          } : {}}
          transition="all 0.1s ease"
        >
          {isFull ? "🔒 FULL" : "⚡ JOIN GAME"}
        </Button>
      </Card.Footer>
    </Card.Root>
  );
};

// Pagination Component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const showPages = 5; // Show 5 page numbers max

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + showPages - 1);

    if (end - start < showPages - 1) {
      start = Math.max(1, end - showPages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <HStack justify="center" padding={2} mt={8}>
      <IconButton
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        bg={currentPage === 1 ? "bg.muted" : "brutalist.blue"}
        color={currentPage === 1 ? "fg.muted" : "fg.inverted"}
        borderRadius="0"
        border="3px solid"
        borderColor="border.default"
        shadow="brutalist.sm"
        _hover={currentPage !== 1 ? {
          transform: "translate(-1px, -1px)",
          shadow: "brutalist.md",
        } : {}}
        _active={currentPage !== 1 ? {
          transform: "translate(0px, 0px)",
          shadow: "brutalist.sm",
        } : {}}
      >
        <ChevronLeft size={16} />
      </IconButton>

      {getPageNumbers().map((page) => (
        <Button
          key={page}
          onClick={() => onPageChange(page)}
          bg={currentPage === page ? "primary.solid" : "bg.default"}
          color="fg.default"
          fontWeight="black"
          size="sm"
          borderRadius="0"
          border="3px solid"
          borderColor="border.default"
          shadow="brutalist.sm"
          _hover={{
            transform: "translate(-1px, -1px)",
            shadow: "brutalist.md",
            bg: currentPage === page ? "primary.solid" : "bg.subtle",
          }}
          _active={{
            transform: "translate(0px, 0px)",
            shadow: "brutalist.sm",
          }}
          minW="40px"
        >
          {page}
        </Button>
      ))}

      <IconButton
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        bg={currentPage === totalPages ? "bg.muted" : "brutalist.blue"}
        color={currentPage === totalPages ? "fg.muted" : "fg.inverted"}
        borderRadius="0"
        border="3px solid"
        borderColor="border.default"
        shadow="brutalist.sm"
        _hover={currentPage !== totalPages ? {
          transform: "translate(-1px, -1px)",
          shadow: "brutalist.md",
        } : {}}
        _active={currentPage !== totalPages ? {
          transform: "translate(0px, 0px)",
          shadow: "brutalist.sm",
        } : {}}
      >
        <ChevronRight size={16} />
      </IconButton>
    </HStack>
  );
};

interface LobbyPendingProps {
  onJoinLobby?: (lobbyId: number) => void;
  useMockData?: boolean;
  refreshTrigger?: number;
  onCreateLobby?: () => void;
  onRefresh?: () => void;
}

const LobbyPending: React.FC<LobbyPendingProps> = ({
  onJoinLobby = (id) => console.log(`Joining lobby ${id}`),
  refreshTrigger = 0,
  onCreateLobby,
  onRefresh
}) => {
  const [lobbies, setLobbies] = useState<PendingLobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const { publicKey } = useWallet();

  // Responsive items per page
  const itemsPerPage = useBreakpointValue({
    base: 2,  // Mobile: 2 items
    md: 4,    // Tablet: 4 items  
    lg: 6,    // Desktop: 6 items
    xl: 9     // Large desktop: 9 items
  }) || 6;

  const fetchLobbies = async () => {
    setLoading(true);
    try {
      const fetchedLobbies = await database.lobbies.getAll();
      setLobbies(fetchedLobbies);
    } catch (error) {
      console.error("Error fetching lobbies:", error);
      setLobbies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLobbies();
  }, [refreshTrigger]);

  const handleJoinLobby = async (lobbyId: number) => {
    onJoinLobby(lobbyId);

    if (!publicKey) return;

    const userId = await database.users.getByWallet(publicKey.toBase58());

    const response = await fetch('http://localhost:4000/api/v1/game/join-lobby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lobby_id: lobbyId,
        user_id: userId?.id,
      }),
    });

    if (!response.ok) {
      console.error('Failed to join lobby:', response.statusText);
      return;
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(lobbies.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLobbies = lobbies.slice(startIndex, endIndex);

  // Reset to page 1 when lobbies change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  return (
    <Container maxW="100%">
      {/* Main Container following leaderboard pattern */}
      <Card.Root
        borderWidth="1px"
        borderStyle="solid"
        borderColor="border.default"
        bg="bg.default"
        shadow="brutalist.2xl"
        // borderRadius="0"
        overflow="hidden"
      >
        {/* Header with violet background */}
        <Card.Header
          bg="primary.solid"
          color="fg.default"
          padding={3}
          // p={3}
          borderBottom="2px solid"
          borderColor="border.default"
        >
          <HStack justify="space-between" align="center">
            <VStack align="flex-start" padding={0}>
              <Heading
                size="xl"
                fontWeight="black"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                🎮 Game Lobbies
              </Heading>
              <Text fontSize="sm" fontWeight="bold" opacity={0.8}>
                {loading ? "Loading..." : `${lobbies.length} games available`}
              </Text>
            </VStack>

            <HStack padding={3}>


              {/* Create Lobby Button */}
              <Button
                onClick={onCreateLobby}
                bg="brutalist.green"
                // bg="violet.500"
                color="fg.inverted"
                fontWeight="black"
                fontSize="md"
                textTransform="uppercase"
                letterSpacing="wider"
                borderRadius="0"
                border="3px solid"
                borderColor="border.default"
                shadow="brutalist.md"
                px={6}
                py={3}
                _hover={{
                  bg: "#26C6B3",
                  transform: "translate(-2px, -2px)",
                  shadow: "brutalist.lg",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "brutalist.sm",
                }}
                transition="all 0.1s ease"
              >
                Create Lobby
              </Button>

              {/* Circular Refresh Button */}
              <IconButton
                onClick={onRefresh}
                bg="bg.default"
                color="fg.default"
                borderRadius="50%"
                border="3px solid"
                borderColor="border.default"
                shadow="brutalist.md"
                size="lg"
                _hover={{
                  transform: "translate(-2px, -2px)",
                  shadow: "brutalist.lg",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "brutalist.sm",
                }}
                transition="all 0.1s ease"
              >
                <RotateCcw size={20} />
              </IconButton>
            </HStack>
          </HStack>
        </Card.Header>

        {/* Content Area */}
        <Card.Body p={6}>
          {loading ? (
            <VStack padding={4} py={12}>
              <Text fontSize="xl" fontWeight="black" color="fg.default">
                🔄 Loading Games...
              </Text>
            </VStack>
          ) : lobbies.length === 0 ? (
            <VStack padding={6} py={12}>
              <Box
                bg="bg.muted"
                border="4px solid"
                borderColor="border.subtle"
                p={8}
                borderRadius="0"
                textAlign="center"
              >
                <VStack padding={4}>
                  <Trophy size={48} color="#9f7aea" />
                  <Heading size="lg" fontWeight="black" color="fg.default">
                    No Games Available
                  </Heading>
                  <Text color="fg.muted" fontWeight="bold">
                    Be the first to create a game!
                  </Text>
                </VStack>
              </Box>
            </VStack>
          ) : (
            <>
              {/* Lobbies Grid */}
              <Grid
                templateColumns={{
                  base: "repeat(1, 1fr)",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                  xl: "repeat(3, 1fr)",
                }}
                gap={6}
                mb={6}
              >
                {currentLobbies.map((lobby) => (
                  <LobbyCard
                    key={lobby.id}
                    lobby={lobby}
                    onJoin={handleJoinLobby}
                  />
                ))}
              </Grid>

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </Card.Body>
      </Card.Root>
    </Container>
  );
};

export default LobbyPending;