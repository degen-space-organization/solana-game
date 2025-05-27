// packages/dapp/game-app/src/components/Lobby/LobbyJoined.tsx
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Text,
  Badge,
  HStack,
  VStack,
  Spinner,
} from '@chakra-ui/react';
import type { PendingLobby, User } from '../../types/lobby';
import { database } from '@/supabase/Database';
import { useWallet } from '@solana/wallet-adapter-react';

interface LobbyCardProps {
  lobby: PendingLobby;
  onViewDetails: (lobbyId: number) => void;
}

const LobbyCard: React.FC<LobbyCardProps> = ({ lobby, onViewDetails }) => {
  const getDisplayName = (user: any) => {
    if (!user) return 'Unknown';
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  };

  const getBorderColor = () => {
    if (lobby.is_tournament) {
      return '#7B2CBF'; // Purple for tournaments
    }
    // Determine 1v1 lobby color based on status
    if (lobby.status === 'closed') return '#DC143C'; // Red for closed 1v1
    if (lobby.status === 'starting') return '#FF6B35'; // Orange for starting 1v1
    return '#118AB2'; // Blue for active/waiting 1v1
  };

  const getBackgroundColor = () => {
    if (lobby.is_tournament) {
      return '#F3E8FF'; // Light purple for tournaments
    }
    // Determine 1v1 lobby background based on status
    if (lobby.status === 'closed') return '#FFEBEE'; // Light red for closed
    if (lobby.status === 'starting') return '#FFF4E6'; // Light orange for starting
    return '#E0F4FF'; // Light blue for active/waiting
  };

  return (
    <Card.Root
      borderWidth="4px"
      borderStyle="solid"
      borderColor={getBorderColor()}
      bg={getBackgroundColor()}
      shadow="8px 8px 0px rgba(0,0,0,0.8)"
      borderRadius="0"
      transform="rotate(0.5deg)"
      _hover={{
        transform: "rotate(0deg) scale(1.02)",
        shadow: "12px 12px 0px rgba(0,0,0,0.8)",
      }}
      transition="all 0.2s ease"
      position="relative"
    >
      <Card.Body p="6">
        {/* Header */}
        <Flex justify="space-between" align="flex-start" mb="4">
          <VStack align="flex-start" padding="1">
            <Badge
              variant="solid"
              bg={lobby.is_tournament ? "#7B2CBF" : "#118AB2"}
              color="white"
              fontSize="xs"
              fontWeight="black"
              px="3"
              py="1"
              borderRadius="0"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              {lobby.is_tournament ? '🏆 TOURNAMENT' : '⚔️ 1v1 DUEL'}
            </Badge>
            <Text fontSize="xs" fontWeight="bold" color="gray.600">
              #{lobby.id} • {new Date(lobby.created_at).toLocaleDateString()}
            </Text>
          </VStack>

          <Box
            bg={
              lobby.status === 'waiting'
                ? "#06D6A0" // Green for waiting
                : lobby.status === 'closed'
                ? "#DC143C" // Red for closed
                : lobby.status === 'starting'
                ? "#FF6B35" // Orange for starting
                : "#118AB2" // Blue for other statuses like active/in_progress (matches)
            }
            color="white"
            px="2"
            py="1"
            fontSize="xs"
            fontWeight="black"
            borderRadius="0"
            transform="rotate(5deg)"
          >
            {lobby.status.toUpperCase()}
          </Box>
        </Flex>

        {/* Title */}
        <Heading
          size="md"
          fontWeight="black"
          color="gray.900"
          mb="3"
          textTransform="uppercase"
          letterSpacing="tight"
        >
          {lobby.name || `${lobby.is_tournament ? 'Tournament' : '1v1'} Game #${lobby.id}`}
        </Heading>

        {/* Players Info */}
        <Box
          bg="white"
          border="3px solid"
          borderColor="gray.900"
          p="3"
          mb="4"
          position="relative"
        >
          <HStack justify="space-between" mb="2">
            <Text fontSize="sm" fontWeight="bold" color="gray.700">
              PLAYERS
            </Text>
            <Text
              fontSize="lg"
              fontWeight="black"
              color={lobby.current_players === lobby.max_players ? "#DC143C" : "#06D6A0"}
            >
              {lobby.current_players}/{lobby.max_players}
            </Text>
          </HStack>

          {/* Progress Bar */}
          <Box bg="gray.200" h="3" borderRadius="0" overflow="hidden">
            <Box
              bg={lobby.current_players === lobby.max_players ? "#DC143C" : "#06D6A0"}
              h="100%"
              w={`${(lobby.current_players / lobby.max_players) * 100}%`}
              transition="width 0.3s ease"
            />
          </Box>
        </Box>

        {/* Stake Info */}
        <Box
          bg="yellow.100"
          border="3px solid"
          borderColor="yellow.600"
          p="3"
          mb="4"
        >
          <HStack justify="space-between">
            <VStack align="flex-start" padding="0">
              <Text fontSize="xs" fontWeight="bold" color="yellow.800">
                STAKE AMOUNT
              </Text>
              <Text fontSize="lg" fontWeight="black" color="yellow.900">
                {lobby.stake_amount_sol} SOL
              </Text>
            </VStack>
            <VStack align="flex-end" padding="0">
              <Text fontSize="xs" fontWeight="bold" color="yellow.800">
                TOTAL POT
              </Text>
              <Text fontSize="lg" fontWeight="black" color="yellow.900">
                {lobby.total_prize_pool_sol} SOL
              </Text>
            </VStack>
          </HStack>
        </Box>

        {/* Creator Info */}
        <Box mb="4">
          <Text fontSize="xs" fontWeight="bold" color="gray.600" mb="1">
            CREATED BY
          </Text>
          <HStack>
            <Text fontSize="sm" fontWeight="bold" color="gray.900">
              {getDisplayName(lobby.created_by_user)}
            </Text>
            {lobby.created_by_user && (
              <Text fontSize="xs" color="gray.600">
                ({lobby.created_by_user.matches_won}W-{lobby.created_by_user.matches_lost}L)
              </Text>
            )}
          </HStack>
        </Box>
      </Card.Body>

      <Card.Footer p="6" pt="0">
        <Button
          onClick={() => onViewDetails(lobby.id)}
          size="lg"
          width="100%"
          bg={lobby.status === 'closed' || lobby.status === 'disbanded' ? "gray.400" : "#06D6A0"}
          color="white"
          fontWeight="black"
          fontSize="lg"
          textTransform="uppercase"
          letterSpacing="wider"
          borderRadius="0"
          border="3px solid"
          borderColor="gray.900"
          shadow="4px 4px 0px rgba(0,0,0,0.8)"
          _hover={lobby.status === 'closed' || lobby.status === 'disbanded' ? {} : {
            bg: "#04C28D",
            transform: "translate(-2px, -2px)",
            shadow: "6px 6px 0px rgba(0,0,0,0.8)",
          }}
          _active={lobby.status === 'closed' || lobby.status === 'disbanded' ? {} : {
            transform: "translate(0px, 0px)",
            shadow: "2px 2px 0px rgba(0,0,0,0.8)",
          }}
          transition="all 0.1s ease"
        >
          {lobby.status === 'closed' ? "VIEW RESULTS" : "VIEW DETAILS"}
        </Button>
      </Card.Footer>
    </Card.Root>
  );
};

