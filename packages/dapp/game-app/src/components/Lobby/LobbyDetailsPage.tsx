// packages/dapp/game-app/src/components/Lobby/LobbyDetailsPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Spinner,
  Button,
  Tag,
  Flex,
  Badge,
  Container,
} from '@chakra-ui/react';
import { database } from '@/supabase/Database';
import type { PendingLobby } from '@/types/lobby';
import { ChevronLeft } from 'lucide-react';
import { toaster } from '../ui/toaster';

const LobbyDetailsPage: React.FC = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>(); // Get lobbyId from URL parameters
  const navigate = useNavigate();
  const [lobby, setLobby] = useState<PendingLobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLobbyDetails = async () => {
      if (!lobbyId) {
        setError('Lobby ID not found in URL.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const id = parseInt(lobbyId, 10);
        if (isNaN(id)) {
          setError('Invalid Lobby ID.');
          setLoading(false);
          return;
        }
        const fetchedLobby = await database.lobbies.getById(id);
        if (fetchedLobby) {
          setLobby(fetchedLobby);
        } else {
          setError('Lobby not found.');
        }
      } catch (err) {
        console.error('Error fetching lobby details:', err);
        setError('Failed to load lobby details.');
      } finally {
        setLoading(false);
      }
    };

    fetchLobbyDetails();
  }, [lobbyId]);

  const getDisplayName = (user: any) => {
    if (!user) return 'Unknown';
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  };

  if (loading) {
    return (
      <VStack padding={8} justifyContent="center" minH="50vh">
        <Spinner size="xl" color="purple.500" />
        <Text fontSize="lg" fontWeight="bold" color="gray.600">Loading lobby details...</Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <VStack padding={8} justifyContent="center" minH="50vh">
        <Heading size="lg" color="red.500">Error</Heading>
        <Text fontSize="md" color="gray.700">{error}</Text>
        <Button onClick={() => navigate('/')} mt="4" bg="blue.500" color="white" _hover={{ bg: "blue.600" }}>
          Go to Home
        </Button>
      </VStack>
    );
  }

  if (!lobby) {
    return (
      <VStack padding={8} justifyContent="center" minH="50vh">
        <Heading size="lg" color="gray.500">Lobby Not Found</Heading>
        <Text fontSize="md" color="gray.700">The lobby you are looking for does not exist or has been removed.</Text>
        <Button onClick={() => navigate('/')} mt="4" bg="blue.500" color="white" _hover={{ bg: "blue.600" }}>
          Go to Home
        </Button>
      </VStack>
    );
  }

  return (
    <Container maxW="container.md" p="6" bg="white" borderRadius="0" shadow="lg" border="4px solid black">
      {/* Back Button */}
      <Button
        onClick={() => navigate(-1)} // Go back to the previous page
        lefticon={<ChevronLeft size={20} />}
        mb="6"
        bg="gray.700"
        color="white"
        fontWeight="black"
        _hover={{ bg: "gray.600" }}
        borderRadius="0"
        shadow="md"
      >
        Go Back
      </Button>

      {/* Lobby Header */}
      <Box
        bg="gray.900"
        color="white"
        p="6"
        mb="6"
        transform="rotate(-0.5deg)"
        shadow="8px 8px 0px rgba(0,0,0,0.3)"
      >
        <Flex justify="space-between" align="flex-start" mb="2">
          <Heading
            size="xl"
            fontWeight="black"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            {lobby.name || `Game #${lobby.id}`}
          </Heading>
          <Badge
            variant="solid"
            bg={lobby.is_tournament ? "#7B2CBF" : "#118AB2"}
            color="white"
            fontSize="sm"
            fontWeight="black"
            px="3"
            py="1"
            borderRadius="0"
            textTransform="uppercase"
            letterSpacing="wider"
            transform="rotate(5deg)"
          >
            {lobby.is_tournament ? '🏆 TOURNAMENT' : '⚔️ 1v1 DUEL'}
          </Badge>
        </Flex>
        <Text fontSize="md" opacity="0.8">
          Created by: {getDisplayName(lobby.created_by_user)} on {new Date(lobby.created_at).toLocaleString()}
        </Text>
      </Box>

      <VStack padding="4" align="stretch" px="4">
        {/* Status and Players */}
        <HStack justify="space-between" p="4" bg="gray.50" border="2px solid gray.200" borderRadius="0">
          <Text fontSize="lg" fontWeight="bold" color="gray.800">Status:</Text>
          <Badge
            bg={
              lobby.status === 'waiting'
                ? "#06D6A0"
                : lobby.status === 'closed'
                ? "#DC143C"
                : lobby.status === 'starting'
                ? "#FF6B35"
                : "#118AB2"
            }
            color="white"
            fontSize="lg"
            fontWeight="black"
            px="4"
            py="2"
            borderRadius="0"
            textTransform="uppercase"
          >
            {lobby.status}
          </Badge>
        </HStack>

        <HStack justify="space-between" p="4" bg="gray.50" border="2px solid gray.200" borderRadius="0">
          <Text fontSize="lg" fontWeight="bold" color="gray.800">Players:</Text>
          <Text fontSize="lg" fontWeight="black" color="gray.900">
            {lobby.current_players} / {lobby.max_players}
          </Text>
        </HStack>

        {/* Stake and Pot */}
        <HStack justify="space-between" p="4" bg="yellow.50" border="2px solid yellow.200" borderRadius="0">
          <Text fontSize="lg" fontWeight="bold" color="yellow.800">Stake Amount:</Text>
          <Text fontSize="lg" fontWeight="black" color="yellow.900">
            {lobby.stake_amount_sol} SOL
          </Text>
        </HStack>

        <HStack justify="space-between" p="4" bg="yellow.50" border="2px solid yellow.200" borderRadius="0">
          <Text fontSize="lg" fontWeight="bold" color="yellow.800">Total Prize Pool:</Text>
          <Text fontSize="lg" fontWeight="black" color="yellow.900">
            {lobby.total_prize_pool_sol} SOL
          </Text>
        </HStack>

        {/* Other Details */}
        <HStack justify="space-between" p="4" bg="gray.50" border="2px solid gray.200" borderRadius="0">
          <Text fontSize="lg" fontWeight="bold" color="gray.800">Minimum Players:</Text>
          <Text fontSize="lg" fontWeight="black" color="gray.900">{lobby.min_players}</Text>
        </HStack>

        <HStack justify="space-between" p="4" bg="gray.50" border="2px solid gray.200" borderRadius="0">
          <Text fontSize="lg" fontWeight="bold" color="gray.800">Max Rounds:</Text>
          <Text fontSize="lg" fontWeight="black" color="gray.900">{lobby.max_rounds}</Text>
        </HStack>

        {/* Optional: Add a join button if lobby status is 'waiting' and user hasn't joined */}
        {/* {lobby.status === 'waiting' && (
          <Button
            mt="6"
            size="lg"
            width="100%"
            bg="#06D6A0"
            color="white"
            fontWeight="black"
            fontSize="xl"
            textTransform="uppercase"
            letterSpacing="wider"
            borderRadius="0"
            border="3px solid"
            borderColor="gray.900"
            shadow="4px 4px 0px rgba(0,0,0,0.8)"
            _hover={{ bg: "#04C28D", transform: "translate(-2px, -2px)", shadow: "6px 6px 0px rgba(0,0,0,0.8)" }}
            _active={{ transform: "translate(0px, 0px)", shadow: "2px 2px 0px rgba(0,0,0,0.8)" }}
            onClick={() => toaster.create({
              title: "Feature Coming Soon",
              description: "Joining from details page will be implemented later.",
              type: "info"
            })}
          >
            JOIN LOBBY
          </Button>
        )} */}
      </VStack>
    </Container>
  );
};

export default LobbyDetailsPage;