import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Text,
  Spinner,
  Card,
  Heading,
  HStack,
} from '@chakra-ui/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/supabase';
import OneOnOneInfo from './OneOnOneInfo';
import TournamentInfo from './TournamentInfo';
import type { Tables } from '@/supabase/types';

interface GameData {
  match: Tables<'matches'>;
  tournament?: Tables<'tournaments'> | null;
  participants: Array<{
    user_id: number;
    position: number;
    users: Tables<'users'>;
  }>;
  rounds: Tables<'game_rounds'>[];
}

/**
 * @function GameInfo
 * 
 * @description Shows the information about the game
 * the game can be either a tournament or a one v one
 * 
 * It renders the information in realtime and updates it accordingly
 * its a "readonly" component
 * 
 * @returns JSX.Element representing the GameInfo Component
 */
export default function GameInfo() {
  const { publicKey } = useWallet();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Fetch current user's active match
  const fetchActiveGame = async () => {
    if (!publicKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const walletAddress = publicKey.toBase58();

      // Get current user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('solana_address', walletAddress)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      setCurrentUserId(user.id);

      // Get user's match participations
      const { data: matchParticipants, error: participantError } = await supabase
        .from('match_participants')
        .select('match_id')
        .eq('user_id', user.id);

      if (participantError || !matchParticipants || matchParticipants.length === 0) {
        throw new Error('No matches found');
      }

      const matchIds = matchParticipants.map(mp => mp.match_id);

      // Get the most recent active match
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .in('id', matchIds)
        .in('status', ['in_progress', 'completed'])
        .order('started_at', { ascending: false })
        .limit(1);

      if (matchesError || !matches || matches.length === 0) {
        throw new Error('No active game found');
      }

      const match = matches[0];

      // Fetch all match participants with user details
      const { data: participants, error: participantsError } = await supabase
        .from('match_participants')
        .select(`
          user_id,
          position,
          users (
            id,
            nickname,
            solana_address,
            matches_won,
            matches_lost
          )
        `)
        .eq('match_id', match.id);

      if (participantsError || !participants) {
        throw new Error('Failed to load match participants');
      }

      // Fetch tournament info if it's a tournament match
      let tournament: Tables<'tournaments'> | null = null;
      if (match.tournament_id) {
        const { data: tournamentData, error: tournamentError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', match.tournament_id)
          .single();

        if (!tournamentError && tournamentData) {
          tournament = tournamentData;
        }
      }

      // Fetch game rounds
      const { data: rounds, error: roundsError } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('match_id', match.id)
        .order('round_number', { ascending: true });

      if (roundsError) {
        console.error('Failed to load game rounds:', roundsError);
      }

      setGameData({
        match,
        tournament,
        participants: participants as Array<{
          user_id: number;
          position: number;
          users: Tables<'users'>;
        }>,
        rounds: rounds || [],
      });

    } catch (err) {
      console.error('Error fetching active game:', err);
      setError(err instanceof Error ? err.message : 'Failed to load game data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveGame();
  }, [publicKey]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!gameData) return;

    const matchChannel = supabase
      .channel(`game-info-${gameData.match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${gameData.match.id}`,
        },
        () => {
          console.log('Match updated, refreshing game data');
          fetchActiveGame();
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
          console.log('Game round updated, refreshing game data');
          fetchActiveGame();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
    };
  }, [gameData?.match.id]);

  if (!publicKey) {
    return (
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="orange.500"
        bg="orange.50"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="8"
        textAlign="center"
        transform="rotate(-0.5deg)"
      >
        <Card.Body p="0">
          <VStack gap="4">
            <Box fontSize="4xl">🔐</Box>
            <Heading size="lg" fontWeight="black" color="orange.700" textTransform="uppercase">
              Wallet Not Connected
            </Heading>
            <Text color="orange.600" fontSize="md">
              Connect your wallet to view game information
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (loading) {
    return (
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.400"
        bg="white"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="8"
        textAlign="center"
      >
        <Card.Body p="0">
          <VStack gap="4">
            <Spinner size="xl" color="purple.500" />
            <Heading size="md" fontWeight="black" color="gray.700" textTransform="uppercase">
              Loading Game Info...
            </Heading>
            <Text color="gray.600" fontSize="sm">
              Fetching your current game data
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (error || !gameData) {
    return (
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="red.500"
        bg="red.50"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="8"
        textAlign="center"
        transform="rotate(0.5deg)"
      >
        <Card.Body p="0">
          <VStack gap="4">
            <Box fontSize="4xl">⚠️</Box>
            <Heading size="lg" fontWeight="black" color="red.600" textTransform="uppercase">
              No Active Game
            </Heading>
            <Text color="red.500" fontSize="md">
              {error || "You don't have any active games right now"}
            </Text>
            <Text color="red.400" fontSize="sm">
              Join a lobby to start playing!
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  // Determine if it's a tournament or 1v1 game
  const isTournament = gameData.tournament !== null && gameData.tournament !== undefined;

  return (
    <VStack gap="6" align="stretch" w="100%">
      {/* Header */}
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="gray.900"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
        transform="rotate(-0.3deg)"
        _hover={{
          transform: "rotate(0deg) scale(1.01)",
          shadow: "12px 12px 0px rgba(0,0,0,0.8)",
        }}
        transition="all 0.2s ease"
      >
        <Card.Body p="0" textAlign="center">
          <VStack gap="3">
            <HStack gap="3" align="center" justify="center">
              <Box fontSize="2xl">
                {isTournament ? '🏆' : '⚔️'}
              </Box>
              <Heading 
                size="xl" 
                fontWeight="black" 
                color="white" 
                textTransform="uppercase"
                letterSpacing="wider"
                textShadow="3px 3px 0px rgba(0,0,0,0.5)"
              >
                {isTournament ? 'TOURNAMENT MATCH' : '1V1 DUEL'}
              </Heading>
            </HStack>
            <Text color="gray.300" fontSize="md" fontWeight="medium">
              Match #{gameData.match.id} • {gameData.match.status!.toUpperCase()}
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Game-specific Info Component */}
      {isTournament ? (
        <TournamentInfo 
          gameData={gameData} 
          currentUserId={currentUserId} 
        />
      ) : (
        <OneOnOneInfo 
          gameData={gameData} 
          currentUserId={currentUserId} 
        />
      )}
    </VStack>
  );
}