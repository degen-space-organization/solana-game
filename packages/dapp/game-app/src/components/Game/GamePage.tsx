import { useState, useEffect } from "react";
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Button,
  Spinner,
  Card,
  useBreakpointValue,
  Heading,
} from "@chakra-ui/react";
import { 
  Gamepad2, 
  Users, 
  Zap,
  AlertCircle 
} from 'lucide-react';

import { database } from "@/supabase/Database";
import { useWallet } from "@solana/wallet-adapter-react";

// Components
import Game from "./Game";
import NotInGame from "./NotInGame";

/**
 * @function GamePage
 * 
 * This Component represents the Game "Page"
 * It will contain the game itself and will work with the game features
 * in the context of the application
 * - rendering the game UI accordingly
 * - fetching the general user data & game participation (not handling the game / round logic)
 * - hiding / showing the UI based on the application state
 * 
 * * the actual game & game logic will be implemented
 * * in its child components, that will again be standalone
 * 
 * @returns JSX.Element representing the Game Page
 */
export default function GamePage() {
  // State Management
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMobile = useBreakpointValue({ base: true, md: false });

  useEffect(() => {
    if (publicKey && connected) {
      fetchUserParticipation();
    } else {
      setIsParticipant(false);
      setLoading(false);
    }
  }, [publicKey, connected]);

  // Fetch user participation status
  async function fetchUserParticipation() {
    try {
      setLoading(true);
      setError(null);
      const participation = await database.games.isInTournamentOrMatch(publicKey!.toBase58());
      setIsParticipant(participation);
    } catch (error) {
      console.error("Error fetching user participation:", error);
      setError("Failed to check game participation");
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <Container maxW="6xl" py={8}>
        <VStack padding={6}>
          <Spinner
            size="xl"
            color="primary.emphasis"
            // thickness="4px"
          />
          <Text
            fontSize="lg"
            fontWeight="bold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Checking Game Status...
          </Text>
        </VStack>
      </Container>
    );
  }

  // Not connected state
  if (!connected || !publicKey) {
    return (
      <Container maxW="6xl" py={8}>
        <Card.Root
          bg="brutalist.orange"
          color="fg.default"
          border="4px solid"
          borderColor="border.default"
          borderRadius="sm"
          shadow="brutalist.lg"
          transform="rotate(-0.5deg)"
        >
          <Card.Body p={8} textAlign="center">
            <VStack padding={6}>
              <Box fontSize="6xl">🎮</Box>
              <Heading 
                size="lg" 
                fontWeight="black" 
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Connect Your Wallet
              </Heading>
              <Text fontSize="md" maxW="md">
                You need to connect your Solana wallet to view and participate in games.
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container maxW="6xl" py={8}>
        <Card.Root
          bg="error"
          color="fg.inverted"
          border="4px solid"
          borderColor="border.default"
          borderRadius="sm"
          shadow="brutalist.lg"
          transform="rotate(0.3deg)"
        >
          <Card.Body p={8} textAlign="center">
            <VStack padding={6}>
              <AlertCircle size={48} />
              <Heading 
                size="lg" 
                fontWeight="black" 
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Error Loading Game
              </Heading>
              <Text fontSize="md">{error}</Text>
              <Button
                onClick={fetchUserParticipation}
                bg="fg.inverted"
                color="error"
                fontWeight="bold"
                border="2px solid"
                borderColor="fg.inverted"
                borderRadius="sm"
                shadow="brutalist.md"
                _hover={{
                  transform: "translate(-2px, -2px)",
                  shadow: "brutalist.lg",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "brutalist.sm",
                }}
                // leftIcon={<RefreshCw size={20} />}
              >
                RETRY
              </Button>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    );
  }

  return (
    <Container maxW="7xl" py={6}>
      {/* Main Game Container */}
      <Card.Root
        bg="bg.default"
        border="1px solid"
        borderColor="border.default"
        borderRadius="sm"
        shadow="brutalist.2xl"
        overflow="hidden"
      >
        {/* Game Header */}
        <Box
          bg="primary.solid"
          borderBottom="2px solid"
          borderColor="border.default"
          p={2}
        >
          <VStack padding={1}>
            {/* Title Section */}
            <HStack w="100%" justify="space-between" align="center">
              <HStack padding={1}>
                <Gamepad2 size={32} color="var(--chakra-colors-primary-emphasis)" />
                <VStack align="flex-start" >
                  <Heading 
                    size="xl" 
                    fontWeight="black" 
                    color="fg.default" 
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    Game Arena
                  </Heading>
                  <Text fontSize="md" color="fg.muted" fontWeight="medium">
                    {isParticipant ? "Active Game Session" : "Ready to Play"}
                  </Text>
                </VStack>
              </HStack>

              {/* Refresh Button */}
              <Button
                onClick={fetchUserParticipation}
                bg="primary.emphasis"
                color="fg.inverted"
                border="2px solid"
                borderColor="border.default"
                borderRadius="sm"
                shadow="brutalist.md"
                _hover={{
                  transform: "translate(-1px, -1px)",
                  shadow: "brutalist.lg",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "brutalist.sm",
                }}
                // leftIcon={<RefreshCw size={16} />}
                size={isMobile ? "sm" : "md"}
                loading={loading}
                loadingText="Checking..."
              >
                {isMobile ? '🔄' : 'REFRESH STATUS'}
              </Button>
            </HStack>

            {/* Status Info */}
            <HStack w="100%" justify="center" padding={2}>
              <HStack padding={2}>
                {isParticipant ? (
                  <Box
                    bg="brutalist.green"
                    color="fg.default"
                    px={3}
                    py={1}
                    borderRadius="sm"
                    border="2px solid"
                    borderColor="border.default"
                    shadow="brutalist.sm"
                  >
                    <HStack padding={2}>
                      <Zap size={16} />
                      <Text fontSize="sm" fontWeight="bold" textTransform="uppercase">
                        In Active Game
                      </Text>
                    </HStack>
                  </Box>
                ) : (
                  <Box
                    bg="brutalist.gray.300"
                    color="fg.default"
                    px={3}
                    py={1}
                    borderRadius="sm"
                    border="2px solid"
                    borderColor="border.default"
                    shadow="brutalist.sm"
                  >
                    <HStack padding={2}>
                      <Users size={16} />
                      <Text fontSize="sm" fontWeight="bold" textTransform="uppercase">
                        Not in Game
                      </Text>
                    </HStack>
                  </Box>
                )}
              </HStack>
            </HStack>
          </VStack>
        </Box>

        {/* Game Content */}
        <Box>
          {isParticipant ? (
            <Game />
          ) : (
            <NotInGame />
          )}
        </Box>
      </Card.Root>
    </Container>
  );
}