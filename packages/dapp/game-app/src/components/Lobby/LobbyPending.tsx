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
  Stack,
} from '@chakra-ui/react';
import { ChevronLeft, ChevronRight, Users, Trophy, Swords, RotateCcw, AlertCircle } from 'lucide-react';
import type { PendingLobby } from '../../types/lobby';
import { database } from '@/supabase/Database';
import { useWallet } from '@solana/wallet-adapter-react';
import apiUrl from '@/api/config';

// Pagination Component - Mobile Responsive
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface LobbyCardProps {
  lobby: PendingLobby;
  onJoin: (lobbyId: number) => void;
  isUserInLobby: boolean;
  isLoading?: boolean;
}

interface LobbyPendingProps {
  onJoinLobby?: (lobbyId: number) => void;
  useMockData?: boolean;
  refreshTrigger?: number;
  onCreateLobby?: () => void;
  onRefresh?: () => void;
}



const LobbyCard: React.FC<LobbyCardProps> = ({ lobby, onJoin, isUserInLobby, isLoading = false }) => {
  const getDisplayName = (user: any) => {
    if (!user) return 'Unknown';
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  };

  const isTournament = lobby.tournament_id !== null;
  const isFull = lobby.current_players >= lobby.max_players;
  const isEmpty = lobby.current_players === 0;
  const isJoinDisabled = isFull || isUserInLobby || isLoading;

  const getJoinButtonText = () => {
    if (isLoading) return "🔄 Loading...";
    if (isFull) return "🔒 FULL";
    if (isUserInLobby) return "⚠️ Already in Lobby";
    return "⚡ JOIN GAME";
  };

  const getJoinButtonBg = () => {
    if (isJoinDisabled) return "bg.muted";
    return "brutalist.green";
  };

  const getJoinButtonColor = () => {
    if (isJoinDisabled) return "fg.muted";
    return "fg.inverted";
  };

  return (
    <Card.Root
      borderWidth="2px"
      borderStyle="solid"
      borderColor="border.default"
      bg={isTournament? "lobbies.tournament" : "lobbies.duel"}
      shadow="brutalist.lg"
      borderRadius="0"
      _hover={{
        shadow: "brutalist.xl",
      }}
      transition="all 0.2s ease"
      h="100%"
      maxW="100%"
      overflow="hidden"
    >
      <Card.Body p={{ base: 4, md: 6 }}>
        {/* Header - Mobile Responsive */}
        <VStack align="flex-start" padding={0} mb={4}>
          <Stack
            direction={{ base: "column", sm: "row" }}
            justify="space-between"
            align={{ base: "flex-start", sm: "center" }}
            w="100%"
            padding={2}
          >
            <Badge
              bg={lobby.is_tournament ? "brutalist.purple" : "brutalist.blue"}
              color="fg.inverted"
              fontSize={{ base: "xs", md: "xs" }}
              fontWeight="black"
              px={3}
              py={1}
              borderRadius="0"
              textTransform="uppercase"
              letterSpacing="wider"
              border="2px solid"
              borderColor="border.default"
              flexShrink={0}
            >
              <HStack padding={0}>
                {lobby.is_tournament ? <Trophy size={12} /> : <Swords size={12} />}
                <Text display={{ base: "none", sm: "block" }}>
                  {lobby.is_tournament ? "TOURNAMENT" : "1v1 DUEL"}
                </Text>
              </HStack>
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
              flexShrink={0}
            >
              {isEmpty ? "EMPTY" : isFull ? "FULL" : "ACTIVE"}
            </Badge>
          </Stack>

          <Heading
            size={{ base: "sm", md: "md" }}
            fontWeight="black"
            color="fg.default"
            textTransform="uppercase"
            letterSpacing="tight"
            lineHeight="1.2"
            // noOfLines={2}
            wordBreak="break-word"
          >
            {lobby.name || `Game #${lobby.id}`}
          </Heading>
        </VStack>

        {/* Players Info - Mobile Optimized */}
        <Box
          bg="bg.subtle"
          border="3px solid"
          borderColor="border.default"
          p={{ base: 3, md: 4 }}
          mb={4}
          borderRadius="0"
        >
          <Stack
            direction={{ base: "column", sm: "row" }}
            justify="space-between"
            align={{ base: "flex-start", sm: "center" }}
            mb={2}
            padding={2}
          >
            <HStack padding={0}>
              <Users size={16} />
              <Text fontSize="sm" fontWeight="bold" color="fg.default">
                PLAYERS
              </Text>
            </HStack>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              fontWeight="black"
              color={isFull ? "error" : "success"}
            >
              {lobby.current_players}/{lobby.max_players}
            </Text>
          </Stack>

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

        {/* Stake Info - Mobile Responsive Grid */}
        <Box
          bg="brutalist.yellow"
          border="3px solid"
          borderColor="border.default"
          p={{ base: 3, md: 4 }}
          mb={4}
          borderRadius="0"
          color="fg.default"
        >
          <Grid
            templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
            gap={{ base: 3, sm: 2 }}
          >
            <VStack align="flex-start" padding={1}>
              <Text fontSize="xs" fontWeight="black">
                STAKE
              </Text>
              <Text fontSize={{ base: "md", md: "lg" }} fontWeight="black">
                {lobby.stake_amount_sol} SOL
              </Text>
            </VStack>
            <VStack align={{ base: "flex-start", sm: "flex-end" }} padding={1}>
              <Text fontSize="xs" fontWeight="black">
                PRIZE
              </Text>
              <Text fontSize={{ base: "md", md: "lg" }} fontWeight="black">
                {lobby.total_prize_pool_sol} SOL
              </Text>
            </VStack>
          </Grid>
        </Box>
      </Card.Body>

      <Card.Footer p={{ base: 4, md: 6 }} pt={0}>
        <Button
          onClick={() => !isJoinDisabled && onJoin(lobby.id)}
          disabled={isJoinDisabled}
          size={{ base: "md", md: "lg" }}
          width="100%"
          bg={getJoinButtonBg()}
          color={getJoinButtonColor()}
          fontWeight="black"
          fontSize={{ base: "sm", md: "md" }}
          textTransform="uppercase"
          letterSpacing="wider"
          borderRadius="0"
          border="3px solid"
          borderColor="border.default"
          shadow="brutalist.md"
          _hover={!isJoinDisabled ? {
            bg: "#26C6B3",
            transform: "translate(-2px, -2px)",
            shadow: "brutalist.lg",
          } : {}}
          _active={!isJoinDisabled ? {
            transform: "translate(0px, 0px)",
            shadow: "brutalist.sm",
          } : {}}
          transition="all 0.1s ease"
          minH={{ base: "44px", md: "auto" }}
        >
          {getJoinButtonText()}
        </Button>
      </Card.Footer>
    </Card.Root>
  );
};



