// components/Game/Game.tsx
import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Container,
  VStack,
  Heading,
  Text,
  Card,
  Button,
  Spinner,
  HStack,
  Badge,
} from '@chakra-ui/react';
import { 
  Gamepad2, 
  RefreshCw, 
  AlertCircle, 
  Trophy,
  Users,
  Clock
} from 'lucide-react';

// Import our game components
import { GameMatch, type MatchData } from './index';
import { database } from '@/supabase/Database';

// Types for the game data from your database
interface CurrentGameData {
  match: {
    id: number;
    tournament_id: number | null;
    status: string;
    stake_amount: string;
    total_prize_pool: string;
    winner_id: number | null;
    started_at: string | null;
    completed_at: string | null;
  };
  tournament?: {
    id: number;
    name: string;
    status: string;
    max_players: number;
    current_players: number;
    prize_pool: string;
    created_at: string;
    started_at: string | null;
  } | null;
  participants: Array<{
    user_id: number;
    position: number;
    users: {
      id: number;
      nickname: string | null;
      solana_address: string;
      matches_won: number | null;
      matches_lost: number | null;
    };
  }>;
  userPosition?: number;
}

type GamePageState = 'loading' | 'no-wallet' | 'no-game' | 'game-found' | 'error';

const Game: React.FC = () => {
  // Wallet connection
  const { publicKey, connected } = useWallet();

  // Component state
  const [pageState, setPageState] = useState<GamePageState>('loading');
  const [gameData, setGameData] = useState<CurrentGameData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch current game data
  const fetchGameData = async (walletAddress: string) => {
    try {
      setError(null);
      
      // Get current game data using your existing database helper
      const currentGame = await database.games.getCurrentGameByWallet(walletAddress);
      
      if (currentGame) {
        // @ts-ignore
        setGameData(currentGame); 
        setPageState('game-found');
        
        // Find current user ID from participants
        const currentUser = currentGame.participants.find(
          p => p.users.solana_address === walletAddress
        );
        setCurrentUserId(currentUser?.user_id || null);
      } else {
        setGameData(null);
        setCurrentUserId(null);
        setPageState('no-game');
      }
    } catch (err) {
      console.error('Error fetching game data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load game data');
      setPageState('error');
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    if (!publicKey) return;
    
    setIsRefreshing(true);
    await fetchGameData(publicKey.toBase58());
    setIsRefreshing(false);
  };

  // Handle leaving the game
  const handleLeaveGame = () => {
    setPageState('no-game');
    setGameData(null);
    setCurrentUserId(null);
    // You might want to add cleanup logic here
    // like calling an API to remove the player from the match
  };

  // Effect to check wallet connection and fetch data
  useEffect(() => {
    if (!connected || !publicKey) {
      setPageState('no-wallet');
      setGameData(null);
      setCurrentUserId(null);
      return;
    }

    const walletAddress = publicKey.toBase58();
    fetchGameData(walletAddress);
  }, [connected, publicKey]);

  // Convert your database format to GameMatch component format
  const convertToMatchData = (gameData: CurrentGameData): MatchData => {
    return {
      id: gameData.match.id,
      status: gameData.match.status,
      winner_id: gameData.match.winner_id,
      participants: gameData.participants.map(p => ({
        user_id: p.user_id,
        position: p.position,
        users: {
          id: p.users.id,
          nickname: p.users.nickname,
          solana_address: p.users.solana_address,
        },
      })),
    };
  };

  // Format SOL amount for display
  const formatSolAmount = (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
  };

  // Render loading state
  if (pageState === 'loading') {
    return (
      <Container maxW="100%" p="6">
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="white"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="8"
          textAlign="center"
        >
          <Card.Body>
            <VStack align="center" padding="6">
              <Spinner size="xl" color="blue.500" />
              <Heading
                size="lg"
                fontWeight="black"
                color="gray.900"
                textTransform="uppercase"
                mt="4"
              >
                🎮 Loading Game...
              </Heading>
              <Text color="gray.600">
                Checking for active matches...
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    );
  }

  // Render no wallet state
  if (pageState === 'no-wallet') {
    return (
      <Container maxW="100%" p="6">
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="red.500"
          bg="red.50"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="8"
          textAlign="center"
        >
          <Card.Body>
            <VStack align="center" padding="6">
              <AlertCircle size={64} color="#DC2626" />
              <Heading
                size="xl"
                fontWeight="black"
                color="red.600"
                textTransform="uppercase"
                mb="4"
              >
                🔒 Wallet Required
              </Heading>
              <Text fontSize="lg" color="red.500" mb="4">
                Please connect your wallet to access your games
              </Text>
              <Text fontSize="sm" color="red.400">
                Use the wallet button in the header to connect
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    );
  }

  // Render error state
  if (pageState === 'error') {
    return (
      <Container maxW="100%" p="6">
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="red.500"
          bg="red.50"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="8"
          textAlign="center"
        >
          <Card.Body>
            <VStack align="center" padding="6">
              <AlertCircle size={64} color="#DC2626" />
              <Heading
                size="xl"
                fontWeight="black"
                color="red.600"
                textTransform="uppercase"
                mb="4"
              >
                ⚠️ Error Loading Game
              </Heading>
              <Text fontSize="lg" color="red.500" mb="4">
                {error || 'Something went wrong while loading your game'}
              </Text>
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                bg="#DC2626"
                color="white"
                fontWeight="black"
                fontSize="lg"
                px="8"
                py="4"
                borderRadius="0"
                border="3px solid"
                borderColor="gray.900"
                shadow="6px 6px 0px rgba(0,0,0,0.8)"
                textTransform="uppercase"
                _hover={{
                  bg: "#B91C1C",
                  transform: "translate(-3px, -3px)",
                  shadow: "9px 9px 0px rgba(0,0,0,0.8)",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "3px 3px 0px rgba(0,0,0,0.8)",
                }}
              >
                {isRefreshing ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                <Text ml="2">Try Again</Text>
              </Button>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    );
  }

  // Render no game state
  if (pageState === 'no-game') {
    return (
      <Container maxW="100%" p="6">
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.400"
          bg="gray.50"
          shadow="8px 8px 0px rgba(0,0,0,0.4)"
          borderRadius="0"
          p="8"
          textAlign="center"
        >
          <Card.Body>
            <VStack align="center" padding="6">
              <Gamepad2 size={64} color="#9CA3AF" />
              <Heading
                size="xl"
                fontWeight="black"
                color="gray.600"
                textTransform="uppercase"
                mb="4"
              >
                🎯 No Active Games
              </Heading>
              <Text fontSize="lg" color="gray.500" mb="4">
                You're not currently in any active match
              </Text>
              <Text fontSize="sm" color="gray.400" mb="6">
                Join a lobby or create a new game to start playing!
              </Text>
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                bg="#118AB2"
                color="white"
                fontWeight="black"
                fontSize="lg"
                px="8"
                py="4"
                borderRadius="0"
                border="3px solid"
                borderColor="gray.900"
                shadow="6px 6px 0px rgba(0,0,0,0.8)"
                textTransform="uppercase"
                _hover={{
                  bg: "#0E7FA1",
                  transform: "translate(-3px, -3px)",
                  shadow: "9px 9px 0px rgba(0,0,0,0.8)",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "3px 3px 0px rgba(0,0,0,0.8)",
                }}
              >
                {isRefreshing ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                <Text ml="2">Check Again</Text>
              </Button>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    );
  }

  // Render active game state
  if (pageState === 'game-found' && gameData && currentUserId) {
    const matchData = convertToMatchData(gameData);
    
    return (
      <Container maxW="100%" p="0">
        {/* Game Header with Info */}
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="white"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          mb="6"
          p="6"
        >
          <Card.Body>
            <VStack align="stretch" padding="2">
              <HStack justify="space-between" align="center" mb="4">
                <HStack>
                  <Trophy size={32} color="#FF6B35" />
                  <VStack align="flex-start" padding="0">
                    <Heading
                      size="lg"
                      fontWeight="black"
                      color="gray.900"
                      textTransform="uppercase"
                    >
                      {gameData.tournament ? '🏆 Tournament Match' : '⚔️ 1v1 Duel'}
                    </Heading>
                    {gameData.tournament && (
                      <Text fontSize="md" color="gray.600">
                        {gameData.tournament.name}
                      </Text>
                    )}
                  </VStack>
                </HStack>

                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  bg="#7B2CBF"
                  color="white"
                  fontWeight="black"
                  fontSize="sm"
                  px="4"
                  py="2"
                  borderRadius="0"
                  border="3px solid"
                  borderColor="gray.900"
                  shadow="4px 4px 0px rgba(0,0,0,0.8)"
                  _hover={{
                    bg: "#6A1B9A",
                    transform: "translate(-2px, -2px)",
                    shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                  }}
                >
                  {isRefreshing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                </Button>
              </HStack>

              <HStack justify="space-between">
                <HStack>
                  <Users size={20} color="#059669" />
                  <Text fontWeight="bold" color="gray.700">
                    {gameData.participants.length} Players
                  </Text>
                </HStack>

                <HStack>
                  <Trophy size={20} color="#D69E2E" />
                  <Text fontWeight="bold" color="gray.700">
                    {formatSolAmount(gameData.match.total_prize_pool)} SOL
                  </Text>
                </HStack>

                <Badge
                  bg={
                    gameData.match.status === 'in_progress' ? '#059669' :
                    gameData.match.status === 'waiting' ? '#FF6B35' :
                    '#7B2CBF'
                  }
                  color="white"
                  fontSize="sm"
                  fontWeight="black"
                  px="3"
                  py="1"
                  borderRadius="0"
                  display="flex"
                  alignItems="center"
                  gap="2"
                >
                  <Clock size={14} />
                  {gameData.match.status.toUpperCase()}
                </Badge>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Main Game Component */}
        <GameMatch
          matchData={matchData}
          currentUserId={currentUserId}
          onLeaveMatch={handleLeaveGame}
        />
      </Container>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
};

export default Game;