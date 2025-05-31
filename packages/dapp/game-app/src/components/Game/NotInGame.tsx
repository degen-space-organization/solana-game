import { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Card,
  Container,
  Spinner,
  useBreakpointValue,
  SimpleGrid,
} from '@chakra-ui/react';
import { Users } from 'lucide-react';
import { database } from '@/supabase/Database';

const GAME_RULES = [
  'Connect your Solana wallet to get started.',
  'Join or create a lobby, or enter a tournament.',
  'You can be in only one lobby or one game at a time.',
  'Play rock-paper-scissors against other players.',
  'Winner takes the SOL prize pool. Tournament winners are top 2 players.',
];

const ABOUT_PROJECT = [
  'Solana RPS is a decentralized rock-paper-scissors game built for fun and fair competition.',
  'Open source, community-driven, and powered by the Solana blockchain.',
  'Join our Discord or check out the code on GitHub!',
];

export default function NotInGame() {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useBreakpointValue({ base: true, md: false });

  useEffect(() => {
    async function fetchUserCount() {
      setLoading(true);
      try {
        const users = await database.users.getAll();
        setUserCount(users.length);
      } catch (e) {
        setUserCount(null);
      } finally {
        setLoading(false);
      }
    }
    fetchUserCount();
  }, []);

  return (
    <Container maxW="lg" py={8}>
      <VStack gap={6} alignItems="stretch">
        {/* Registered players one-liner */}
        <HStack justifyContent="center" alignItems="center" gap={3} mb={2}>
          <Users size={28} color="var(--chakra-colors-primary-emphasis)" />
          <Text
            fontWeight="black"
            fontSize="lg"
            color="fg.default"
            textTransform="uppercase"
          >
            Registered Players
          </Text>
          {loading ? (
            <Spinner size="sm" color="primary.emphasis" />
          ) : (
            <Text fontSize="xl" fontWeight="black" color="primary.emphasis">
              {userCount !== null ? userCount : '--'}
            </Text>
          )}
        </HStack>
        <SimpleGrid columns={isMobile ? 1 : 2} gap={4}>
          {/* How the game works */}
          <Card.Root
            bg="primary.subtle"
            border="4px solid"
            borderColor="border.default"
            borderRadius="sm"
            shadow="brutalist.lg"
          >
            <Card.Body p={5}>
              <Heading
                size="md"
                fontWeight="black"
                color="fg.default"
                mb={2}
              >
                How the Game Works
              </Heading>
              <VStack alignItems="flex-start" gap={2}>
                {GAME_RULES.map((rule, idx) => (
                  <Text key={idx} fontSize="sm" color="fg.muted">
                    {rule}
                  </Text>
                ))}
              </VStack>
            </Card.Body>
          </Card.Root>
          {/* About the project */}
          <Card.Root
            bg="bg.default"
            border="4px solid"
            borderColor="border.default"
            borderRadius="sm"
            shadow="brutalist.md"
          >
            <Card.Body p={5}>
              <Heading
                size="md"
                fontWeight="black"
                color="fg.default"
                mb={2}
              >
                About the Project
              </Heading>
              <VStack alignItems="flex-start" gap={2}>
                {ABOUT_PROJECT.map((item, idx) => (
                  <Text key={idx} fontSize="sm" color="fg.muted">
                    {item}
                  </Text>
                ))}
              </VStack>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}