const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const isMobile = useBreakpointValue({ base: true, md: false });
  const maxVisiblePages = isMobile ? 3 : 5;

  const getPageNumbers = () => {
    const pages = [];
    const showPages = maxVisiblePages;

    let start = Math.max(1, currentPage - Math.floor(showPages / 2));
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
    <HStack justify="center" padding={2} mt={8} flexWrap="wrap">
      <IconButton
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        bg={currentPage === 1 ? "bg.muted" : "brutalist.blue"}
        color={currentPage === 1 ? "fg.muted" : "fg.inverted"}
        borderRadius="0"
        border="3px solid"
        borderColor="border.default"
        shadow="brutalist.sm"
        size={{ base: "sm", md: "md" }}
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
          size={{ base: "sm", md: "sm" }}
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
          minW={{ base: "36px", md: "40px" }}
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
        size={{ base: "sm", md: "md" }}
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



const LobbyPending: React.FC<LobbyPendingProps> = ({
  onJoinLobby = (id) => console.log(`Joining lobby ${id}`),
  refreshTrigger = 0,
  onCreateLobby,
  onRefresh
}) => {
  const [lobbies, setLobbies] = useState<PendingLobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isUserInLobby, setIsUserInLobby] = useState(false);
  const [checkingUserStatus, setCheckingUserStatus] = useState(false);
  const { publicKey } = useWallet();

  // Responsive items per page
  const itemsPerPage = useBreakpointValue({
    base: 1,  // Mobile: 1 item for better readability
    sm: 2,    // Small: 2 items  
    md: 4,    // Tablet: 4 items  
    lg: 6,    // Desktop: 6 items
    xl: 9     // Large desktop: 9 items
  }) || 6;

  // Check if user is already in a lobby
  const checkUserLobbyStatus = async () => {
    if (!publicKey) {
      setIsUserInLobby(false);
      return;
    }

    setCheckingUserStatus(true);
    try {
      const isInGame = await database.games.isInLobby(publicKey.toBase58());
      setIsUserInLobby(isInGame);
    } catch (error) {
      console.error("Error checking user lobby status:", error);
      setIsUserInLobby(false);
    } finally {
      setCheckingUserStatus(false);
    }
  };

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
    checkUserLobbyStatus();
  }, [refreshTrigger, publicKey]);

  const handleJoinLobby = async (lobbyId: number) => {
    if (isUserInLobby) return;

    onJoinLobby(lobbyId);

    if (!publicKey) return;

    const userId = await database.users.getByWallet(publicKey.toBase58());

    const response = await fetch(`${apiUrl}/game/join-lobby`, {
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

    // Refresh user status after joining
    checkUserLobbyStatus();
  };

  const handleCreateLobby = () => {
    if (isUserInLobby) return;
    if (onCreateLobby) {
      onCreateLobby();
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
    checkUserLobbyStatus();
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

  const getCreateButtonText = () => {
    if (checkingUserStatus) return "Checking...";
    if (isUserInLobby) return "Already in Lobby";
    return "Create Lobby";
  };

  const getCreateButtonBg = () => {
    if (checkingUserStatus || isUserInLobby) return "bg.muted";
    return "brutalist.green";
  };

  const getCreateButtonColor = () => {
    if (checkingUserStatus || isUserInLobby) return "fg.muted";
    return "fg.inverted";
  };

  return (
    <Container maxW="100%" px={{ base: 2, md: 4 }}>
      {/* Main Container following leaderboard pattern */}
      <Card.Root
        borderWidth="2px"
        borderStyle="solid"
        borderColor="border.default"
        bg="bg.default"
        shadow="brutalist.xl"
        borderRadius="0"
        overflow="hidden"
      >
        {/* Header with violet background - Mobile Responsive */}
        <Card.Header
          bg="primary.solid"
          color="fg.default"
          p={{ base: 4, md: 4 }}
          borderBottom="4px solid"
          borderColor="border.default"
        >
          <Stack
            direction={{ base: "column", lg: "row" }}
            justify="space-between"
            align={{ base: "flex-start", lg: "center" }}
            padding={4}
          >
            <VStack align="flex-start" padding={1}>
              <Heading
                size={{ base: "lg", md: "xl" }}
                fontWeight="black"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                🎮 Game Lobbies
              </Heading>
              <Text fontSize="sm" fontWeight="bold" opacity={0.8}>
                {loading ? "Loading..." : `${lobbies.length} games available`}
              </Text>
              {isUserInLobby && (
                <HStack padding={2} mt={2}>
                  <AlertCircle size={16} />
                  <Text fontSize="xs" fontWeight="bold" opacity={0.9}>
                    You're currently in a game. Navigate to "🤝 MY LOBBY"
                  </Text>
                </HStack>
              )}
            </VStack>

            <HStack padding={3} flexWrap={{ base: "wrap", sm: "nowrap" }}>
              {/* Create Lobby Button */}
              <Button
                onClick={handleCreateLobby}
                disabled={isUserInLobby || checkingUserStatus}
                bg={getCreateButtonBg()}
                color={getCreateButtonColor()}
                fontWeight="black"
                fontSize={{ base: "sm", md: "md" }}
                textTransform="uppercase"
                letterSpacing="wider"
                borderRadius="0"
                border="3px solid"
                borderColor="border.default"
                shadow="brutalist.md"
                px={{ base: 4, md: 6 }}
                py={3}
                _hover={!isUserInLobby && !checkingUserStatus ? {
                  bg: "#26C6B3",
                  transform: "translate(-2px, -2px)",
                  shadow: "brutalist.lg",
                } : {}}
                _active={!isUserInLobby && !checkingUserStatus ? {
                  transform: "translate(0px, 0px)",
                  shadow: "brutalist.sm",
                } : {}}
                transition="all 0.1s ease"
              >
                {getCreateButtonText()}
              </Button>

              {/* Circular Refresh Button */}
              <IconButton
                onClick={handleRefresh}
                bg="bg.default"
                color="fg.default"
                borderRadius="50%"
                border="3px solid"
                borderColor="border.default"
                shadow="brutalist.md"
                size={{ base: "md", md: "lg" }}
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
          </Stack>
        </Card.Header>

        {/* Content Area */}
        <Card.Body p={{ base: 4, md: 6 }}>
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
              {/* Lobbies Grid - Mobile Responsive */}
              <Grid
                templateColumns={{
                  base: "repeat(1, 1fr)",     // Mobile: 1 column
                  sm: "repeat(2, 1fr)",       // Small: 2 columns
                  md: "repeat(2, 1fr)",       // Medium: 2 columns
                  lg: "repeat(3, 1fr)",       // Large: 3 columns
                  xl: "repeat(3, 1fr)",       // XL: 3 columns
                }}
                gap={{ base: 4, md: 6 }}
                mb={6}
              >
                {currentLobbies.map((lobby) => (
                  <LobbyCard
                    key={lobby.id}
                    lobby={lobby}
                    onJoin={handleJoinLobby}
                    isUserInLobby={isUserInLobby}
                    isLoading={checkingUserStatus}
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