import React, { useState, useEffect, useRef } from 'react';
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
 * with improved tournament advancement handling
 * 
 * @returns JSX.Element representing the Game Component
 */
export default function Game() {
  const { publicKey } = useWallet();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isMobile = useBreakpointValue({ base: true, md: false });

  // Fetch current game data with retry logic
  const fetchGameData = async (isRetry = false) => {
    if (!publicKey) {
      setLoading(false);
      return;
    }

    try {
      if (!isRetry) {
        setLoading(true);
        setError(null);
      }

      const data = await database.games.getCurrentGameByWallet(publicKey.toBase58());
      
      if (data) {
        setGameData(data);
        setRetryCount(0);
        setIsTransitioning(false);
        setError(null);
      } else {
        // No game data - could be transitioning between matches in tournament
        if (retryCount < 5 && (gameData?.tournament || isTransitioning)) {
          // During tournament transitions, retry more aggressively
          setIsTransitioning(true);
          setRetryCount(prev => prev + 1);
          
          // Retry after a short delay
          retryTimeoutRef.current = setTimeout(() => {
            fetchGameData(true);
          }, 1000); // Retry every 1 second during transitions
          
          return; // Don't clear gameData yet
        } else {
          // Truly no game or max retries reached
          setGameData(null);
          setIsTransitioning(false);
          setRetryCount(0);
        }
      }
    } catch (err) {
      console.error('Error fetching game data:', err);
      
      // During tournament transitions, be more forgiving of errors
      if (retryCount < 3 && (gameData?.tournament || isTransitioning)) {
        setIsTransitioning(true);
        setRetryCount(prev => prev + 1);
        
        retryTimeoutRef.current = setTimeout(() => {
          fetchGameData(true);
        }, 2000); // Retry after 2 seconds on error
      } else {
        setError('Failed to load game information');
        setIsTransitioning(false);
      }
    } finally {
      if (!isRetry) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchGameData();
    
    // Cleanup retry timeout on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [publicKey]);

  // Enhanced polling during tournament transitions
  useEffect(() => {
    if (isTransitioning || (gameData?.tournament && gameData.tournament.status === 'in_progress')) {
      // Poll more frequently during tournament progression
      pollIntervalRef.current = setInterval(() => {
        fetchGameData(true);
      }, 3000); // Every 3 seconds during tournaments

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [isTransitioning, gameData?.tournament?.status]);

  // Subscribe to real-time game updates
  useEffect(() => {
    if (!gameData?.match?.id) return;

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
        (payload) => {
          console.log('Match update received:', payload);
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
        (payload) => {
          console.log('Round update received:', payload);
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
        // @ts-ignore
        component: <WaitingTournament match={match} tournament={tournament} />
      };
    }

    // Match waiting to start (tournament advancement)
    if (match.status === 'waiting') {
      return {
        status: 'waiting_match',
        // @ts-ignore
        component: <WaitingTournament match={match} tournament={tournament} />
      };
    }

    // Match completed - show payout
    if (match.status === 'completed') {
      if (match.winner_id && !match.tournament_id) {
        // 1v1 match completed
        return {
          status: 'completed',
          component: <GameResult matchId={match.id} />
        };
      } else if (match.tournament_id) {
        // Tournament match completed - show payout for finals or waiting for next round
        return {
          status: 'tournament_completed',
          component: <GameResult matchId={match.id} />
        };
      } else {
        return {
          status: 'completed',
          // @ts-ignore
          component: <WaitingTournament match={match} tournament={tournament} />
        };
      }
    }

    // Match in progress
    if (match.status === 'in_progress' || match.status === 'showing_results') {
      return {
        status: 'in_progress',
        component: <Match />
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
          text: 'ADVANCING TO NEXT ROUND',
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
      case 'tournament_completed':
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
  if (loading && !gameData) {
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

  // Tournament transition state
  if (isTransitioning) {
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
            Tournament Advancing...
          </Text>
          <Text fontSize="sm" color="fg.muted">
            Moving to next round • Attempt {retryCount}/5
          </Text>
        </VStack>
      </Box>
    );
  }

  // Error state (only show if not transitioning and no game data)
  if (error && !gameData && !isTransitioning) {
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

  // No game data (only show if not transitioning)
  if (!gameData && !isTransitioning) {
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