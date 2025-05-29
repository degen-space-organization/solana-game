import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Spinner,
  Text,
} from '@chakra-ui/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/supabase';
import OneOnOneInfo from './OneOnOneInfo';
import TournamentInfo from './TournamentInfo';

interface GameData {
  id: number;
  type: '1v1' | 'tournament';
  status: 'waiting' | 'in_progress' | 'completed' | 'paused';
  match?: {
    id: number;
    status: string;
    winner_id: number | null;
    participants: Array<{
      user_id: number;
      position: number;
      users: {
        id: number;
        nickname: string | null;
        solana_address: string;
        matches_won: number;
        matches_lost: number;
      };
    }>;
    current_round?: number;
    total_rounds?: number;
    stake_amount: string;
    total_prize_pool: string;
  };
  tournament?: {
    id: number;
    name: string;
    status: string;
    max_players: number;
    current_players: number;
    prize_pool: string;
    participants: Array<{
      user_id: number;
      users: {
        id: number;
        nickname: string | null;
        solana_address: string;
        matches_won: number;
        matches_lost: number;
      };
      eliminated_at: string | null;
      final_position: number | null;
    }>;
  };
}

/**
 * @function GameInfo
 * 
 * @description Shows the information about the game
 * the game can be either a tournament or a one v one
 * 
 * It renders the information in realtime and updates it accordingly
 * its a "readonly" component
 */
export default function GameInfo() {
  const { publicKey } = useWallet();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGameData = async () => {
    if (!publicKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userAddress = publicKey.toBase58();
      
      // Get current user
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('solana_address', userAddress)
        .single();

      if (!user) {
        setError('User not found');
        return;
      }

      // Check for active matches
      const { data: activeMatches } = await supabase
        .from('match_participants')
        .select(`
          match_id,
          matches (
            id,
            status,
            winner_id,
            stake_amount,
            total_prize_pool,
            tournament_id,
            match_participants (
              user_id,
              position,
              users (
                id,
                nickname,
                solana_address,
                matches_won,
                matches_lost
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .in('matches.status', ['waiting', 'in_progress'])
        .limit(1);

      if (activeMatches && activeMatches.length > 0) {
        const match = activeMatches[0].matches;
        
        if (match.tournament_id) {
          // Tournament game
          const { data: tournament } = await supabase
            .from('tournaments')
            .select(`
              id,
              name,
              status,
              max_players,
              current_players,
              prize_pool,
              tournament_participants (
                user_id,
                eliminated_at,
                final_position,
                users (
                  id,
                  nickname,
                  solana_address,
                  matches_won,
                  matches_lost
                )
              )
            `)
            .eq('id', match.tournament_id)
            .single();

          setGameData({
            id: match.id,
            type: 'tournament',
            status: match.status as any,
            match: {
              id: match.id,
              status: match.status!,
              winner_id: match.winner_id,
              // @ts-ignore
              participants: match.match_participants,
              stake_amount: match.stake_amount,
              total_prize_pool: match.total_prize_pool,
            },
            // @ts-ignore
            tournament: tournament || undefined,
          });
        } else {
          // 1v1 game
          setGameData({
            id: match.id,
            type: '1v1',
            status: match.status as any,
            match: {
              id: match.id,
              // @ts-ignore
              status: match.status,
              winner_id: match.winner_id,
              // @ts-ignore
              participants: match.match_participants,
              stake_amount: match.stake_amount,
              total_prize_pool: match.total_prize_pool,
            },
          });
        }
      } else {
        setGameData(null);
      }
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

  // Subscribe to realtime changes
  useEffect(() => {
    if (!gameData) return;

    const channel = supabase
      .channel(`game-${gameData.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${gameData.match?.id}`,
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
          filter: `match_id=eq.${gameData.match?.id}`,
        },
        () => {
          fetchGameData(); // Re-fetch when round data changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameData?.id, gameData?.match?.id]);

  if (loading) {
    return (
      <Box
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="white"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="8"
        textAlign="center"
        transform="rotate(-0.5deg)"
      >
        <VStack gap="4">
          <Spinner size="xl" color="purple.500" />
          <Text fontSize="lg" fontWeight="bold" color="gray.900" textTransform="uppercase">
            Loading Game Info...
          </Text>
        </VStack>
      </Box>
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
        transform="rotate(0.5deg)"
      >
        <Text fontSize="lg" fontWeight="black" color="red.700" textTransform="uppercase">
          ⚠️ {error}
        </Text>
      </Box>
    );
  }

  if (!gameData) {
    return (
      <Box
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.400"
        bg="gray.50"
        shadow="8px 8px 0px rgba(0,0,0,0.4)"
        borderRadius="0"
        p="8"
        textAlign="center"
        transform="rotate(-0.3deg)"
      >
        <VStack gap="3">
          <Text fontSize="2xl" fontWeight="black" color="gray.600" textTransform="uppercase">
            👻 No Active Game
          </Text>
          <Text fontSize="md" color="gray.500">
            Join a lobby to start playing!
          </Text>
        </VStack>
      </Box>
    );
  }

  // Render the appropriate component based on game type
  if (gameData.type === 'tournament' && gameData.tournament) {
    return (
      <TournamentInfo 
        tournament={gameData.tournament}
        currentMatch={gameData.match}
      />
    );
  } else if (gameData.type === '1v1' && gameData.match) {
    return (
      <OneOnOneInfo 
        match={gameData.match}
      />
    );
  }

  return null;
}