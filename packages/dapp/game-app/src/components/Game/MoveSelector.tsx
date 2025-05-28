// components/Game/MoveSelector.tsx
import React from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Heading,
  Card,
  Badge,
  Grid,
} from '@chakra-ui/react';
import { Clock } from 'lucide-react';
import type { Move, MoveOption } from '@/types/game';

interface MoveSelectorProps {
  onMoveSelect: (move: Move) => void;
  selectedMove: Move | null;
  disabled: boolean;
  timeRemaining: number;
}

const MoveSelector: React.FC<MoveSelectorProps> = ({ 
  onMoveSelect, 
  selectedMove, 
  disabled, 
  timeRemaining 
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
              ⚔️ Choose Your Move
            </Heading>
            <Badge
              bg={timeRemaining <= 5 ? "#DC2626" : "#FF6B35"}
              color="white"
              fontSize="lg"
              fontWeight="black"
              px="3"
              py="1"
              borderRadius="0"
              display="flex"
              alignItems="center"
              gap="2"
            >
              <Clock size={16} />
              {timeRemaining}s
            </Badge>
          </HStack>

          <Grid templateColumns="repeat(3, 1fr)" gap="4">
            {moves.map((move) => (
              <Button
                key={move.type}
                onClick={() => !disabled && onMoveSelect(move.type)}
                disabled={disabled}
                bg={selectedMove === move.type ? move.color : "white"}
                color={selectedMove === move.type ? "white" : "gray.900"}
                fontWeight="black"
                fontSize="xl"
                py="8"
                px="6"
                borderRadius="0"
                border="4px solid"
                borderColor={selectedMove === move.type ? move.color : "gray.900"}
                shadow="6px 6px 0px rgba(0,0,0,0.8)"
                _hover={!disabled ? {
                  bg: selectedMove === move.type ? move.color : move.color,
                  color: "white",
                  transform: "translate(-3px, -3px)",
                  shadow: "9px 9px 0px rgba(0,0,0,0.8)",
                } : {}}
                _active={!disabled ? {
                  transform: "translate(0px, 0px)",
                  shadow: "3px 3px 0px rgba(0,0,0,0.8)",
                } : {}}
                transition="all 0.1s ease"
                display="flex"
                flexDirection="column"
                gap="2"
                opacity={disabled && selectedMove !== move.type ? 0.5 : 1}
              >
                <Text fontSize="4xl">{move.emoji}</Text>
                <Text fontSize="sm" letterSpacing="wider">
                  {move.name}
                </Text>
              </Button>
            ))}
          </Grid>

          {selectedMove && (
            <Box
              bg="green.100"
              border="3px solid"
              borderColor="green.600"
              p="4"
              mt="4"
              textAlign="center"
            >
              <Text fontSize="lg" fontWeight="bold" color="green.800">
                ✅ Move Selected: {selectedMove.toUpperCase()}
              </Text>
              <Text fontSize="sm" color="green.700" mt="1">
                Waiting for opponent...
              </Text>
            </Box>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

export default MoveSelector;