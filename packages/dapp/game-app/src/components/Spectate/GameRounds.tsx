import React from 'react';
import {
  Box,
  Card,
  Text,
  Heading,
  VStack,
  HStack,
  Flex,
  Badge,
} from '@chakra-ui/react';
import { Gamepad2, Clock } from 'lucide-react';
import MoveDisplay from './MoveDisplay';
import type { Tables } from '@/supabase/types';

type Move = 'rock' | 'paper' | 'scissors';

interface GameRound extends Tables<'game_rounds'> {
  player1_move: Move | null;
  player2_move: Move | null;
}

interface GameRoundsProps {
  rounds: GameRound[];
  participants: Array<{
    user_id: number;
    position: number;
    users: Tables<'users'>;
  }>;
}

const GameRounds: React.FC<GameRoundsProps> = ({ rounds, participants }) => {
  const getDisplayName = (user: any): string => {
    return user?.nickname || `${user?.solana_address?.slice(0, 4)}...${user?.solana_address?.slice(-4)}` || 'Unknown';
  };

  const player1 = participants.find(p => p.position === 1);
  const player2 = participants.find(p => p.position === 2);

  const getRoundResult = (round: GameRound): { result: string; winner: string | null } => {
    if (!round.player1_move || !round.player2_move) {
      return { result: 'PENDING', winner: null };
    }

    if (round.player1_move === round.player2_move) {
      return { result: 'TIE', winner: null };
    }

    const isPlayer1Winner = 
      (round.player1_move === 'rock' && round.player2_move === 'scissors') ||
      (round.player1_move === 'paper' && round.player2_move === 'rock') ||
      (round.player1_move === 'scissors' && round.player2_move === 'paper');

    const winner = isPlayer1Winner 
      ? getDisplayName(player1?.users)
      : getDisplayName(player2?.users);

    return { result: 'WIN', winner };
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getResultColor = (result: string): string => {
    switch (result) {
      case 'WIN': return '#06D6A0';
      case 'TIE': return '#FF6B35';
      case 'PENDING': return '#6B7280';
      default: return '#6B7280';
    }
  };

  // Sort rounds by round number
  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number);

  return (
    <Card.Root
      borderWidth="4px"
      borderStyle="solid"
      borderColor="gray.900"
      bg="white"
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
      <Card.Body p="0">
        <VStack gap="6" align="stretch">
          {/* Header */}
          <HStack gap="3" align="center">
            <Gamepad2 size={28} color="#118AB2" />
            <Heading 
              size="lg" 
              fontWeight="black" 
              color="gray.900" 
              textTransform="uppercase"
              letterSpacing="wider"
            >
              🎮 Game Rounds
            </Heading>
            <Badge
              bg="#118AB2"
              color="white"
              fontSize="sm"
              fontWeight="black"
              px="3"
              py="1"
              borderRadius="0"
              border="2px solid"
              borderColor="gray.900"
              shadow="2px 2px 0px rgba(0,0,0,0.8)"
              textTransform="uppercase"
            >
              {sortedRounds.length} Rounds
            </Badge>
          </HStack>

          {sortedRounds.length === 0 ? (
            <Box
              bg="gray.50"
              border="3px solid"
              borderColor="gray.300"
              borderRadius="0"
              p="8"
              textAlign="center"
              shadow="3px 3px 0px rgba(0,0,0,0.3)"
            >
              <Text fontSize="lg" color="gray.600" fontWeight="medium">
                No rounds have been played yet
              </Text>
              <Text fontSize="sm" color="gray.500" mt="2">
                Rounds will appear here as the match progresses
              </Text>
            </Box>
          ) : (
            <VStack gap="4" align="stretch">
              {sortedRounds.map((round) => {
                const { result, winner } = getRoundResult(round);
                const isCompleted = round.completed_at !== null;
                const bothMovesSubmitted = round.player1_move !== null && round.player2_move !== null;
                const showMoves = bothMovesSubmitted; // Only show moves when both players have submitted

                return (
                  <Box
                    key={round.id}
                    bg="gray.50"
                    border="3px solid"
                    borderColor="gray.900"
                    borderRadius="0"
                    p="5"
                    shadow="4px 4px 0px rgba(0,0,0,0.8)"
                    transform={round.round_number % 2 === 0 ? "rotate(0.5deg)" : "rotate(-0.5deg)"}
                    _hover={{
                      transform: "rotate(0deg)",
                      shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                    }}
                    transition="all 0.2s ease"
                  >
                    <VStack gap="4" align="stretch">
                      {/* Round Header */}
                      <Flex justify="space-between" align="center">
                        <HStack gap="2" align="center">
                          <Text 
                            fontSize="lg" 
                            fontWeight="black" 
                            color="gray.900"
                            textTransform="uppercase"
                          >
                            Round {round.round_number}
                          </Text>
                          {round.created_at && (
                            <HStack gap="1" align="center">
                              <Clock size={14} color="#6B7280" />
                              <Text fontSize="xs" color="gray.600">
                                {formatTime(round.created_at)}
                              </Text>
                            </HStack>
                          )}
                        </HStack>
                        
                        <Badge
                          bg={getResultColor(result)}
                          color="white"
                          fontSize="xs"
                          fontWeight="black"
                          px="2"
                          py="1"
                          borderRadius="0"
                          border="2px solid"
                          borderColor="gray.900"
                          shadow="2px 2px 0px rgba(0,0,0,0.5)"
                          textTransform="uppercase"
                        >
                          {result === 'WIN' ? `${winner} WINS` : result}
                        </Badge>
                      </Flex>

                      {/* Moves Display */}
                      <Flex justify="center" gap="8" align="center">
                        <MoveDisplay
                          move={round.player1_move}
                          playerName={getDisplayName(player1?.users)}
                          isWinner={round.winner_id === player1?.user_id}
                          showMove={showMoves}
                          hasSubmittedMove={round.player1_move !== null}
                        />
                        
                        <Box
                          bg="#7B2CBF"
                          color="white"
                          px="3"
                          py="2"
                          border="3px solid"
                          borderColor="gray.900"
                          borderRadius="0"
                          shadow="3px 3px 0px rgba(0,0,0,0.8)"
                          transform="rotate(-2deg)"
                          fontSize="sm"
                          fontWeight="black"
                          textTransform="uppercase"
                          letterSpacing="wider"
                        >
                          VS
                        </Box>
                        
                        <MoveDisplay
                          move={round.player2_move}
                          playerName={getDisplayName(player2?.users)}
                          isWinner={round.winner_id === player2?.user_id}
                          showMove={showMoves}
                          hasSubmittedMove={round.player2_move !== null}
                        />
                      </Flex>

                      {/* Round Status */}
                      {!isCompleted && (
                        <Box
                          bg={bothMovesSubmitted ? "blue.100" : "yellow.100"}
                          border="2px solid"
                          borderColor={bothMovesSubmitted ? "blue.500" : "yellow.500"}
                          borderRadius="0"
                          p="3"
                          textAlign="center"
                          shadow={bothMovesSubmitted ? "2px 2px 0px rgba(59,130,246,0.3)" : "2px 2px 0px rgba(245,158,11,0.3)"}
                        >
                          {bothMovesSubmitted ? (
                            <Text fontSize="sm" color="blue.700" fontWeight="bold">
                              ⚡ Both moves submitted! Processing round...
                            </Text>
                          ) : (
                            <VStack gap="2">
                              <Text fontSize="sm" color="yellow.700" fontWeight="bold">
                                ⏳ Waiting for players to make their moves
                              </Text>
                              <HStack gap="4" justify="center">
                                <HStack gap="1">
                                  <Text fontSize="xs" color="yellow.600">
                                    {getDisplayName(player1?.users)}:
                                  </Text>
                                  <Text fontSize="xs" fontWeight="bold" color={round.player1_move ? "green.600" : "red.600"}>
                                    {round.player1_move ? "✅ Ready" : "⏸️ Thinking..."}
                                  </Text>
                                </HStack>
                                <Text fontSize="xs" color="yellow.600">|</Text>
                                <HStack gap="1">
                                  <Text fontSize="xs" color="yellow.600">
                                    {getDisplayName(player2?.users)}:
                                  </Text>
                                  <Text fontSize="xs" fontWeight="bold" color={round.player2_move ? "green.600" : "red.600"}>
                                    {round.player2_move ? "✅ Ready" : "⏸️ Thinking..."}
                                  </Text>
                                </HStack>
                              </HStack>
                            </VStack>
                          )}
                        </Box>
                      )}
                    </VStack>
                  </Box>
                );
              })}
            </VStack>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

export default GameRounds;