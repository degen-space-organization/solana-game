import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  VStack,
  HStack,
  Text,
  Heading,
  Image,
  Grid,
  Badge,
} from '@chakra-ui/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/supabase';
import type { GameData } from '@/supabase/Database/game';

interface MatchResultProps {
  gameData: GameData;
  winnerId: number | null;
}

interface GameRound {
  id: number;
  round_number: number;
  winner_id: number | null;
  completed_at: string | null;
}

export default function MatchResult({ gameData, winnerId }: MatchResultProps) {
  const { publicKey } = useWallet();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [gameRounds, setGameRounds] = useState<GameRound[]>([]);
  const [loading, setLoading] = useState(true);

  const participants = gameData.participants;
  const player1 = participants.find(p => p.position === 1);
  const player2 = participants.find(p => p.position === 2);

  const getDisplayName = (user: any): string => {
    return user?.nickname || `${user?.solana_address?.slice(0, 4)}...${user?.solana_address?.slice(-4)}` || 'Unknown';
  };

  // Determine current user ID
  useEffect(() => {
    if (publicKey) {
      const userParticipant = participants.find(p => 
        p.users.solana_address === publicKey.toBase58()
      );
      setCurrentUserId(userParticipant?.user_id || null);
    }
  }, [publicKey, participants]);

  // Fetch game rounds to calculate scores
  useEffect(() => {
    const fetchGameRounds = async () => {
      try {
        const { data: rounds, error } = await supabase
          .from('game_rounds')
          .select('id, round_number, winner_id, completed_at')
          .eq('match_id', gameData.match.id)
          .order('round_number', { ascending: true });

        if (error) throw error;
        setGameRounds(rounds || []);
      } catch (error) {
        console.error('Error fetching game rounds:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGameRounds();
  }, [gameData.match.id]);

  // Calculate scores
  const player1Score = gameRounds.filter(round => round.winner_id === player1?.user_id).length;
  const player2Score = gameRounds.filter(round => round.winner_id === player2?.user_id).length;
  const totalRounds = gameRounds.filter(round => round.completed_at !== null).length;

  // Determine result for current user
  const getMatchResult = () => {

    if (!winnerId) {
      return {
        text: "DRAW!",
        gif: "/gifs/result-draw.gif",
        bgColor: "primary.emphasis",
        textColor: "fg.inverted"
      };
    }
    
    const isWinner = currentUserId === winnerId;
    
    if (isWinner) {
      return {
        text: "VICTORY!",
        gif: "/gifs/result-win.gif",
        bgColor: "brutalist.green",
        textColor: "fg.inverted"
      };
    } else {
      return {
        text: "DEFEAT!",
        gif: "/gifs/result-lose.gif", 
        bgColor: "error",
        textColor: "fg.inverted"
      };
    }
  };

  const result = getMatchResult();

  if (loading) {
    return (
      <Card.Root
        bg="bg.default"
        border="4px solid"
        borderColor="border.default"
        borderRadius="0"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        p="8"
        textAlign="center"
      >
        <Card.Body>
          <Text fontSize="lg" fontWeight="bold" color="fg.muted">
            Loading Results...
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <VStack gap="6" align="stretch" w="100%" maxW="2xl" mx="auto">
      {/* Main Result Card */}
      <Card.Root
        bg={result.bgColor}
        color={result.textColor}
        border="4px solid"
        borderColor="border.default"
        borderRadius="0"
        shadow="12px 12px 0px rgba(0,0,0,0.8)"
        overflow="hidden"
      >
        <Card.Body p="8" textAlign="center">
          <VStack gap="6">
            {/* Result Text */}
            <Heading
              size={{ base: "xl", md: "2xl" }}
              fontWeight="black"
              textTransform="uppercase"
              letterSpacing="wider"
              color={result.textColor}
            >
              {result.text}
            </Heading>
            
            {/* Result GIF */}
            <Box
              border="4px solid"
              borderColor={result.textColor}
              borderRadius="0"
              overflow="hidden"
              bg="bg.default"
              w={{ base: "250px", md: "350px" }}
              h={{ base: "250px", md: "350px" }}
              mx="auto"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Image
                src={result.gif}
                alt="Match Result"
                w="100%"
                h="100%"
                objectFit="contain"
                objectPosition="center"
                loading="eager"
              />
            </Box>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Match Summary */}
      <Card.Root
        bg="bg.default"
        border="4px solid"
        borderColor="border.default"
        borderRadius="0"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
      >
        <Card.Body p="6">
          <VStack gap="6" align="stretch">
            {/* Header */}
            <Text
              fontSize="lg"
              fontWeight="black"
              color="fg.default"
              textTransform="uppercase"
              letterSpacing="wider"
              textAlign="center"
            >
              Match #{gameData.match.id} Complete
            </Text>

            {/* Final Score */}
            <Box
              bg="bg.subtle"
              border="2px solid"
              borderColor="border.default"
              borderRadius="0"
              p="6"
            >
              <VStack gap="4">
                <Text
                  fontSize="md"
                  fontWeight="bold"
                  color="fg.muted"
                  textTransform="uppercase"
                  textAlign="center"
                >
                  Final Score
                </Text>
                
                <HStack justify="center" align="center" gap="6">
                  {/* Player 1 */}
                  <VStack gap="2" align="center">
                    <Text fontSize="sm" fontWeight="bold" color="fg.default" textAlign="center">
                      {getDisplayName(player1?.users)}
                    </Text>
                    <Box
                      bg={player1Score > player2Score ? "brutalist.green" : player1Score < player2Score ? "error" : "fg.muted"}
                      color="fg.inverted"
                      w="12"
                      h="12"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      border="3px solid"
                      borderColor="border.default"
                      borderRadius="0"
                      shadow="4px 4px 0px rgba(0,0,0,0.8)"
                    >
                      <Text fontSize="xl" fontWeight="black">
                        {player1Score}
                      </Text>
                    </Box>
                  </VStack>

                  {/* VS */}
                  <Text fontSize="lg" fontWeight="black" color="fg.default">
                    -
                  </Text>

                  {/* Player 2 */}
                  <VStack gap="2" align="center">
                    <Text fontSize="sm" fontWeight="bold" color="fg.default" textAlign="center">
                      {getDisplayName(player2?.users)}
                    </Text>
                    <Box
                      bg={player2Score > player1Score ? "brutalist.green" : player2Score < player1Score ? "error" : "fg.muted"}
                      color="fg.inverted"
                      w="12"
                      h="12"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      border="3px solid"
                      borderColor="border.default"
                      borderRadius="0"
                      shadow="4px 4px 0px rgba(0,0,0,0.8)"
                    >
                      <Text fontSize="xl" fontWeight="black">
                        {player2Score}
                      </Text>
                    </Box>
                  </VStack>
                </HStack>
              </VStack>
            </Box>

            {/* Match Stats */}
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap="4">
              {/* Rounds Played */}
              <Card.Root
                bg="primary.subtle"
                border="2px solid"
                borderColor="border.default"
                borderRadius="0"
                shadow="4px 4px 0px rgba(0,0,0,0.4)"
              >
                <Card.Body p="4" textAlign="center">
                  <VStack gap="2">
                    <Text fontSize="sm" fontWeight="bold" color="fg.default" textTransform="uppercase">
                      Rounds Played
                    </Text>
                    <Text fontSize="2xl" fontWeight="black" color="fg.default">
                      {totalRounds}
                    </Text>
                  </VStack>
                </Card.Body>
              </Card.Root>

              {/* Prize Pool */}
              <Card.Root
                bg="brutalist.yellow"
                border="2px solid"
                borderColor="border.default"
                borderRadius="0"
                shadow="4px 4px 0px rgba(0,0,0,0.4)"
              >
                <Card.Body p="4" textAlign="center">
                  <VStack gap="2">
                    <Text fontSize="sm" fontWeight="bold" color="fg.default" textTransform="uppercase">
                      Prize Pool
                    </Text>
                    <Text fontSize="2xl" fontWeight="black" color="fg.default">
                      {(parseInt(gameData.match.total_prize_pool) / 1e9).toFixed(2)} ◎
                    </Text>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </Grid>

            {/* Winner Badge */}
            {winnerId && (
              <Box textAlign="center">
                <Badge
                  bg="brutalist.green"
                  color="fg.inverted"
                  fontSize="md"
                  fontWeight="black"
                  px="4"
                  py="2"
                  borderRadius="0"
                  border="2px solid"
                  borderColor="border.default"
                  shadow="2px 2px 0px rgba(0,0,0,0.8)"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  🏆 {getDisplayName(participants.find(p => p.user_id === winnerId)?.users)} WINS!
                </Badge>
              </Box>
            )}
          </VStack>
        </Card.Body>
      </Card.Root>
    </VStack>
  );
}