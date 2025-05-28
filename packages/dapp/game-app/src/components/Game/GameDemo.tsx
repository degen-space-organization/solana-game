// components/Game/GameDemo.tsx
import React, { useState } from 'react';
import {
  Button,
  VStack,
  Text,
  Heading,
  Card,
  Container,
} from '@chakra-ui/react';

import GameMatch from './GameMatch';
import type { MatchData } from '@/types/game';

const GameDemo: React.FC = () => {
  const [showGame, setShowGame] = useState(false);

  // Mock match data for demo purposes
  const mockMatchData: MatchData = {
    id: 1,
    status: 'in_progress',
    winner_id: null,
    participants: [
      {
        user_id: 1,
        position: 1,
        users: {
          id: 1,
          nickname: 'Player1',
          solana_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83YLv2rpjpsGR',
        },
      },
      {
        user_id: 2,
        position: 2,
        users: {
          id: 2,
          nickname: 'CryptoWarrior',
          solana_address: '4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy',
        },
      },
    ],
  };

  if (showGame) {
    return (
      <GameMatch
        matchData={mockMatchData}
        currentUserId={1}
        onLeaveMatch={() => setShowGame(false)}
      />
    );
  }

  return (
    <Container maxW="100%" p="6">
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="white"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="8"
        textAlign="center"
      >
        <Card.Body>
          <VStack align="center" padding="4">
            <Text fontSize="6xl" mb="4">🎮</Text>
            <Heading
              size="xl"
              fontWeight="black"
              color="gray.900"
              textTransform="uppercase"
              mb="4"
            >
              Rock Paper Scissors
            </Heading>
            <Text fontSize="lg" color="gray.600" mb="6">
              Experience the ultimate battle of wits and strategy!
            </Text>
            <Button
              onClick={() => setShowGame(true)}
              bg="#118AB2"
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
                bg: "#0E7FA1",
                transform: "translate(-3px, -3px)",
                shadow: "9px 9px 0px rgba(0,0,0,0.8)",
              }}
              _active={{
                transform: "translate(0px, 0px)",
                shadow: "3px 3px 0px rgba(0,0,0,0.8)",
              }}
            >
              🚀 Start Demo Game
            </Button>
          </VStack>
        </Card.Body>
      </Card.Root>
    </Container>
  );
};

export default GameDemo;