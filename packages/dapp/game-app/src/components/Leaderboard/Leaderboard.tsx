// packages/dapp/game-app/src/components/Leaderboard/Leaderboard.tsx
import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Spinner,
  Avatar,
  Button, // Ensure Button is imported
  Badge,  // Ensure Badge is imported
} from '@chakra-ui/react';
import { Crown, RefreshCw } from 'lucide-react';
import { database } from '@/supabase/Database';
import type { User } from '@/types/lobby';

const Leaderboard: React.FC = () => {
  const [players, setPlayers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedUsers: User[] = await database.users.getAll();
      const sortedPlayers = [...fetchedUsers].sort((a, b) => {
        const winsA = a.matches_won ?? 0;
        const winsB = b.matches_won ?? 0;
        return winsB - winsA;
      });
      setPlayers(sortedPlayers);
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

  const getDisplayName = (user: User): string => {
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  };

  if (loading) {
    return (
      <VStack padding={4} p={6}>
        <Spinner color="purple.500" size="xl" />
        <Text fontWeight="bold" color="gray.600">Loading Leaderboard...</Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <Box
        borderWidth="4px"
        borderStyle="solid"
        borderColor="red.500"
        bg="red.50"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="8"
        textAlign="center"
      >
        <Heading size="lg" color="red.600" fontWeight="black" textTransform="uppercase">
          ⚠️ ERROR
        </Heading>
        <Text fontSize="md" color="red.500" mb="4">{error}</Text>
        <Button
          onClick={fetchLeaderboard}
          bg="red.500"
          color="white"
          fontWeight="bold"
          borderRadius="0"
          border="3px solid"
          borderColor="gray.900"
          shadow="4px 4px 0px rgba(0,0,0,0.8)"
          _hover={{ bg: "red.600", transform: "translate(-2px, -2px)", shadow: "6px 6px 0px rgba(0,0,0,0.8)" }}
        >
          <RefreshCw size={16} />
          <Text ml="2">Retry</Text>
        </Button>
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
          👑 WINNERS LEADERBOARD
        </Heading>
        <Text textAlign="center" fontSize="sm" mt="2" opacity="0.8">
          Top players ranked by wins
        </Text>
      </Box>

      {/* Leaderboard Table (simulated with Box and HStack) */}
      {players.length === 0 ? (
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
            NO PLAYERS YET
          </Text>
          <Text fontSize="md" color="gray.600">
            Be the first to play and get on the leaderboard!
          </Text>
        </Box>
      ) : (
        <Box
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="white"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="4"
          overflowX="auto"
        >
          {/* Table Header */}
          <HStack
            bg="gray.100"
            py="3"
            px="4"
            padding="0"
            borderBottom="2px solid"
            borderColor="gray.200"
            fontWeight="medium"
            textTransform="uppercase"
            fontSize="xs"
            color="gray.600"
            display={{ base: 'flex', md: 'grid' }}
            gridTemplateColumns="0.5fr 2fr 1fr 1fr"
            alignItems="center"
          >
            <Text>RANK</Text>
            <Text textAlign="left">PLAYER</Text>
            <Text textAlign="right">WINS</Text>
            <Text textAlign="right">LOSSES</Text>
          </HStack>

          {/* Table Body */}
          <VStack padding="0" align="stretch">
            {players.map((player, index) => (
              <HStack
                key={player.id}
                py="3"
                px="4"
                padding="0"
                bg={index % 2 === 0 ? 'white' : 'gray.50'}
                borderTop="2px solid"
                borderColor="gray.200"
                display={{ base: 'flex', md: 'grid' }}
                gridTemplateColumns="0.5fr 2fr 1fr 1fr"
                alignItems="center"
              >
                <HStack>
                  <Text fontWeight="black" fontSize="lg" color="gray.800">
                    {index + 1}.
                  </Text>
                  {index === 0 && <Crown size={20} color="#FFD700" />}
                </HStack>
                <HStack>
                  {/* <Avatar size="sm" name={player.nickname || player.solana_address} /> */}
                  <VStack align="flex-start" padding="0">
                    <Text fontWeight="bold" color="gray.900">{getDisplayName(player)}</Text>
                    <Text fontSize="xs" color="gray.600">{player.solana_address.slice(0, 6)}...{player.solana_address.slice(-6)}</Text>
                  </VStack>
                </HStack>
                <Box textAlign="right">
                  <Badge colorScheme="green" variant="solid" px="3" py="1" borderRadius="full">
                    {player.matches_won ?? 0}
                  </Badge>
                </Box>
                <Box textAlign="right">
                  <Badge colorScheme="red" variant="solid" px="3" py="1" borderRadius="full">
                    {player.matches_lost ?? 0}
                  </Badge>
                </Box>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {/* Footer with refresh button */}
      <HStack justify="flex-end" mt="6" pr="4">
        <Button
          onClick={fetchLeaderboard}
          size="sm"
          bg="gray.700"
          color="white"
          fontWeight="bold"
          borderRadius="0"
          border="2px solid"
          borderColor="gray.900"
          shadow="2px 2px 0px rgba(0,0,0,0.8)"
          _hover={{
            bg: "gray.800",
            transform: "translate(-1px, -1px)",
            shadow: "3px 3px 0px rgba(0,0,0,0.8)",
          }}
        >
          <RefreshCw size={16} />
          <Text ml="2">Refresh Leaderboard</Text>
        </Button>
      </HStack>
    </Box>
  );
};

export default Leaderboard;