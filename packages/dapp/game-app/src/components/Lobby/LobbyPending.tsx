// components/Lobby/LobbyPending.tsx
import React from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Stack,
  Text,
  Badge,
  Icon,
  HStack,
  VStack,
} from '@chakra-ui/react';
import type { PendingLobby } from '../../types/lobby';
import { database } from '@/supabase/Database';

// Mock data for testing
const MOCK_PENDING_LOBBIES: PendingLobby[] = [
  {
    id: 1,
    name: "Lightning Round 1v1",
    tournament_id: null,
    status: 'waiting',
    max_players: 2,
    current_players: 1,
    stake_amount: "500000000", // 0.5 SOL
    created_by: 1,
    created_at: new Date(Date.now() - 300000).toISOString(), // 5 min ago
    disbanded_at: null,
    stake_amount_sol: 0.5,
    total_prize_pool_sol: 1.0,
    is_tournament: false,
    time_since_created: "5m ago",
    tournament: null,
    created_by_user: {
      id: 1,
      nickname: "SolanaGamer",
      solana_address: "8Kq2GVcjFJHXzgXgz8Vc2sPBJ9Nh1mK5rL3nQ7wT4sA2",
      matches_won: 15,
      matches_lost: 3,
      created_at: "",
      updated_at: ""
    }
  },
  {
    id: 2,
    name: null,
    tournament_id: 1,
    status: 'waiting',
    max_players: 8,
    current_players: 3,
    stake_amount: "1000000000", // 1 SOL
    created_by: 2,
    created_at: new Date(Date.now() - 180000).toISOString(), // 3 min ago
    disbanded_at: null,
    stake_amount_sol: 1.0,
    total_prize_pool_sol: 8.0,
    is_tournament: true,
    time_since_created: "3m ago",
    tournament: {
      id: 1,
      name: "Weekend Warriors Tournament",
      status: 'waiting',
      max_players: 8,
      current_players: 3,
      prize_pool: "8000000000",
      created_at: new Date(Date.now() - 180000).toISOString(),
      started_at: null,
      completed_at: null
    },
    created_by_user: {
      id: 2,
      nickname: null,
      solana_address: "9Lr3HWdkGKIYzgYh9Wd3tqQCK0Oi2nL6sM4oR8xU5tB3",
      matches_won: 8,
      matches_lost: 12,
      created_at: "",
      updated_at: ""
    }
  },
  {
    id: 3,
    name: "Quick Fire Duel",
    tournament_id: null,
    status: 'waiting',
    max_players: 2,
    current_players: 0,
    stake_amount: "250000000", // 0.25 SOL
    created_by: 3,
    created_at: new Date(Date.now() - 120000).toISOString(), // 2 min ago
    disbanded_at: null,
    stake_amount_sol: 0.25,
    total_prize_pool_sol: 0.5,
    is_tournament: false,
    time_since_created: "2m ago",
    tournament: null,
    created_by_user: {
      id: 3,
      nickname: "BlockchainBoss",
      solana_address: "7Mn4IXekHLJZzgZi0Xe4urRDL1Pj3oM7tN5pS9yV6uC4",
      matches_won: 22,
      matches_lost: 7,
      created_at: "",
      updated_at: ""
    }
  },
  {
    id: 4,
    name: null,
    tournament_id: 2,
    status: 'waiting',
    max_players: 4,
    current_players: 2,
    stake_amount: "750000000", // 0.75 SOL
    created_by: 4,
    created_at: new Date(Date.now() - 600000).toISOString(), // 10 min ago
    disbanded_at: null,
    stake_amount_sol: 0.75,
    total_prize_pool_sol: 3.0,
    is_tournament: true,
    time_since_created: "10m ago",
    tournament: {
      id: 2,
      name: "High Stakes Mini Tournament",
      status: 'waiting',
      max_players: 4,
      current_players: 2,
      prize_pool: "3000000000",
      created_at: new Date(Date.now() - 600000).toISOString(),
      started_at: null,
      completed_at: null
    },
    created_by_user: {
      id: 4,
      nickname: "DefiDragon",
      solana_address: "6Kp5JYflIMLAzg0j1Yf5vsSDM2Qk4pN8uO6qT0zW7vD5",
      matches_won: 45,
      matches_lost: 12,
      created_at: "",
      updated_at: ""
    }
  }
];

interface LobbyCardProps {
  lobby: PendingLobby;
  onJoin: (lobbyId: number) => void;
}

