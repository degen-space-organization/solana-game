// components/Game/OpponentCards.tsx
import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Card,
  Badge,
  Grid,
} from '@chakra-ui/react';
import type { Move, MoveOption } from '@/types/game';

interface OpponentCardsProps {
  opponentName: string;
  hasSubmitted: boolean;
  isRevealing: boolean;
  opponentMove?: Move | null;
}

const OpponentCards: React.FC<OpponentCardsProps> = ({ 
  opponentName, 
  hasSubmitted, 
  isRevealing, 
  opponentMove 
}) => {
  const moves: MoveOption[] = [
    { type: 'rock', emoji: '🪨', name: 'ROCK', color: '#DC2626' },
    { type: 'paper', emoji: '📄', name: 'PAPER', color: '#059669' },
    { type: 'scissors', emoji: '✂️', name: 'SCISSORS', color: '#7B2CBF' },
  ];

  return (
    <Card.Root
      borderWidth="4px"
      borderStyle="solid"
      borderColor="gray.900"
      bg="white"
      shadow="8px 8px 0px rgba(0,0,0,0.8)"
      borderRadius="0"
      p="6"
    >
      <Card.Body>
        <VStack align="stretch" padding="2">
          <HStack justify="space-between" align="center" mb="4">
            <Heading
              size="md"
              fontWeight="black"
              color="gray.900"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              🎯 {opponentName}
            </Heading>
            <Badge
              bg={hasSubmitted ? "#059669" : "#FF6B35"}
              color="white"
              fontSize="sm"
              fontWeight="black"
              px="3"
              py="1"
              borderRadius="0"
            >
              {hasSubmitted ? "✅ READY" : "⏳ CHOOSING"}
            </Badge>
          </HStack>

          <Grid templateColumns="repeat(3, 1fr)" gap="4">
            {moves.map((move) => (
              <Box
                key={move.type}
                bg={isRevealing && opponentMove === move.type ? move.color : "gray.200"}
                color={isRevealing && opponentMove === move.type ? "white" : "gray.600"}
                fontWeight="black"
                fontSize="xl"
                py="8"
                px="6"
                borderRadius="0"
                border="4px solid"
                borderColor={isRevealing && opponentMove === move.type ? move.color : "gray.500"}
                shadow="6px 6px 0px rgba(0,0,0,0.4)"
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap="2"
                position="relative"
                overflow="hidden"
              >
                {!isRevealing && hasSubmitted && (
                  <Box
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    bottom="0"
                    bg="blue.500"
                    opacity="0.8"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text color="white" fontWeight="black" fontSize="lg">
                      ?
                    </Text>
                  </Box>
                )}
                <Text fontSize="4xl" opacity={isRevealing && opponentMove !== move.type ? 0.3 : 1}>
                  {move.emoji}
                </Text>
              </Box>
            ))}
          </Grid>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

export default OpponentCards;