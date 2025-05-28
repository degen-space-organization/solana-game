import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Text,
  Card,
  Heading,
  HStack,
} from '@chakra-ui/react';
import { Eye } from 'lucide-react';
import MatchSearch from './MatchSearch';
import MatchInfo from './MatchInfo';
import GameRounds from './GameRounds';
import { supabase } from '@/supabase';
import type { GameData } from '@/supabase/Database/game';
import type { Tables } from '@/supabase/types';

type Move = 'rock' | 'paper' | 'scissors';

interface GameRound extends Tables<'game_rounds'> {
  player1_move: Move | null;
  player2_move: Move | null;
}

const Spectate: React.FC = () => {
  const [matchData, setMatchData] = useState<GameData | null>(null);
  const [gameRounds, setGameRounds] = useState<GameRound[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);

  const fetchMatchData = async (matchId: number): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch match details
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        throw new Error(`Match #${matchId} not found`);
      }

      // Fetch match participants with user details
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
        .eq('match_id', matchId);

      if (participantsError) {
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
        .eq('match_id', matchId)
        .order('round_number', { ascending: true });

      if (roundsError) {
        throw new Error('Failed to load game rounds');
      }

      // Calculate scores
      const player1 = participants.find(p => p.position === 1);
      const player2 = participants.find(p => p.position === 2);
      
      let p1Score = 0;
      let p2Score = 0;

      rounds?.forEach(round => {
        if (round.winner_id === player1?.user_id) {
          p1Score++;
        } else if (round.winner_id === player2?.user_id) {
          p2Score++;
        }
      });

      setPlayer1Score(p1Score);
      setPlayer2Score(p2Score);

      // Set the data
      setMatchData({
        match,
        tournament,
        participants: participants as Array<{
          user_id: number;
          position: number;
          users: Tables<'users'>;
        }>,
      });

      setGameRounds(rounds as GameRound[] || []);

    } catch (err) {
      console.error('Error fetching match data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load match data');
      setMatchData(null);
      setGameRounds([]);
      setPlayer1Score(0);
      setPlayer2Score(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time subscription for game rounds updates
  useEffect(() => {
    if (!matchData) return;

    const channel = supabase
      .channel(`spectate-match-${matchData.match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `match_id=eq.${matchData.match.id}`,
        },
        () => {
          // Refresh data when rounds are updated
          fetchMatchData(matchData.match.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchData.match.id}`,
        },
        () => {
          // Refresh data when match is updated
          fetchMatchData(matchData.match.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchData?.match.id]);

  return (
    <VStack gap="6" align="stretch" w="100%">
      {/* Page Header */}
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="white"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
        transform="rotate(-0.2deg)"
        _hover={{
          transform: "rotate(0deg) scale(1.01)",
          shadow: "12px 12px 0px rgba(0,0,0,0.8)",
        }}
        transition="all 0.2s ease"
      >
        <Card.Body p="0" textAlign="center">
          <VStack gap="3">
            <HStack gap="3" align="center" justify="center">
              <Eye size={32} color="#118AB2" />
              <Heading 
                size="2xl" 
                fontWeight="black" 
                color="gray.900" 
                textTransform="uppercase"
                letterSpacing="wider"
                textShadow="3px 3px 0px rgba(17,138,178,0.3)"
              >
                👁️ SPECTATE MODE
              </Heading>
            </HStack>
            <Text color="gray.600" fontSize="lg" fontWeight="medium">
              Watch Rock Paper Scissors matches in real-time
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Search Component */}
      <MatchSearch
        onMatchSearch={fetchMatchData}
        isLoading={isLoading}
        error={error}
      />

      {/* Match Info - only show if we have match data */}
      {matchData && (
        <MatchInfo
          matchData={matchData}
          player1Score={player1Score}
          player2Score={player2Score}
        />
      )}

      {/* Game Rounds - only show if we have match data */}
      {matchData && (
        <GameRounds
          rounds={gameRounds}
          participants={matchData.participants}
        />
      )}

      {/* No match selected placeholder */}
      {!matchData && !isLoading && !error && (
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.300"
          bg="gray.50"
          shadow="8px 8px 0px rgba(0,0,0,0.3)"
          borderRadius="0"
          p="12"
          textAlign="center"
          transform="rotate(0.5deg)"
        >
          <Card.Body p="0">
            <VStack gap="4">
              <Box fontSize="4xl">👻</Box>
              <Heading size="lg" fontWeight="black" color="gray.600" textTransform="uppercase">
                No Match Selected
              </Heading>
              <Text color="gray.500" fontSize="md">
                Enter a Match ID above to start spectating an epic Rock Paper Scissors battle!
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
};

export default Spectate;