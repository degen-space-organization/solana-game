// components/Game/Battlefield.tsx
import React from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Heading,
  Card,
  Spinner,
} from '@chakra-ui/react';
import { ArrowLeft } from 'lucide-react';
import type { GameState, GameRound, Move, RoundWinner, MatchWinner } from '@/types/game';

interface BattlefieldProps {
  gameState: GameState;
  currentRound: GameRound | null;
  playerMove: Move | null;
  opponentMove: Move | null;
  roundWinner: RoundWinner;
  onLeaveMatch: () => void;
  matchFinished: boolean;
  matchWinner: MatchWinner;
}

const Battlefield: React.FC<BattlefieldProps> = ({ 
  gameState, 
  currentRound, 
  playerMove, 
  opponentMove, 
  roundWinner,
  onLeaveMatch,
  matchFinished,
  matchWinner
}) => {
  const getBattleResult = () => {
    if (gameState === 'revealing' && playerMove && opponentMove) {
      if (roundWinner === 'tie') {
        return { message: "🤝 IT'S A TIE!", color: "#FF6B35", icon: "⚖️" };
      } else if (roundWinner === 'player') {
        return { message: "🎉 YOU WIN!", color: "#059669", icon: "👑" };
      } else {
        return { message: "💔 YOU LOSE!", color: "#DC2626", icon: "😭" };
      }
    }
    return null;
  };

  const battleResult = getBattleResult();

  const getMoveEmoji = (move: Move | null) => {
    switch (move) {
      case 'rock': return '🪨';
      case 'paper': return '📄';
      case 'scissors': return '✂️';
      default: return '❓';
    }
  };

  if (matchFinished) {
    return (
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor={matchWinner === 'player' ? "green.600" : "red.600"}
        bg={matchWinner === 'player' ? "green.50" : "red.50"}
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="8"
        textAlign="center"
      >
        <Card.Body>
          <VStack align="center" padding="4">
            <Text fontSize="6xl" mb="4">
              {matchWinner === 'player' ? '🏆' : '💀'}
            </Text>
            <Heading
              size="xl"
              fontWeight="black"
              color={matchWinner === 'player' ? "green.700" : "red.700"}
              textTransform="uppercase"
              mb="4"
            >
              {matchWinner === 'player' ? 'VICTORY!' : 'DEFEAT!'}
            </Heading>
            <Text 
              fontSize="xl" 
              color={matchWinner === 'player' ? "green.600" : "red.600"}
              mb="6"
            >
              {matchWinner === 'player' 
                ? 'Congratulations! You won the match!' 
                : 'Better luck next time!'
              }
            </Text>
            <Button
              onClick={onLeaveMatch}
              bg="#7B2CBF"
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
                bg: "#6A1B9A",
                transform: "translate(-3px, -3px)",
                shadow: "9px 9px 0px rgba(0,0,0,0.8)",
              }}
              _active={{
                transform: "translate(0px, 0px)",
                shadow: "3px 3px 0px rgba(0,0,0,0.8)",
              }}
            >
              <ArrowLeft size={20} />
              <Text ml="2">Leave Match</Text>
            </Button>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root
      borderWidth="4px"
      borderStyle="solid"
      borderColor="gray.900"
      bg="white"
      shadow="8px 8px 0px rgba(0,0,0,0.8)"
      borderRadius="0"
      p="6"
      minH="300px"
    >
      <Card.Body>
        <VStack align="center" justify="center" padding="4" minH="250px">
          {gameState === 'waiting' && (
            <>
              <Spinner size="xl" color="blue.500" />
              <Heading
                size="lg"
                fontWeight="black"
                color="gray.900"
                textTransform="uppercase"
                mt="4"
              >
                ⏳ Waiting for Match...
              </Heading>
              <Text color="gray.600" textAlign="center">
                Get ready for an epic battle!
              </Text>
            </>
          )}

          {gameState === 'choosing' && (
            <>
              <Text fontSize="6xl" mb="4">⚔️</Text>
              <Heading
                size="lg"
                fontWeight="black"
                color="gray.900"
                textTransform="uppercase"
                mb="2"
              >
                Submit Your Move!
              </Heading>
              <Text color="gray.600" textAlign="center" fontSize="lg">
                Round {currentRound?.round_number || 1}
              </Text>
              <Text color="red.500" fontWeight="bold" mt="2">
                Time is running out!
              </Text>
            </>
          )}

          {gameState === 'revealing' && battleResult && (
            <>
              <HStack padding="6" justify="center" align="center" mb="6">
                <Box
                  bg="blue.100"
                  border="3px solid"
                  borderColor="blue.600"
                  p="8"
                  borderRadius="0"
                  textAlign="center"
                >
                  <Text fontSize="6xl" mb="2">
                    {getMoveEmoji(playerMove)}
                  </Text>
                  <Text fontWeight="bold" color="blue.700">YOU</Text>
                </Box>

                <Text fontSize="4xl" mx="4">⚡</Text>

                <Box
                  bg="red.100"
                  border="3px solid"
                  borderColor="red.600"
                  p="8"
                  borderRadius="0"
                  textAlign="center"
                >
                  <Text fontSize="6xl" mb="2">
                    {getMoveEmoji(opponentMove)}
                  </Text>
                  <Text fontWeight="bold" color="red.700">OPPONENT</Text>
                </Box>
              </HStack>

              <Box
                bg={battleResult.color}
                color="white"
                px="8"
                py="4"
                borderRadius="0"
                border="3px solid"
                borderColor="gray.900"
                shadow="6px 6px 0px rgba(0,0,0,0.8)"
                textAlign="center"
              >
                <Text fontSize="2xl" fontWeight="black" textTransform="uppercase">
                  {battleResult.icon} {battleResult.message}
                </Text>
              </Box>
            </>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

export default Battlefield;