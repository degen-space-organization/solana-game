import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Spinner,
  Card,
  useBreakpointValue,
  Heading,
  Badge,
} from '@chakra-ui/react';
import {
  Trophy,
  Swords,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';

// Components
import Match from "./Match/Match";
import GameInfo from "./GameInfo/GameInfo";
import WaitingTournament from "./WaitingTournament/WaitingTournament";

// Utils
import { database } from '@/supabase/Database';
import { supabase } from '@/supabase';
import type { GameData } from '@/supabase/Database/game';
import GameResult from './GameResult/GameResult';

/**
 * @function Game
 * 
 * @description Represents the Game itself.
 * Handles the game logic and fetches information about the relevant game
 * 
 * Its rendering is handled one layer above
 * It decides whether to render the game UI or the winner etc.
 * 
 * @returns JSX.Element representing the Game Component
 */
export default function Game() {
  const { publicKey } = useWallet();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMobile = useBreakpointValue({ base: true, md: false });

  // Fetch current game data
  const fetchGameData = async () => {
    if (!publicKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await database.games.getCurrentGameByWallet(publicKey.toBase58());
      setGameData(data);
    } catch (err) {
      console.error('Error fetching game data:', err);
      setError('Failed to load game information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameData();
  }, [publicKey]);

  // Subscribe to real-time game updates
  useEffect(() => {
    if (!gameData) return;

    const channel = supabase
      .channel(`game-updates-${gameData.match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${gameData.match.id}`,
        },
        () => {
          fetchGameData(); // Re-fetch when match data changes
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `match_id=eq.${gameData.match.id}`,
        },
        () => {
          fetchGameData(); // Re-fetch when round data changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameData?.match?.id]);

  // Get game status and determine what to render
  const getGameStatus = () => {
    if (!gameData) return { status: 'unknown', component: null };

    const { match, tournament } = gameData;

    // Tournament waiting state
    if (tournament && tournament.status === 'waiting') {
      return {
        status: 'waiting_tournament',
        component: <WaitingTournament />
      };
    }

    // Match completed - show payout
    if (match.status === 'completed') {
      if (match.winner_id && !match.tournament_id) {
        return {
          status: 'completed',
          component: <GameResult matchId={match.id} />
        };
      } else {
        return {
          status: 'completed',
          component: <WaitingTournament />
        }
      }
    }

    // Match in progress
    if (match.status === 'in_progress' || match.status === 'showing_results') {
      return {
        status: 'in_progress',
        component: <Match />
      };
    }

    // Match waiting to start
    if (match.status === 'waiting') {
      return {
        status: 'waiting_match',
        component: <WaitingTournament />
      };
    }

    return { status: 'unknown', component: null };
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'waiting_tournament':
        return {
          icon: <Clock size={20} />,
          text: 'WAITING FOR TOURNAMENT',
          color: '#FF6B35',
          bgColor: 'brutalist.orange'
        };
      case 'waiting_match':
        return {
          icon: <Clock size={20} />,
          text: 'MATCH STARTING SOON',
          color: '#FF6B35',
          bgColor: 'brutalist.orange'
        };
      case 'in_progress':
        return {
          icon: <Swords size={20} />,
          text: 'BATTLE IN PROGRESS',
          color: '#06D6A0',
          bgColor: 'brutalist.green'
        };
      case 'completed':
        return {
          icon: <Trophy size={20} />,
          text: 'MATCH COMPLETED',
          color: '#7B2CBF',
          bgColor: 'primary.emphasis'
        };
      default:
        return {
          icon: <AlertTriangle size={20} />,
          text: 'UNKNOWN STATUS',
          color: '#6B7280',
          bgColor: 'brutalist.gray.500'
        };
    }
  };

  // Loading state
  if (loading) {
    return (
      <Box p={8} textAlign="center">
        <VStack padding={6}>
          <Spinner size="xl" color="primary.emphasis" />
          <Text
            fontSize="lg"
            fontWeight="bold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Loading Game Data...
          </Text>
        </VStack>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box p={8} textAlign="center">
        <Card.Root
          bg="error"
          color="fg.inverted"
          border="4px solid"
          borderColor="border.default"
          borderRadius="sm"
          shadow="brutalist.lg"
          transform="rotate(-0.5deg)"
        >
          <Card.Body p={8}>
            <VStack padding={4}>
              <AlertTriangle size={48} />
              <Heading size="lg" fontWeight="black" textTransform="uppercase">
                Game Error
              </Heading>
              <Text fontSize="md">{error}</Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Box>
    );
  }

  // No game data
  if (!gameData) {
    return (
      <Box p={8} textAlign="center">
        <Card.Root
          bg="brutalist.gray.100"
          color="fg.default"
          border="4px solid"
          borderColor="border.default"
          borderRadius="sm"
          shadow="brutalist.lg"
          transform="rotate(0.3deg)"
        >
          <Card.Body p={8}>
            <VStack padding={4}>
              <Text fontSize="6xl">🎮</Text>
              <Heading size="lg" fontWeight="black" textTransform="uppercase">
                No Active Game
              </Heading>
              <Text fontSize="md" color="fg.muted">
                You're not currently in an active game session.
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Box>
    );
  }

  const { status, component } = getGameStatus();
  const statusInfo = getStatusInfo(status);

  return (
    <VStack align="stretch">
      {/* Game Info Header */}
      <Card.Root
        bg="bg.default"
        borderRadius="sm"
        width="100%"
      >
        <GameInfo />
      </Card.Root>

      {/* Game Content */}
      <Card.Root
        bg="bg.default"
        border="none"
        borderColor="border.default"
        borderRadius="sm"
        // shadow="brutalist.xl"
        minH="50vh"
      >
        <Card.Body p={0}>
          {component || (
            <Box p={8} textAlign="center">
              <VStack padding={4}>
                <AlertTriangle size={48} color="var(--chakra-colors-fg-muted)" />
                <Text fontSize="lg" fontWeight="bold" color="fg.muted">
                  Game state not recognized
                </Text>
              </VStack>
            </Box>
          )}
        </Card.Body>
      </Card.Root>
    </VStack>
  );
}