const LobbyCard: React.FC<LobbyCardProps> = ({ lobby, onJoin }) => {
  const getDisplayName = (user: any) => {
    if (!user) return 'Unknown';
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  };

  const getBorderColor = () => {
    if (lobby.is_tournament) {
      return lobby.current_players === 0 ? '#FF6B35' : '#7B2CBF'; // Orange for empty tournaments, purple for active
    }
    return lobby.current_players === 0 ? '#06D6A0' : '#118AB2'; // Green for empty 1v1, blue for active
  };

  const getBackgroundColor = () => {
    if (lobby.is_tournament) {
      return lobby.current_players === 0 ? '#FFF4E6' : '#F3E8FF'; // Light orange/purple
    }
    return lobby.current_players === 0 ? '#E6FFFA' : '#E0F4FF'; // Light green/blue
  };

  const isFull = lobby.current_players >= lobby.max_players;
  const isEmpty = lobby.current_players === 0;

  return (
    <Card.Root
      borderWidth="4px"
      borderStyle="solid"
      borderColor={getBorderColor()}
      bg={getBackgroundColor()}
      shadow="8px 8px 0px rgba(0,0,0,0.8)"
      borderRadius="0" // Sharp edges for neobrutalism
      transform="rotate(-0.5deg)"
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
              #{lobby.id} • {lobby.time_since_created}
            </Text>
          </VStack>

          <Box
            bg={isEmpty ? "#FF6B35" : isFull ? "#DC143C" : "#06D6A0"}
            color="white"
            px="2"
            py="1"
            fontSize="xs"
            fontWeight="black"
            borderRadius="0"
            transform="rotate(5deg)"
          >
            {isEmpty ? "EMPTY" : isFull ? "FULL" : "ACTIVE"}
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
          {lobby.is_tournament && lobby.tournament
            ? lobby.tournament.name
            : lobby.name || `${lobby.is_tournament ? 'Tournament' : '1v1'} Game #${lobby.id}`
          }
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
                TOTAL PRIZE
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
          onClick={() => onJoin(lobby.id)}
          disabled={isFull}
          size="lg"
          width="100%"
          bg={isFull ? "gray.400" : "#FF6B35"}
          color="white"
          fontWeight="black"
          fontSize="lg"
          textTransform="uppercase"
          letterSpacing="wider"
          borderRadius="0"
          border="3px solid"
          borderColor="gray.900"
          shadow="4px 4px 0px rgba(0,0,0,0.8)"
          _hover={!isFull ? {
            bg: "#E55A2B",
            transform: "translate(-2px, -2px)",
            shadow: "6px 6px 0px rgba(0,0,0,0.8)",
          } : {}}
          _active={!isFull ? {
            transform: "translate(0px, 0px)",
            shadow: "2px 2px 0px rgba(0,0,0,0.8)",
          } : {}}
          transition="all 0.1s ease"
        >
          {isFull ? "🔒 FULL" : "⚡ JOIN GAME"}
        </Button>
      </Card.Footer>
    </Card.Root>
  );
};

interface LobbyPendingProps {
  onJoinLobby?: (lobbyId: number) => void;
  useMockData?: boolean;
}

const LobbyPending: React.FC<LobbyPendingProps> = ({
  onJoinLobby = (id) => console.log(`Joining lobby ${id}`),
  useMockData = true
}) => {

  const [lobbies, setLobbies] = React.useState<PendingLobby[]>([]);


  const fetchLobies = async () => {
    try {
      const fetchedLobbies = await database.lobbies.getAll();
      setLobbies(fetchedLobbies);
    } catch (error) {
      console.error("Error fetching lobbies:", error);
      setLobbies([]);
    }
  };


  React.useEffect(() => {
    if (useMockData) {
      setLobbies(MOCK_PENDING_LOBBIES);
    } else {
      fetchLobies();
    }
  }, [useMockData]);

  const handleJoinLobby = (lobbyId: number) => {
    onJoinLobby(lobbyId);
    // TODO
    // In real implementation, this would make an API call
    console.log(`Attempting to join lobby ${lobbyId}`);
  };

  if (lobbies.length === 0) {
    return (
      <Box
        textAlign="center"
        p="12"
        bg="gray.50"
        border="4px solid"
        borderColor="gray.300"
        borderRadius="0"
      >
        <Text fontSize="2xl" fontWeight="black" color="gray.400" mb="2">
          NO PENDING GAMES
        </Text>
        <Text fontSize="md" color="gray.600">
          Be the first to create a game!
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
        transform="rotate(1deg)"
        shadow="8px 8px 0px rgba(0,0,0,0.3)"
      >
        <Heading
          size="xl"
          fontWeight="black"
          textTransform="uppercase"
          letterSpacing="wider"
          textAlign="center"
        >
          🎮 PENDING GAMES
        </Heading>
        <Text textAlign="center" fontSize="sm" mt="2" opacity="0.8">
          {lobbies.length} games waiting for players
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
            onJoin={handleJoinLobby}
          />
        ))}
      </Grid>
    </Box>
  );
};

export default LobbyPending;