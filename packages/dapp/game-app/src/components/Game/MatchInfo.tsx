// components/Game/MatchInfo.tsx
import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Card,
  Badge,
  Flex,
} from '@chakra-ui/react';

interface MatchInfoProps {
  playerScore: number;
  opponentScore: number;
  playerName: string;
  opponentName: string;
  currentRound: number;
  maxRounds: number;
}

const MatchInfo: React.FC<MatchInfoProps> = ({ 
  playerScore, 
  opponentScore, 
  playerName, 
  opponentName, 
  currentRound, 
  maxRounds 
}) => {
  const renderScoreDots = (score: number, color: string) => {
    return Array.from({ length: 3 }, (_, index) => (
      <Box
        key={index}
        w="16px"
        h="16px"
        bg={index < score ? color : "gray.300"}
        border="2px solid"
        borderColor="gray.900"
        borderRadius="0"
        shadow="2px 2px 0px rgba(0,0,0,0.8)"
      />
    ));
  };

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
          <Heading
            size="md"
            fontWeight="black"
            color="gray.900"
            textTransform="uppercase"
            textAlign="center"
            mb="4"
            letterSpacing="wider"
          >
            🏆 Match Status
          </Heading>

          <Badge
            bg="#FF6B35"
            color="white"
            fontSize="sm"
            fontWeight="black"
            px="3"
            py="1"
            borderRadius="0"
            textAlign="center"
            mb="4"
          >
            Round {currentRound} | First to 3 Wins
          </Badge>

          <Flex justify="space-between" align="center">
            {/* Player Score */}
            <VStack align="center" padding="2">
              <Text
                fontSize="lg"
                fontWeight="bold"
                color="blue.700"
                textTransform="uppercase"
                mb="2"
              >
                YOU
              </Text>
              <Text fontSize="sm" color="blue.600" mb="2">
                {playerName}
              </Text>
              <HStack>{renderScoreDots(playerScore, "#059669")}</HStack>
              <Text fontSize="2xl" fontWeight="black" color="blue.700">
                {playerScore}
              </Text>
            </VStack>

            {/* VS */}
            <VStack align="center" padding="2">
              <Text fontSize="3xl" fontWeight="black" color="gray.900">
                VS
              </Text>
              <Text fontSize="sm" color="gray.600">
                Best of 5
              </Text>
            </VStack>

            {/* Opponent Score */}
            <VStack align="center" padding="2">
              <Text
                fontSize="lg"
                fontWeight="bold"
                color="red.700"
                textTransform="uppercase"
                mb="2"
              >
                OPPONENT
              </Text>
              <Text fontSize="sm" color="red.600" mb="2">
                {opponentName}
              </Text>
              <HStack>{renderScoreDots(opponentScore, "#DC2626")}</HStack>
              <Text fontSize="2xl" fontWeight="black" color="red.700">
                {opponentScore}
              </Text>
            </VStack>
          </Flex>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

export default MatchInfo;