import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Card,
  Badge,
  Avatar,
  Progress,
  Spinner,
  useBreakpointValue,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { 
  Clock, 
  Users, 
  Trophy, 
  Target,
  Zap,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Tournament {
  id: number;
  name: string | null;
  status: string | null;
  max_players: number;
  current_players: number;
  prize_pool: string;
}

interface Match {
  id: number;
  status: string;
  tournament_id?: number;
}

interface WaitingTournamentProps {
  tournament?: Tournament;
  match?: Match;
}

/**
 * @function WaitingTournament
 * 
 * @description Component shown when waiting for tournament to start or match to begin
 * Displays tournament/match info and current status
 */
export default function WaitingTournament({ tournament, match }: WaitingTournamentProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const isMobile = useBreakpointValue({ base: true, md: false });

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSolAmount = (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
  };

  // Tournament waiting state
  if (tournament) {
    const progressPercentage = (tournament.current_players / tournament.max_players) * 100;
    const spotsRemaining = tournament.max_players - tournament.current_players;

    return (
      <Box p={8}>
        <VStack padding={8} align="stretch">
          {/* Main Status Card */}
          <Card.Root
            bg="bg.default"
            border="4px solid"
            borderColor="border.default"
            borderRadius="sm"
            shadow="brutalist.xl"
            transform="rotate(-0.5deg)"
            _hover={{
              transform: "rotate(0deg) scale(1.01)",
              shadow: "brutalist.2xl",
            }}
            transition="all 0.3s ease"
          >
            <Card.Body p={8} textAlign="center">
              <VStack padding={6}>
                {/* Waiting Icon */}
                <Box
                  bg="brutalist.orange"
                  color="fg.inverted"
                  p={6}
                  border="4px solid"
                  borderColor="border.default"
                  borderRadius="sm"
                  shadow="brutalist.lg"
                  transform="rotate(3deg)"
                >
                  <Clock size={64} />
                </Box>

                {/* Title and Status */}
                <VStack padding={3}>
                  <Heading 
                    size="2xl" 
                    fontWeight="black" 
                    color="fg.default" 
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    ⏳ Tournament Starting Soon
                  </Heading>
                  <Badge
                    bg="brutalist.orange"
                    color="fg.inverted"
                    fontSize="lg"
                    fontWeight="black"
                    px={4}
                    py={2}
                    borderRadius="sm"
                    border="2px solid"
                    borderColor="border.default"
                    shadow="brutalist.md"
                    textTransform="uppercase"
                  >
                    Waiting for Players
                  </Badge>
                </VStack>

                {/* Timer */}
                <Box
                  bg="primary.subtle"
                  border="3px solid"
                  borderColor="border.default"
                  p={4}
                  borderRadius="sm"
                  shadow="brutalist.md"
                >
                  <VStack padding={2}>
                    <Text fontSize="sm" fontWeight="bold" color="fg.muted" textTransform="uppercase">
                      Waiting Time
                    </Text>
                    <Text fontSize="3xl" fontWeight="black" color="primary.emphasis" fontFamily="mono">
                      {formatTime(timeElapsed)}
                    </Text>
                  </VStack>
                </Box>
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Tournament Details */}
          <Card.Root
            bg="bg.default"
            border="4px solid"
            borderColor="border.default"
            borderRadius="sm"
            shadow="brutalist.lg"
            transform="rotate(0.3deg)"
          >
            <Card.Body p={6}>
              <VStack padding={6} align="stretch">
                {/* Tournament Info */}
                <HStack padding={3} justify="center">
                  <Trophy size={24} color="var(--chakra-colors-primary-emphasis)" />
                  <Heading 
                    size="lg" 
                    fontWeight="black" 
                    color="fg.default" 
                    textTransform="uppercase"
                  >
                    {tournament.name}
                  </Heading>
                </HStack>

                {/* Progress Section */}
                <Box
                  bg="primary.subtle"
                  border="2px solid"
                  borderColor="border.default"
                  p={4}
                  borderRadius="sm"
                >
                  <VStack padding={4}>
                    <HStack justify="space-between" w="100%">
                      <Text fontSize="sm" fontWeight="bold" color="fg.default">
                        PLAYER PROGRESS
                      </Text>
                      <Text fontSize="lg" fontWeight="black" color="primary.emphasis">
                        {tournament.current_players} / {tournament.max_players}
                      </Text>
                    </HStack>
                    
                    <Progress.Root 
                      value={progressPercentage} 
                      bg="bg.muted" 
                      borderRadius="0" 
                      h="6"
                      w="100%"
                      border="2px solid"
                      borderColor="border.default"
                    >
                      <Progress.Track bg="bg.muted">
                        <Progress.Range bg="primary.emphasis" />
                      </Progress.Track>
                    </Progress.Root>

                    <HStack justify="space-between" w="100%">
                      <Text fontSize="xs" color="fg.muted" fontWeight="bold">
                        {Math.round(progressPercentage)}% FULL
                      </Text>
                      <Text fontSize="xs" color="fg.muted" fontWeight="bold">
                        {spotsRemaining} SPOTS LEFT
                      </Text>
                    </HStack>
                  </VStack>
                </Box>

                {/* Tournament Stats */}
                <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }} gap={4}>
                  <Box
                    bg="brutalist.green"
                    color="fg.inverted"
                    p={4}
                    border="2px solid"
                    borderColor="border.default"
                    borderRadius="sm"
                    textAlign="center"
                    transform="rotate(-1deg)"
                  >
                    <Text fontSize="2xl" mb={1}>💰</Text>
                    <Text fontSize="md" fontWeight="black">
                      {formatSolAmount(tournament.prize_pool)} ◎
                    </Text>
                    <Text fontSize="xs" textTransform="uppercase" fontWeight="bold">
                      Prize Pool
                    </Text>
                  </Box>

                  <Box
                    bg="brutalist.blue"
                    color="fg.inverted"
                    p={4}
                    border="2px solid"
                    borderColor="border.default"
                    borderRadius="sm"
                    textAlign="center"
                    transform="rotate(1deg)"
                  >
                    <Text fontSize="2xl" mb={1}>👥</Text>
                    <Text fontSize="md" fontWeight="black">
                      {tournament.max_players}
                    </Text>
                    <Text fontSize="xs" textTransform="uppercase" fontWeight="bold">
                      Max Players
                    </Text>
                  </Box>

                  <Box
                    bg="brutalist.purple"
                    color="fg.inverted"
                    p={4}
                    border="2px solid"
                    borderColor="border.default"
                    borderRadius="sm"
                    textAlign="center"
                    transform="rotate(-0.5deg)"
                    gridColumn={{ base: "span 2", md: "span 1" }}
                  >
                    <Text fontSize="2xl" mb={1}>🏆</Text>
                    <Text fontSize="md" fontWeight="black">
                      #{tournament.id}
                    </Text>
                    <Text fontSize="xs" textTransform="uppercase" fontWeight="bold">
                      Tournament ID
                    </Text>
                  </Box>
                </Grid>
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Status Messages */}
          <Card.Root
            bg="brutalist.yellow"
            color="fg.default"
            border="4px solid"
            borderColor="border.default"
            borderRadius="sm"
            shadow="brutalist.md"
            transform="rotate(-0.2deg)"
          >
            <Card.Body p={4}>
              <HStack justify="center" padding={3}>
                <AlertCircle size={20} />
                <Text fontSize="sm" fontWeight="bold" textAlign="center">
                  💡 Tournament will start automatically when all spots are filled!
                </Text>
              </HStack>
            </Card.Body>
          </Card.Root>
        </VStack>
      </Box>
    );
  }

  // Match waiting state
  if (match) {
    return (
      <Box p={8}>
        <VStack padding={8} align="stretch">
          {/* Match Starting Soon */}
          <Card.Root
            bg="bg.default"
            border="4px solid"
            borderColor="border.default"
            borderRadius="sm"
            shadow="brutalist.xl"
            transform="rotate(-0.3deg)"
          >
            <Card.Body p={8} textAlign="center">
              <VStack padding={6}>
                <Box
                  bg="brutalist.green"
                  color="fg.inverted"
                  p={6}
                  border="4px solid"
                  borderColor="border.default"
                  borderRadius="sm"
                  shadow="brutalist.lg"
                  transform="rotate(-2deg)"
                >
                  <Zap size={64} />
                </Box>

                <VStack padding={3}>
                  <Heading 
                    size="2xl" 
                    fontWeight="black" 
                    color="fg.default" 
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    ⚡ Match Starting Soon
                  </Heading>
                  <Text fontSize="lg" color="fg.muted" fontWeight="medium">
                    Get ready for battle! Your match is about to begin.
                  </Text>
                </VStack>

                <Box
                  bg="primary.subtle"
                  border="3px solid"
                  borderColor="border.default"
                  p={4}
                  borderRadius="sm"
                  shadow="brutalist.md"
                >
                  <VStack padding={2}>
                    <Text fontSize="sm" fontWeight="bold" color="fg.muted" textTransform="uppercase">
                      Preparing Match
                    </Text>
                    <HStack padding={3}>
                      <Spinner size="md" color="primary.emphasis" />
                      <Text fontSize="xl" fontWeight="black" color="primary.emphasis">
                        {formatTime(timeElapsed)}
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Quick Tips */}
          <Card.Root
            bg="primary.subtle"
            border="4px solid"
            borderColor="border.default"
            borderRadius="sm"
            shadow="brutalist.lg"
            transform="rotate(0.2deg)"
          >
            <Card.Body p={6}>
              <VStack padding={4}>
                <HStack padding={3}>
                  <Target size={24} color="var(--chakra-colors-primary-emphasis)" />
                  <Heading 
                    size="md" 
                    fontWeight="black" 
                    color="fg.default" 
                    textTransform="uppercase"
                  >
                    🎯 Quick Tips
                  </Heading>
                </HStack>

                <VStack padding={3} align="stretch">
                  {[
                    "🗿 Rock beats Scissors",
                    "📄 Paper beats Rock", 
                    "✂️ Scissors beats Paper",
                    "⏰ You have 20 seconds per round",
                    "🏆 Best of 5 rounds wins!"
                  ].map((tip, index) => (
                    <Box
                      key={index}
                      bg="bg.default"
                      border="2px solid"
                      borderColor="border.default"
                      p={3}
                      borderRadius="sm"
                      transform={`rotate(${index % 2 === 0 ? '-' : ''}0.5deg)`}
                    >
                      <Text fontSize="sm" fontWeight="bold" color="fg.default">
                        {tip}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              </VStack>
            </Card.Body>
          </Card.Root>
        </VStack>
      </Box>
    );
  }

  // Default state
  return (
    <Box p={8} textAlign="center">
      <VStack padding={6}>
        <Spinner size="xl" color="primary.emphasis" />
        <Text fontSize="lg" fontWeight="bold" color="fg.muted">
          Loading game information...
        </Text>
      </VStack>
    </Box>
  );
}