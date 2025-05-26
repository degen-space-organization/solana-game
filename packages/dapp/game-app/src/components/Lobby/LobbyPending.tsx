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
    // if (useMockData) {
    //   setLobbies(MOCK_PENDING_LOBBIES);
    // } else {
    //   fetchLobies();
    // }
      fetchLobies();
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