interface LobbyJoinedProps {
  onViewLobbyDetails?: (lobbyId: number) => void;
  currentUser: User | null;
}

const LobbyJoined: React.FC<LobbyJoinedProps> = ({
  onViewLobbyDetails = (id) => console.log(`Viewing details for joined lobby ${id}`),
  currentUser
}) => {
  const [lobbies, setLobbies] = useState<PendingLobby[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJoinedLobbies = async () => {
    if (!currentUser) {
      setLobbies([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fetchedLobbies = await database.lobbies.getJoined(currentUser.id);
      setLobbies(fetchedLobbies);
    } catch (error) {
      console.error("Error fetching joined lobbies:", error);
      setLobbies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJoinedLobbies();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <Box
        textAlign="center"
        p="12"
        bg="gray.50"
        border="4px solid"
        borderColor="gray.300"
        borderRadius="0"
        shadow="md"
      >
        <Text fontSize="xl" fontWeight="black" color="gray.500" mb="2">
          Connect Wallet to See Joined Lobbies
        </Text>
        <Text fontSize="md" color="gray.600">
          Your active and past game lobbies will appear here once connected.
        </Text>
      </Box>
    );
  }

  if (loading) {
    return (
      <VStack padding={4} p={6}>
        <Spinner color="purple.500" />
        <Text fontWeight="bold" color="gray.600">Loading your lobbies...</Text>
      </VStack>
    );
  }

  if (lobbies.length === 0) {
    return (
      <Box
        textAlign="center"
        p="12"
        bg="gray.50"
        border="4px solid"
        borderColor="gray.300"
        borderRadius="0"
        shadow="md"
      >
        <Text fontSize="2xl" fontWeight="black" color="gray.400" mb="2">
          NO JOINED GAMES
        </Text>
        <Text fontSize="md" color="gray.600">
          You haven't joined any lobbies yet. Head to "Pending Games" to find one!
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        bg="gray.900"
        color="white"
        p="6"
        mb="6"
        transform="rotate(-1deg)"
        shadow="8px 8px 0px rgba(0,0,0,0.3)"
      >
        <Heading
          size="xl"
          fontWeight="black"
          textTransform="uppercase"
          letterSpacing="wider"
          textAlign="center"
        >
          🔥 YOUR JOINED GAMES
        </Heading>
        <Text textAlign="center" fontSize="sm" mt="2" opacity="0.8">
          {lobbies.length} games you've joined (active or past)
        </Text>
      </Box>

      {/* Lobbies Grid */}
      <Grid
        templateColumns={{
          base: "1fr",
          md: "repeat(2, 1fr)",
          lg: "repeat(3, 1fr)"
        }}
        gap="6"
        px="4"
      >
        {lobbies.map((lobby) => (
          <LobbyCard
            key={lobby.id}
            lobby={lobby}
            onViewDetails={onViewLobbyDetails}
          />
        ))}
      </Grid>
    </Box>
  );
};

export default LobbyJoined;