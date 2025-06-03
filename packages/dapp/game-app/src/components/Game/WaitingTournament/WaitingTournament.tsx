//@ts-nocheck
import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Heading,
  Card,
  Badge,
  Progress,
  Spinner,
  useBreakpointValue,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { 
  Clock, 
  Trophy, 
  Target,
  Zap,
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
      <Container maxW="4xl" py={6}>
        <VStack padding={6} align="stretch">
          {/* Main Status Card */}
          <Card.Root
            bg="bg.default"
            border="1px solid"
            borderColor="border.default"
            borderRadius="sm"
            shadow="brutalist.lg"
            overflow="hidden"
          >
            {/* Header */}
            <Box
              bg="brutalist.orange"
              borderBottom="2px solid"
              borderColor="border.default"
              p={4}
            >
              <VStack spacing={2}>
                <HStack spacing={3}>
                  <Clock size={24} color="var(--chakra-colors-fg-inverted)" />
                  <Heading 
                    size="lg" 
                    fontWeight="black" 
                    color="fg.inverted" 
                    textTransform="uppercase"
                  >
                    Tournament Starting Soon
                  </Heading>
                </HStack>
                <Badge
                  bg="fg.inverted"
                  color="brutalist.orange"
                  fontSize="sm"
                  fontWeight="bold"
                  px={3}
                  py={1}
                  borderRadius="sm"
                  textTransform="uppercase"
                >
                  Waiting for Players
                </Badge>
              </VStack>
            </Box>

            {/* Content */}
            <Box bg="bg.default" p={6}>
              <VStack spacing={6}>
                {/* Tournament Name */}
                <Box textAlign="center">
                  <HStack justify="center" spacing={2} mb={2}>
                    <Trophy size={20} color="var(--chakra-colors-primary-emphasis)" />
                    <Text 
                      fontSize="xl" 
                      fontWeight="bold" 
                      color="fg.default"
                    >
                      {tournament.name}
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                    Tournament #{tournament.id}
                  </Text>
                </Box>

                {/* Timer */}
                <Box
                  bg="bg.subtle"
                  border="1px solid"
                  borderColor="border.default"
                  p={4}
                  borderRadius="sm"
                  textAlign="center"
                  w="100%"
                >
                  <Text fontSize="sm" fontWeight="bold" color="fg.muted" textTransform="uppercase" mb={2}>
                    Waiting Time
                  </Text>
                  <Text fontSize="2xl" fontWeight="black" color="primary.emphasis" fontFamily="mono">
                    {formatTime(timeElapsed)}
                  </Text>
                </Box>

                {/* Progress Section */}
                <Box w="100%">
                  <HStack justify="space-between" mb={3}>
                    <Text fontSize="sm" fontWeight="bold" color="fg.default" textTransform="uppercase">
                      Player Progress
                    </Text>
                    <Text fontSize="lg" fontWeight="bold" color="primary.emphasis">
                      {tournament.current_players} / {tournament.max_players}
                    </Text>
                  </HStack>
                  
                  <Progress.Root 
                    value={progressPercentage} 
                    bg="bg.muted" 
                    borderRadius="sm" 
                    h="4"
                    w="100%"
                    border="1px solid"
                    borderColor="border.default"
                    mb={2}
                  >
                    <Progress.Track bg="bg.muted">
                      <Progress.Range bg="primary.emphasis" />
                    </Progress.Track>
                  </Progress.Root>

                  <HStack justify="space-between">
                    <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                      {Math.round(progressPercentage)}% Full
                    </Text>
                    <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                      {spotsRemaining} spots remaining
                    </Text>
                  </HStack>
                </Box>

                {/* Tournament Stats */}
                <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }} gap={4} w="100%">
                  <GridItem>
                    <Box
                      bg="brutalist.green"
                      color="fg.inverted"
                      p={4}
                      border="1px solid"
                      borderColor="border.default"
                      borderRadius="sm"
                      textAlign="center"
                    >
                      <Text fontSize="lg" fontWeight="bold" mb={1}>
                        {formatSolAmount(tournament.prize_pool)} ◎
                      </Text>
                      <Text fontSize="xs" textTransform="uppercase" fontWeight="bold">
                        Prize Pool
                      </Text>
                    </Box>
                  </GridItem>

                  <GridItem>
                    <Box
                      bg="brutalist.blue"
                      color="fg.inverted"
                      p={4}
                      border="1px solid"
                      borderColor="border.default"
                      borderRadius="sm"
                      textAlign="center"
                    >
                      <Text fontSize="lg" fontWeight="bold" mb={1}>
                        {tournament.max_players}
                      </Text>
                      <Text fontSize="xs" textTransform="uppercase" fontWeight="bold">
                        Max Players
                      </Text>
                    </Box>
                  </GridItem>

                  <GridItem gridColumn={{ base: "span 2", md: "span 1" }}>
                    <Box
                      bg="primary.emphasis"
                      color="fg.inverted"
                      p={4}
                      border="1px solid"
                      borderColor="border.default"
                      borderRadius="sm"
                      textAlign="center"
                    >
                      <Text fontSize="lg" fontWeight="bold" mb={1}>
                        {tournament.status?.toUpperCase()}
                      </Text>
                      <Text fontSize="xs" textTransform="uppercase" fontWeight="bold">
                        Status
                      </Text>
                    </Box>
                  </GridItem>
                </Grid>
              </VStack>
            </Box>
          </Card.Root>

          {/* Info Banner */}
          <Card.Root
            bg="brutalist.yellow"
            color="fg.default"
            border="1px solid"
            borderColor="border.default"
            borderRadius="sm"
          >
            <Card.Body p={4}>
              <HStack justify="center" spacing={3}>
                <AlertCircle size={20} />
                <Text fontSize="sm" fontWeight="medium" textAlign="center">
                  Tournament will start automatically when all spots are filled
                </Text>
              </HStack>
            </Card.Body>
          </Card.Root>
        </VStack>
      </Container>
    );
  }

  // Match waiting state
  if (match) {
    return (
      <Container maxW="4xl" py={6}>
        <VStack spacing={6} align="stretch">
          {/* Match Starting Soon */}
          <Card.Root
            bg="bg.default"
            border="1px solid"
            borderColor="border.default"
            borderRadius="sm"
            shadow="brutalist.lg"
            overflow="hidden"
          >
            {/* Header */}
            <Box
              bg="brutalist.green"
              borderBottom="2px solid"
              borderColor="border.default"
              p={4}
            >
              <VStack spacing={2}>
                <HStack spacing={3}>
                  <Zap size={24} color="var(--chakra-colors-fg-inverted)" />
                  <Heading 
                    size="lg" 
                    fontWeight="black" 
                    color="fg.inverted" 
                    textTransform="uppercase"
                  >
                    Match Starting Soon
                  </Heading>
                </HStack>
                <Text fontSize="sm" color="fg.inverted" fontWeight="medium" textAlign="center">
                  Get ready for battle! Your match is about to begin.
                </Text>
              </VStack>
            </Box>

            {/* Content */}
            <Box bg="bg.default" p={6}>
              <VStack spacing={6}>
                {/* Timer */}
                <Box
                  bg="bg.subtle"
                  border="1px solid"
                  borderColor="border.default"
                  p={6}
                  borderRadius="sm"
                  textAlign="center"
                  w="100%"
                >
                  <HStack justify="center" spacing={3} mb={3}>
                    <Spinner size="md" color="primary.emphasis" />
                    <Text fontSize="sm" fontWeight="bold" color="fg.muted" textTransform="uppercase">
                      Preparing Match
                    </Text>
                  </HStack>
                  <Text fontSize="2xl" fontWeight="black" color="primary.emphasis" fontFamily="mono">
                    {formatTime(timeElapsed)}
                  </Text>
                </Box>

                {/* Match Info */}
                <Box
                  bg="primary.subtle"
                  border="1px solid"
                  borderColor="border.default"
                  p={4}
                  borderRadius="sm"
                  w="100%"
                  textAlign="center"
                >
                  <Text fontSize="lg" fontWeight="bold" color="fg.default" mb={2}>
                    Match #{match.id}
                  </Text>
                  <Badge
                    bg="primary.emphasis"
                    color="fg.inverted"
                    fontSize="sm"
                    fontWeight="bold"
                    px={3}
                    py={1}
                    borderRadius="sm"
                    textTransform="uppercase"
                  >
                    {match.status}
                  </Badge>
                </Box>
              </VStack>
            </Box>
          </Card.Root>

          {/* Game Rules */}
          <Card.Root
            bg="bg.default"
            border="1px solid"
            borderColor="border.default"
            borderRadius="sm"
            shadow="brutalist.md"
          >
            <Box
              bg="primary.solid"
              borderBottom="2px solid"
              borderColor="border.default"
              p={3}
            >
              <HStack justify="center" spacing={2}>
                <Target size={20} color="var(--chakra-colors-fg-inverted)" />
                <Text 
                  fontSize="md" 
                  fontWeight="bold" 
                  color="fg.inverted" 
                  textTransform="uppercase"
                >
                  Game Rules
                </Text>
              </HStack>
            </Box>
            
            <Box bg="bg.default" p={4}>
              <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={3}>
                {[
                  { icon: "⏰", text: "30 seconds per round" },
                  { icon: "🏆", text: "First to score 3 rounds wins" },
                  { icon: "⚡", text: "Missing a move = auto-loss" },
                  { icon: "🗿", text: "Both miss a move - player 1 wins" },
                ].map((rule, index) => (
                  <Box
                    key={index}
                    bg="bg.subtle"
                    border="1px solid"
                    borderColor="border.subtle"
                    p={3}
                    borderRadius="sm"
                  >
                    <HStack spacing={2}>
                      <Text fontSize="md">{rule.icon}</Text>
                      <Text fontSize="sm" fontWeight="medium" color="fg.default">
                        {rule.text}
                      </Text>
                    </HStack>
                  </Box>
                ))}
              </Grid>
            </Box>
          </Card.Root>
        </VStack>
      </Container>
    );
  }

  // Default loading state
  return (
    <Container maxW="4xl" py={6}>
      <Card.Root
        bg="bg.default"
        border="1px solid"
        borderColor="border.default"
        borderRadius="sm"
        shadow="brutalist.lg"
      >
        <Card.Body p={8} textAlign="center">
          <VStack spaceX={4}>
            <Spinner size="xl" color="primary.emphasis" />
            <Text fontSize="lg" fontWeight="bold" color="fg.muted">
              Loading game information...
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Please wait while we prepare your match...
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    </Container>
  );
}