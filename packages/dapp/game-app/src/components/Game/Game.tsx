// components/Game/Game.tsx
import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Card,
  Button,
  HStack,
} from '@chakra-ui/react';
import { Gamepad2, ArrowLeft } from 'lucide-react';
import GameInfo from './GameInfo';

export interface IGameProps {
  user: {
    id: string;
    nickname: string;
    walletAddress: string;
  };
  onExitGame?: () => void; // Optional callback to handle exiting the game
}

export default function Game({ onExitGame }: { onExitGame?: () => void }) {
  // #region State
  const { publicKey } = useWallet();
  const [user, setUser] = React.useState<IGameProps['user'] | null>(null);
  
  // Get wallet address as string
  const walletAddress = publicKey ? publicKey.toBase58() : null;
  
  // #endregion State

  // #region Effects
  React.useEffect(() => {
    // You can fetch user details here if needed
    // For now, we'll rely on the GameInfo component to handle user data
    if (walletAddress) {
      // Set basic user info if available
      setUser({
        id: walletAddress, // Using wallet address as temp ID
        nickname: '', // This would be fetched from your database
        walletAddress: walletAddress,
      });
    }
  }, [walletAddress]);
  
  // #endregion Effects

  // #region Handlers
  const handleExitGame = () => {
    if (onExitGame) {
      onExitGame();
    } else {
      // Default behavior - you might want to navigate back to lobby list
      console.log('Exiting game...');
    }
  };

  const handleRefreshGame = () => {
    // This will be handled by the GameInfo component's internal refresh
    console.log('Refreshing game state...');
  };
  
  // #endregion Handlers

  // Check if wallet is connected
  if (!walletAddress) {
    return (
      <Container maxW="100%" p="6">
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="red.500"
          bg="red.50"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          p="8"
          textAlign="center"
        >
          <Card.Body>
            <VStack align="center" padding="4">
              <Gamepad2 size={48} color="#DC2626" />
              <Heading
                size="xl"
                fontWeight="black"
                color="red.600"
                textTransform="uppercase"
                mb="2"
              >
                🔒 Wallet Required
              </Heading>
              <Text fontSize="lg" color="red.500" mb="4">
                Please connect your wallet to access the game
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50" py="6">
      <Container maxW="100%">
        <VStack align="stretch" padding="4">
          {/* Header */}
          <Card.Root
            borderWidth="4px"
            borderStyle="solid"
            borderColor="gray.900"
            bg="white"
            shadow="8px 8px 0px rgba(0,0,0,0.8)"
            borderRadius="0"
            mb="6"
          >
            <Card.Body p="6">
              <HStack justify="space-between" align="center">
                <HStack>
                  <Gamepad2 size={32} color="#FF6B35" />
                  <VStack align="flex-start" padding="0">
                    <Heading
                      size="xl"
                      fontWeight="black"
                      color="gray.900"
                      textTransform="uppercase"
                      letterSpacing="tight"
                    >
                      🎮 Game Arena
                    </Heading>
                    <Text fontSize="sm" color="gray.600">
                      Connected: {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                    </Text>
                  </VStack>
                </HStack>

                <HStack>
                  <Button
                    onClick={handleRefreshGame}
                    bg="#118AB2"
                    color="white"
                    fontWeight="black"
                    fontSize="sm"
                    px="4"
                    py="2"
                    borderRadius="0"
                    border="3px solid"
                    borderColor="gray.900"
                    shadow="4px 4px 0px rgba(0,0,0,0.8)"
                    textTransform="uppercase"
                    _hover={{
                      bg: "#0E7FA1",
                      transform: "translate(-2px, -2px)",
                      shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                    }}
                    _active={{
                      transform: "translate(0px, 0px)",
                      shadow: "2px 2px 0px rgba(0,0,0,0.8)",
                    }}
                  >
                    🔄 Refresh
                  </Button>

                  {onExitGame && (
                    <Button
                      onClick={handleExitGame}
                      bg="#DC2626"
                      color="white"
                      fontWeight="black"
                      fontSize="sm"
                      px="4"
                      py="2"
                      borderRadius="0"
                      border="3px solid"
                      borderColor="gray.900"
                      shadow="4px 4px 0px rgba(0,0,0,0.8)"
                      textTransform="uppercase"
                      _hover={{
                        bg: "#B91C1C",
                        transform: "translate(-2px, -2px)",
                        shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                      }}
                      _active={{
                        transform: "translate(0px, 0px)",
                        shadow: "2px 2px 0px rgba(0,0,0,0.8)",
                      }}
                    >
                      <ArrowLeft size={16} />
                      <Text ml="2">Exit Game</Text>
                    </Button>
                  )}
                </HStack>
              </HStack>
            </Card.Body>
          </Card.Root>

          {/* Game Information Section */}
          <Box mb="6">
            <GameInfo userWalletAddress={walletAddress} />
          </Box>



        </VStack>
      </Container>
    </Box>
  );
}

export { GameInfo };