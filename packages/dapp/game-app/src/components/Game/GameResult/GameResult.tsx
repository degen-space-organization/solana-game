import { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Card,
  Button,
  Spinner,
} from '@chakra-ui/react';
import { 
  Trophy, 
  RotateCcw,
  Coins,
  Target
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/supabase';

interface GameResultProps {
  matchId: number;
}

interface MatchData {
  id: number;
  winner_id: number | null;
  total_prize_pool: string;
  stake_amount: string;
  completed_at: string | null;
}

interface Participant {
  user_id: number;
  position: number;
  users: {
    id: number;
    nickname: string | null;
    solana_address: string;
    matches_won: number;
    matches_lost: number;
  };
}

export default function GameResult({ matchId }: GameResultProps) {
  const { publicKey } = useWallet();
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const formatSolAmount = (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
  };

  const handlePlayAgain = () => {
    // Option 1: Try to navigate to lobbies section (if you have routing)
    // Option 2: Refresh the page to reset to lobby view
    window.location.reload();
  };

  // Fetch match data and participants
  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        // Fetch match details
        const { data: match, error: matchError } = await supabase
          .from('matches')
          .select('id, winner_id, total_prize_pool, stake_amount, completed_at')
          .eq('id', matchId)
          .single();

        if (matchError) throw matchError;

        // Fetch participants
        const { data: participantsData, error: participantsError } = await supabase
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

        if (participantsError) throw participantsError;

        setMatchData(match);
        // @ts-ignore
        setParticipants(participantsData || []);

        // Determine current user ID
        if (publicKey) {
          const userParticipant = participantsData?.find(p => 
            p.users.solana_address === publicKey.toBase58()
          );
          setCurrentUserId(userParticipant?.user_id || null);
        }

      } catch (error) {
        console.error('Error fetching match data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatchData();
  }, [matchId, publicKey]);

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
        maxW="2xl"
        mx="auto"
        mt="8"
      >
        <Card.Body>
          <VStack gap="4">
            <Spinner size="xl" color="primary.emphasis" />
            <Text
              fontSize="lg"
              fontWeight="bold"
              color="fg.muted"
              textTransform="uppercase"
            >
              Loading Results...
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (!matchData || !participants.length) {
    return (
      <Card.Root
        bg="error"
        color="fg.inverted"
        border="4px solid"
        borderColor="border.default"
        borderRadius="0"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        p="8"
        textAlign="center"
        maxW="2xl"
        mx="auto"
        mt="8"
      >
        <Card.Body>
          <Text fontSize="lg" fontWeight="bold">
            Error loading match results
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  const isWinner = currentUserId && matchData.winner_id === currentUserId;
  const isDraw = !matchData.winner_id;
  const prizeAmount = formatSolAmount(matchData.total_prize_pool);

  return (
    <Box maxW="2xl" mx="auto" mt="8" p="4">
      <VStack gap="6" align="stretch">
        {/* Main Result Card */}
        <Card.Root
          bg={isWinner ? "brutalist.green" : isDraw ? "primary.emphasis" : "error"}
          color="fg.inverted"
          border="4px solid"
          borderColor="border.default"
          borderRadius="0"
          shadow="12px 12px 0px rgba(0,0,0,0.8)"
        >
          <Card.Body p="8" textAlign="center">
            <VStack gap="6">
              {/* Icon */}
              <Box
                bg="fg.inverted"
                color={isWinner ? "brutalist.green" : isDraw ? "primary.emphasis" : "error"}
                p="6"
                border="4px solid"
                borderColor="fg.inverted"
                borderRadius="0"
                shadow="4px 4px 0px rgba(0,0,0,0.8)"
              >
                {isWinner ? <Trophy size={48} /> : <Target size={48} />}
              </Box>

              {/* Main Message */}
              <VStack gap="4">
                <Heading
                  size={{ base: "xl", md: "2xl" }}
                  fontWeight="black"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  color="fg.inverted"
                >
                  {isWinner ? "🎉 CONGRATULATIONS! 🎉" : 
                   isDraw ? "🤝 MATCH DRAWN 🤝" : 
                   "💪 BETTER LUCK NEXT TIME"}
                </Heading>

                <Text
                  fontSize={{ base: "md", md: "lg" }}
                  fontWeight="bold"
                  color="fg.inverted"
                  textAlign="center"
                  maxW="md"
                >
                  {isWinner ? (
                    <>
                      We have issued{' '}
                      <Box as="span" fontFamily="mono" fontSize="xl">
                        {prizeAmount} ◎
                      </Box>
                      {' '}to your wallet. It should arrive shortly!
                    </>
                  ) : isDraw ? (
                    "The match ended in a draw. Your stake will be returned to your wallet."
                  ) : (
                    "You lost this match, but every game is a chance to improve your skills!"
                  )}
                </Text>
              </VStack>

              {/* Prize Amount (for winners) */}
              {isWinner && (
                <Box
                  bg="fg.inverted"
                  color="brutalist.green"
                  border="3px solid"
                  borderColor="fg.inverted"
                  p="4"
                  borderRadius="0"
                  shadow="4px 4px 0px rgba(0,0,0,0.8)"
                >
                  <HStack gap="3" justify="center">
                    <Coins size={24} />
                    <Text fontSize="2xl" fontWeight="black" fontFamily="mono">
                      {prizeAmount} ◎
                    </Text>
                  </HStack>
                </Box>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Match Info */}
        <Card.Root
          bg="bg.default"
          border="4px solid"
          borderColor="border.default"
          borderRadius="0"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
        >
          <Card.Body p="6">
            <VStack gap="4">
              <Text
                fontSize="md"
                fontWeight="bold"
                color="fg.muted"
                textTransform="uppercase"
                letterSpacing="wider"
                textAlign="center"
              >
                Match #{matchData.id} Complete
              </Text>

              <HStack gap="6" justify="center" wrap="wrap">
                <VStack gap="1" align="center">
                  <Text fontSize="xs" color="fg.subtle" fontWeight="bold" textTransform="uppercase">
                    Stake Per Player
                  </Text>
                  <Text fontSize="md" fontWeight="black" color="fg.default">
                    {formatSolAmount(matchData.stake_amount)} ◎
                  </Text>
                </VStack>

                <VStack gap="1" align="center">
                  <Text fontSize="xs" color="fg.subtle" fontWeight="bold" textTransform="uppercase">
                    Total Prize Pool
                  </Text>
                  <Text fontSize="md" fontWeight="black" color="fg.default">
                    {prizeAmount} ◎
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Please wait while we process the game */}
        <Card.Root
          bg="bg.subtle"
          border="4px solid"
          borderColor="border.default"
          borderRadius="0"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
        >
          <Card.Body p="6" textAlign="center">
            <VStack gap="4">
              <Text
                fontSize="md"
                fontWeight="bold"
                color="fg.default"
                textAlign="center"
              >
                Please wait while we process the game results and update your stats.  
                This may take a few moments.
              </Text>
              <Spinner size="lg" color="primary.emphasis" />
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Play Again Button */}
        <Card.Root
          bg="bg.subtle"
          border="4px solid"
          borderColor="border.default"
          borderRadius="0"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
        >
          <Card.Body p="6" textAlign="center">
            <VStack gap="4">
              <Text
                fontSize="md"
                fontWeight="bold"
                color="fg.default"
                textAlign="center"
              >
                Ready for another round?
              </Text>

              <Button
                onClick={handlePlayAgain}
                bg="primary.emphasis"
                color="fg.inverted"
                border="3px solid"
                borderColor="border.default"
                borderRadius="0"
                shadow="4px 4px 0px rgba(0,0,0,0.8)"
                fontWeight="black"
                textTransform="uppercase"
                letterSpacing="wider"
                px="8"
                py="6"
                fontSize="lg"
                _hover={{
                  transform: "translate(-2px, -2px)",
                  shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "2px 2px 0px rgba(0,0,0,0.8)",
                }}
              >
                <HStack gap="3">
                  <RotateCcw size={20} />
                  <Text>Play Again</Text>
                </HStack>
              </Button>
            </VStack>
          </Card.Body>
        </Card.Root>
      </VStack>
    </Box>
  );
}