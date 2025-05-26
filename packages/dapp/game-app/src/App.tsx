// src/App.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  VStack,
  HStack,
  Text,
  Heading,
  Drawer,
  IconButton,
  Badge,
  Card,
  Container,
  Spinner,
} from "@chakra-ui/react";
import {
  MessageCircle,
  X,
  Menu,
  Wallet,
  RefreshCw,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toaster } from './components/ui/toaster';
import './index.css';

// Import your existing components
import LobbyPending from './components/Lobby/LobbyPending';
import ChatExample from './components/Chat';
import { database } from '@/supabase/Database';
import { ConnectWalletButton } from './components/Wallet/WalletConnect';
import GlobalChatWrapper from './components/Chat/GlobalChat';

// Types for wallet
interface PhantomWallet {
  isPhantom: boolean;
  publicKey: { toString(): string } | null;
  isConnected: boolean;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  on(event: string, handler: (...args: any[]) => void): void;
  removeAllListeners(event: string): void;
}

declare global {
  interface Window {
    solana?: PhantomWallet;
  }
}

// Enhanced Wallet Component for Header
const HeaderWallet: React.FC = () => {
  const [wallet, setWallet] = useState<PhantomWallet | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [currentUserDb, setCurrentUserDb] = useState<any>(null);

  const getProvider = (): PhantomWallet | null => {
    if ('solana' in window) {
      const provider = window.solana;
      if (provider?.isPhantom) {
        return provider;
      }
    }
    return null;
  };

  const connectWallet = async (): Promise<void> => {
    const provider = getProvider();
    if (!provider) {
      toaster.create({
        title: "Wallet Not Found",
        description: "Please install Phantom wallet to continue",
        type: "error",
        duration: 5000,
      });
      return;
    }

    try {
      setLoading(true);
      const response = await provider.connect();
      const pubKeyString = response.publicKey.toString();

      setWallet(provider);
      setPublicKey(pubKeyString);
      setConnected(true);

      localStorage.removeItem('walletExplicitlyDisconnected');
      await getBalance(pubKeyString);

      // Create/get user in database
      try {
        const userData = await database.users.createUser(pubKeyString);
        setCurrentUserDb(userData || null);
      } catch (dbError) {
        console.error('Database error:', dbError);
      }

      toaster.create({
        title: "Wallet Connected! 🎉",
        description: "Successfully connected to Phantom wallet",
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error('Connection failed:', error);
      toaster.create({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async (): Promise<void> => {
    if (wallet) {
      try {
        await wallet.disconnect();
        setWallet(null);
        setConnected(false);
        setPublicKey(null);
        setBalance(null);
        setCurrentUserDb(null);
        localStorage.setItem('walletExplicitlyDisconnected', 'true');

        toaster.create({
          title: "Wallet Disconnected",
          description: "Successfully disconnected from wallet",
          type: "info",
          duration: 3000,
        });
      } catch (error) {
        console.error('Disconnect failed:', error);
      }
    }
  };

  const getBalance = async (pubKey: string): Promise<void> => {
    try {
      const response = await fetch(`http://localhost:3001/get-balance/${pubKey}`);
      const data = await response.json();
      setBalance(data.balance.toFixed(4));
    } catch (error) {
      console.error('Error fetching balance:', error);
      // Fallback to mock balance for demo
      setBalance("1.2345");
    }
  };

  const copyPublicKey = async (): Promise<void> => {
    if (publicKey) {
      try {
        await navigator.clipboard.writeText(publicKey);
        toaster.create({
          title: "Copied! 📋",
          description: "Public key copied to clipboard",
          type: "success",
          duration: 2000,
        });
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  const formatPublicKey = (key: string | null): string => {
    if (!key) return '';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  // Auto-connect on load
  useEffect(() => {
    const initializeWallet = async () => {
      const provider = getProvider();
      if (!provider) {
        setInitializing(false);
        return;
      }

      const explicitlyDisconnected = localStorage.getItem('walletExplicitlyDisconnected');
      if (explicitlyDisconnected === 'true') {
        setInitializing(false);
        return;
      }

      try {
        const response = await provider.connect({ onlyIfTrusted: true });
        if (response.publicKey) {
          const pubKeyString = response.publicKey.toString();
          setWallet(provider);
          setPublicKey(pubKeyString);
          setConnected(true);
          await getBalance(pubKeyString);

          try {
            const userData = await database.users.createUser(pubKeyString);
            setCurrentUserDb(userData || null);
          } catch (dbError) {
            console.error('Database error:', dbError);
          }
        }
      } catch (error) {
        console.log('No trusted connection available');
      } finally {
        setInitializing(false);
      }
    };

    initializeWallet();
  }, []);

  if (initializing) {
    return (
      <Card.Root
        borderWidth="3px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="white"
        shadow="4px 4px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="4"
      >
        <Card.Body p="0">
          <HStack>
            <Spinner size="sm" color="blue.500" />
            <Text fontSize="sm" fontWeight="bold" color="gray.600">
              Initializing...
            </Text>
          </HStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (!connected) {
    return (
      <Button
        onClick={connectWallet}
        disabled={loading}
        bg="#7B2CBF"
        color="white"
        fontWeight="black"
        fontSize="md"
        px="6"
        py="3"
        borderRadius="0"
        border="3px solid"
        borderColor="gray.900"
        shadow="4px 4px 0px rgba(0,0,0,0.8)"
        _hover={!loading ? {
          bg: "#6A1B9A",
          transform: "translate(-2px, -2px)",
          shadow: "6px 6px 0px rgba(0,0,0,0.8)",
        } : {}}
        _active={!loading ? {
          transform: "translate(0px, 0px)",
          shadow: "2px 2px 0px rgba(0,0,0,0.8)",
        } : {}}
        transition="all 0.1s ease"
      >
        {loading ? (
          <HStack>
            <RefreshCw size={18} className="animate-spin" />
            <Text>Connecting...</Text>
          </HStack>
        ) : (
          <HStack>
            <Wallet size={18} />
            <Text>Connect Wallet</Text>
          </HStack>
        )}
      </Button>
    );
  }

  return (
    <Card.Root
      borderWidth="3px"
      borderStyle="solid"
      borderColor="gray.900"
      bg="white"
      shadow="4px 4px 0px rgba(0,0,0,0.8)"
      borderRadius="0"
      p="4"
      minW="280px"
    >
      <Card.Body p="0">
        <VStack align="stretch" padding="3">
          <HStack justify="space-between">
            <VStack align="start" padding="0">
              <Text fontSize="xs" fontWeight="bold" color="gray.600" textTransform="uppercase">
                Connected Wallet
              </Text>
              <Text fontSize="sm" fontWeight="black" color="gray.900" fontFamily="mono">
                {formatPublicKey(publicKey)}
              </Text>
            </VStack>
            <Badge
              bg="#06D6A0"
              color="white"
              fontSize="xs"
              fontWeight="black"
              px="2"
              py="1"
              borderRadius="0"
              textTransform="uppercase"
            >
              Online
            </Badge>
          </HStack>

          <Box
            bg="yellow.100"
            border="2px solid"
            borderColor="yellow.600"
            p="2"
            borderRadius="0"
          >
            <HStack justify="space-between" align="center">
              <VStack align="start" padding="0">
                <Text fontSize="xs" fontWeight="bold" color="yellow.800" textTransform="uppercase">
                  SOL Balance
                </Text>
                <Text fontSize="lg" fontWeight="black" color="yellow.900">
                  {balance ? `${balance} SOL` : 'Loading...'}
                </Text>
              </VStack>

              <HStack>
                <IconButton
                  onClick={() => publicKey && getBalance(publicKey)}
                  bg="transparent"
                  _hover={{ bg: "yellow.200" }}
                  _active={{ bg: "yellow.300" }}
                  border="2px solid"
                  borderColor="yellow.600"
                  borderRadius="0"
                  shadow="2px 2px 0px rgba(0,0,0,0.8)"
                  size="sm"
                >
                  <RefreshCw size={14} />
                </IconButton>

                <IconButton
                  onClick={copyPublicKey}
                  bg="transparent"
                  _hover={{ bg: "yellow.200" }}
                  _active={{ bg: "yellow.300" }}
                  border="2px solid"
                  borderColor="yellow.600"
                  borderRadius="0"
                  shadow="2px 2px 0px rgba(0,0,0,0.8)"
                  size="sm"
                >
                  <Copy size={14} />
                </IconButton>

                <IconButton
                  onClick={disconnectWallet}
                  bg="#DC143C"
                  color="white"
                  _hover={{ bg: "#B01030" }}
                  _active={{ bg: "#8B0000" }}
                  border="2px solid"
                  borderColor="gray.900"
                  borderRadius="0"
                  shadow="2px 2px 0px rgba(0,0,0,0.8)"
                  size="sm"
                >
                  <X size={14} />
                </IconButton>
              </HStack>
            </HStack>
          </Box>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

// Chat Drawer Component  
const ChatDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(details) => !details.open && onClose()}
      size="lg"
      placement="start"
    >
      <Drawer.Backdrop bg="rgba(0,0,0,0.5)" />
      <Drawer.Positioner>
        <Drawer.Content
          bg="white"
          border="4px solid"
          borderColor="gray.900"
          borderRadius="0"
          shadow="12px 0px 0px rgba(0,0,0,0.8)"
          h="100vh"
          w="420px"
        >
          <Drawer.Header
            p="4"
            borderBottom="4px solid"
            borderColor="gray.900"
            bg="gray.900"
            color="white"
          >
            <HStack justify="space-between">
              <HStack>
                <MessageCircle size={24} color="#FF6B35" />
                <Heading size="md" fontWeight="black" textTransform="uppercase" letterSpacing="wider">
                  💬 Game Chat
                </Heading>
              </HStack>
              <Drawer.CloseTrigger asChild>
                <IconButton
                  bg="transparent"
                  color="white"
                  _hover={{ bg: "gray.800" }}
                  _active={{ bg: "gray.700" }}
                  border="2px solid"
                  borderColor="gray.600"
                  borderRadius="0"
                  shadow="2px 2px 0px rgba(0,0,0,0.5)"
                >
                  <X size={20} />
                </IconButton>
              </Drawer.CloseTrigger>
            </HStack>
          </Drawer.Header>

          <Drawer.Body p="0" overflow="hidden" h="calc(100vh - 80px)">
            <Box h="100%">
              <GlobalChatWrapper />
            </Box>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
};

// Main App Component
function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'lobbies' | 'tournaments' | 'leaderboard'>('lobbies');

  const handleJoinLobby = (lobbyId: number) => {
    toaster.create({
      title: "🎮 Joining Lobby...",
      description: `Attempting to join lobby #${lobbyId}`,
      type: "loading",
      duration: 2000,
    });

    setTimeout(() => {
      toaster.create({
        title: "Success! 🎉",
        description: `Successfully joined lobby #${lobbyId}! Get ready to play!`,
        type: "success",
        duration: 4000,
      });
    }, 1500);
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const createNewGame = () => {
    toaster.create({
      title: "🚀 Feature Coming Soon",
      description: "Create lobby functionality will be available soon! Stay tuned!",
      type: "info",
      duration: 4000,
    });
  };

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Box
        bg="white"
        borderBottom="4px solid"
        borderColor="gray.900"
        shadow="0px 4px 0px rgba(0,0,0,0.8)"
        position="sticky"
        top="0"
        zIndex="sticky"
      >
        <Container maxW="100%" p="4">
          <Flex justify="space-between" align="center">
            {/* Left side - Chat Toggle and Title */}
            <HStack padding="4">
              <Button
                onClick={toggleChat}
                bg="#FF6B35"
                color="white"
                fontWeight="black"
                fontSize="lg"
                px="4"
                py="3"
                borderRadius="0"
                border="3px solid"
                borderColor="gray.900"
                shadow="4px 4px 0px rgba(0,0,0,0.8)"
                _hover={{
                  bg: "#E55A2B",
                  transform: "translate(-2px, -2px)",
                  shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "2px 2px 0px rgba(0,0,0,0.8)",
                }}
                transition="all 0.1s ease"
              >
                <HStack>
                  {isChatOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
                  <Text>{isChatOpen ? 'Close Chat' : 'Open Chat'}</Text>
                </HStack>
              </Button>

              <Heading
                size="2xl"
                fontWeight="black"
                color="gray.900"
                textTransform="uppercase"
                letterSpacing="tight"
                textShadow="3px 3px 0px rgba(255,107,53,0.3)"
                ml="4"
              >
                🎮 Solana Game
              </Heading>

            </HStack>

            {/* Right side - Wallet */}
            <ConnectWalletButton />
          </Flex>
        </Container>
      </Box>

      {/* Navigation */}
      <Box
        bg="gray.900"
        color="white"
        py="4"
        borderBottom="4px solid"
        borderColor="gray.700"
        shadow="0px 4px 0px rgba(0,0,0,0.5)"
      >
        <Container maxW="100%">
          <HStack padding="2" justify="center">
            {(['lobbies', 'tournaments', 'leaderboard'] as const).map((section) => (
              <Button
                key={section}
                onClick={() => setActiveSection(section)}
                bg={activeSection === section ? "#118AB2" : "transparent"}
                color="white"
                fontWeight="black"
                fontSize="md"
                px="8"
                py="3"
                borderRadius="0"
                border="3px solid"
                borderColor={activeSection === section ? "#118AB2" : "gray.600"}
                shadow={activeSection === section ? "4px 4px 0px rgba(0,0,0,0.5)" : "none"}
                _hover={{
                  bg: activeSection === section ? "#0E7FA1" : "gray.800",
                  border: "3px solid",
                  borderColor: "#118AB2",
                  transform: activeSection !== section ? "translate(-1px, -1px)" : undefined,
                  shadow: "3px 3px 0px rgba(0,0,0,0.5)",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "2px 2px 0px rgba(0,0,0,0.5)",
                }}
                transition="all 0.1s ease"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                {section === 'lobbies' && '🎯 '}
                {section === 'tournaments' && '🏆 '}
                {section === 'leaderboard' && '👑 '}
                {section.replace('_', ' ')}
              </Button>
            ))}
          </HStack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="100%" p="6">
        {activeSection === 'lobbies' && (
          <VStack padding="6">
            {/* Action Buttons */}
            <HStack padding="4" mb="4">
              <Button
                onClick={createNewGame}
                bg="#06D6A0"
                color="white"
                fontWeight="black"
                fontSize="xl"
                textTransform="uppercase"
                letterSpacing="wider"
                borderRadius="0"
                border="4px solid"
                borderColor="gray.900"
                shadow="6px 6px 0px rgba(0,0,0,0.8)"
                _hover={{
                  bg: "#04C28D",
                  transform: "translate(-3px, -3px)",
                  shadow: "9px 9px 0px rgba(0,0,0,0.8)",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "3px 3px 0px rgba(0,0,0,0.8)",
                }}
                size="lg"
                px="12"
                py="6"
              >
                🚀 Create New Game
              </Button>

              <Button
                onClick={() => window.location.reload()}
                bg="#7B2CBF"
                color="white"
                fontWeight="black"
                fontSize="xl"
                textTransform="uppercase"
                letterSpacing="wider"
                borderRadius="0"
                border="4px solid"
                borderColor="gray.900"
                shadow="6px 6px 0px rgba(0,0,0,0.8)"
                _hover={{
                  bg: "#6A1B9A",
                  transform: "translate(-3px, -3px)",
                  shadow: "9px 9px 0px rgba(0,0,0,0.8)",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "3px 3px 0px rgba(0,0,0,0.8)",
                }}
                size="lg"
                px="12"
                py="6"
              >
                🔄 Refresh Games
              </Button>
            </HStack>

            {/* Lobbies List */}
            <Box w="100%">
              <LobbyPending onJoinLobby={handleJoinLobby} useMockData={false} />
            </Box>
          </VStack>
        )}

        {activeSection === 'tournaments' && (
          <Card.Root
            borderWidth="4px"
            borderStyle="solid"
            borderColor="gray.900"
            bg="white"
            shadow="8px 8px 0px rgba(0,0,0,0.8)"
            borderRadius="0"
            p="12"
            textAlign="center"
            transform="rotate(-0.5deg)"
            _hover={{
              transform: "rotate(0deg) scale(1.02)",
              shadow: "12px 12px 0px rgba(0,0,0,0.8)",
            }}
            transition="all 0.2s ease"
          >
            <Card.Body>
              <Heading size="xl" fontWeight="black" color="gray.900" mb="6" textTransform="uppercase">
                🏆 TOURNAMENTS
              </Heading>
              <Text fontSize="xl" color="gray.600" mb="4">
                Tournament brackets coming soon!
              </Text>
              <Text fontSize="md" color="gray.500">
                Get ready for epic multi-player competitions with prize pools!
              </Text>
            </Card.Body>
          </Card.Root>
        )}

        {activeSection === 'leaderboard' && (
          <Card.Root
            borderWidth="4px"
            borderStyle="solid"
            borderColor="gray.900"
            bg="white"
            shadow="8px 8px 0px rgba(0,0,0,0.8)"
            borderRadius="0"
            p="12"
            textAlign="center"
            transform="rotate(0.5deg)"
            _hover={{
              transform: "rotate(0deg) scale(1.02)",
              shadow: "12px 12px 0px rgba(0,0,0,0.8)",
            }}
            transition="all 0.2s ease"
          >
            <Card.Body>
              <Heading size="xl" fontWeight="black" color="gray.900" mb="6" textTransform="uppercase">
                👑 LEADERBOARD
              </Heading>
              <Text fontSize="xl" color="gray.600" mb="4">
                Player rankings coming soon!
              </Text>
              <Text fontSize="md" color="gray.500">
                See who's dominating the Solana gaming scene!
              </Text>
            </Card.Body>
          </Card.Root>
        )}
      </Container>

      {/* Chat Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* Floating Chat Button (when drawer is closed) */}
      {!isChatOpen && (
        <Box
          position="fixed"
          bottom="8"
          left="8"
          zIndex="overlay"
        >
          <Button
            onClick={toggleChat}
            bg="#118AB2"
            color="white"
            fontWeight="black"
            fontSize="lg"
            p="4"
            borderRadius="full"
            border="4px solid"
            borderColor="gray.900"
            shadow="8px 8px 0px rgba(0,0,0,0.8)"
            _hover={{
              bg: "#0E7FA1",
              transform: "translate(-4px, -4px)",
              shadow: "12px 12px 0px rgba(0,0,0,0.8)",
            }}
            _active={{
              transform: "translate(0px, 0px)",
              shadow: "4px 4px 0px rgba(0,0,0,0.8)",
            }}
            transition="all 0.1s ease"
            width="20"
            height="20"
          >
            <MessageCircle size={28} />
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default App;