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
  useDisclosure,
} from "@chakra-ui/react";

import {
  MessageCircle,
  X,
  Menu,
  ChevronLeft,
} from 'lucide-react';
import './index.css';

import { useWallet } from '@solana/wallet-adapter-react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import { database } from '@/supabase/Database';
import type { ActiveLobbyDetails, User } from './types/lobby';



// Components
import GamePage from './components/Game2/GamePage';
import Spectate from './components/Spectate/Spectate';
import LobbyJoined from './components/Lobby/LobbyJoined';
import LobbyPending from './components/Lobby/LobbyPending';
import Leaderboard from './components/Leaderboard/Leaderboard';
import LobbyDetailsPage from './components/Lobby/LobbyDetailsPage';
import GlobalChatWrapper from './components/Chat/GlobalChat';

import { toaster } from './components/ui/toaster';
import { CreateLobbyModal } from './components/Lobby/CreateLobbyModal';
import { ConnectWalletButton } from './components/Wallet/WalletConnect';







interface RankedPlayer extends User {
  net_wins: number;
  rank: 'Unranked' | 'Bronze' | 'Silver' | 'Gold' | 'Legendary';
}

const getPlayerRank = (netWins: number): 'Unranked' | 'Bronze' | 'Silver' | 'Gold' | 'Legendary' => {
  if (netWins > 20) {
    return 'Legendary';
  } else if (netWins > 15) {
    return 'Gold';
  } else if (netWins > 10) {
    return 'Silver';
  } else if (netWins > 5) {
    return 'Bronze';
  }
  return 'Unranked'; // Players with 0 to 5 net wins, or negative net wins but filtered out
};

// Function to get color scheme for rank badge
const getRankColorScheme = (rank: RankedPlayer['rank']): string => {
  switch (rank) {
    case 'Bronze':
      return 'orange'; // Or a custom bronze color
    case 'Silver':
      return 'gray'; // Or a custom silver color
    case 'Gold':
      return 'yellow'; // Or a custom gold color
    case 'Legendary':
      return 'purple'; // Or a custom legendary color
    default:
      return 'blue'; // For Unranked or other cases
  }
};


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

  const [activeSection, setActiveSection] = useState<'lobbies' | 'tournaments' | 'leaderboard' | 'joined_lobbies' | 'mygame' | 'spectate'>('lobbies');
  const [isCreateLobbyModalOpen, setIsCreateLobbyModalOpen] = useState(false);
  const { onClose: closeCreateLobbyModal } = useDisclosure();
  const [lobbiesRefreshTrigger, setLobbiesRefreshTrigger] = useState(0); // New state
  const { publicKey, connected } = useWallet();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null); // State to store user ID
  const [currentUserFromHeader, setCurrentUserFromHeader] = useState<User | null>(null); //
    const [currentUserRank, setCurrentUserRank] = useState<'Unranked' | 'Bronze' | 'Silver' | 'Gold' | 'Legendary'>('Unranked'); // New state for user rank

  const [activeLobby, setActiveLobby] = useState<ActiveLobbyDetails | null>(null);


  const navigate = useNavigate()


  useEffect(() => {
    const fetchCurrentUser = async () => {
      const walletPublicKey = window.solana?.publicKey?.toString();
      if (walletPublicKey) {
        const user = await database.users.getByWallet(walletPublicKey);
        setCurrentUserFromHeader(user);
        
        if (user) {
          const netWins = (user.matches_won ?? 0) - (user.matches_lost ?? 0);
          setCurrentUserRank(getPlayerRank(netWins)); // Calculate and set rank
        } else {
          setCurrentUserRank('Unranked');
        }

      } else {
        setCurrentUserFromHeader(null);
        setCurrentUserRank('Unranked');
      }
    };
    fetchCurrentUser();

    const provider = window.solana;
    if (provider) {
      provider.on('connect', fetchCurrentUser);
      provider.on('disconnect', () => setCurrentUserFromHeader(null));
      return () => {
        provider.removeAllListeners('connect');
        provider.removeAllListeners('disconnect');
      };
    }
  }, []);


  // Fetch the current user data from the HeaderWallet component state

  // This effect listens for changes in HeaderWallet's currentUserDb state
  useEffect(() => {
    // You'd ideally get this from a global context or a prop passed from a parent that owns HeaderWallet
    // For demonstration, let's assume you have a way to access it, e.g., via a ref or a shared state manager.
    // Since HeaderWallet is rendered directly, we might need a workaround.
    // For now, let's simulate fetching current user from DB here if needed.
    const fetchCurrentUser = async () => {
      // This is a simplified way; in a real app, you'd get the connected public key
      // and then fetch the user from your database.
      // Assuming publicKey is available from your wallet context.
      const walletPublicKey = window.solana?.publicKey?.toString();
      if (walletPublicKey) {
        const user = await database.users.getByWallet(walletPublicKey); //
        setCurrentUserFromHeader(user);
      } else {
        setCurrentUserFromHeader(null);
      }
    };
    fetchCurrentUser();

    // Re-fetch user on wallet connect/disconnect events
    const provider = window.solana;
    if (provider) {
      provider.on('connect', fetchCurrentUser);
      provider.on('disconnect', () => setCurrentUserFromHeader(null));
      return () => {
        provider.removeAllListeners('connect');
        provider.removeAllListeners('disconnect');
      };
    }
  }, []);


  const handleJoinLobby = (lobbyId: number) => {
    toaster.create({
      title: "🎮 Joining Lobby...",
      description: `Attempting to join lobby #${lobbyId}`,
      type: "loading",
      duration: 2000,
    });

    if (currentUserFromHeader) {
      fetch('http://localhost:4000/api/v1/game/join-lobby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lobby_id: lobbyId,
          user_id: currentUserFromHeader.id,
        }),
      })
        .then(response => response.json())
        .then(data => {
          if (data.error) {
            toaster.create({
              title: "Join Failed",
              description: data.error,
              type: "error",
              duration: 5000,
            });
          } else {
            toaster.create({
              title: "Success! 🎉",
              description: `Successfully joined lobby #${lobbyId}! Get ready to play!`,
              type: "success",
              duration: 4000,
            });
          }
        })
        .catch(error => {
          console.error('Error joining lobby:', error);
          toaster.create({
            title: "Network Error",
            description: "Failed to connect to game server.",
            type: "error",
            duration: 5000,
          });
        });
    } else {
      toaster.create({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to join a lobby.",
        type: "error",
        duration: 5000,
      });
    }
  };

  const handleViewLobbyDetails = (lobbyId: number) => {
    toaster.create({
      title: "🔎 Viewing Lobby",
      description: `Loading details for lobby #${lobbyId}`,
      type: "info",
      duration: 2000,
    });
    navigate(`/lobby/${lobbyId}`); // Use navigate to go to the details page
  };

  // Implement the Leave Lobby functionality
  const handleLeaveLobby = async (lobbyId: number) => {
    if (!connected || !publicKey || !currentUserId) {
      toaster.create({
        title: 'Cannot Leave Lobby',
        description: 'Wallet not connected or user data not loaded.',
        type: 'error',
        duration: 5000,
      });
      return;
    }

    toaster.create({
      title: 'Leaving Lobby',
      description: `Attempting to leave lobby ${lobbyId}...`,
      type: 'info',
      duration: 3000,
    });

    try {
      // We'll need a backend endpoint for leaving a lobby
      // Example: POST /api/v1/game/leave-lobby
      const response = await fetch('http://localhost:4000/api/v1/game/leave-lobby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lobby_id: lobbyId,
          user_id: currentUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to leave lobby');
      }

      toaster.create({
        title: 'Lobby Left!',
        description: `Successfully left lobby #${lobbyId}.`,
        type: 'success',
        duration: 4000,
      });
      setActiveLobby(null); // Clear active lobby state
      setLobbiesRefreshTrigger(prev => prev + 1); // Refresh list for others

    } catch (error: any) {
      console.error('Error leaving lobby:', error);
      toaster.create({
        title: 'Failed to Leave Lobby',
        description: error.message || 'An unexpected error occurred while leaving.',
        type: 'error',
        duration: 5000,
      });
    }
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

  const handleCreateLobby = () => {
    setIsCreateLobbyModalOpen(true);
  };

  const handleLobbyCreated = async () => {
    closeCreateLobbyModal();
    setLobbiesRefreshTrigger(prev => prev + 1); // Refresh list for others

    // After creating, fetch and set this lobby as the active lobby

    toaster.create({
      title: "Lobby Created!",
      description: "Could not load details for the new lobby.",
      type: "warning",
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
            <HStack padding={4}> {/* Use HStack to align wallet button and rank */}
              {currentUserFromHeader && currentUserRank !== 'Unranked' && (
                <Badge
                  colorScheme={getRankColorScheme(currentUserRank)}
                  variant="solid"
                  px="3"
                  py="1"
                  borderRadius="full"
                  fontSize="md"
                  fontWeight="bold"
                >
                  {currentUserRank}
                </Badge>
              )}
              <ConnectWalletButton />
            </HStack>
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

            {(['lobbies', 'joined_lobbies', 'tournaments', 'leaderboard', 'mygame', 'spectate'] as const).map((section) => (

              // {(['mygame', 'lobbies', 'tournaments', 'leaderboard'] as const).map((section) => (

              <Button
                key={section}
                onClick={() => {
                  setActiveSection(section);
                  navigate('/'); // Navigate to home route when changing sections to clear lobby details view
                }}
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
                {section === 'mygame' && '🎮 '}
                {section === 'lobbies' && '🎯 '}
                {section === 'joined_lobbies' && '🤝 '}
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

        <Routes> {/* Define your routes here */}
          <Route path="/" element={
            <>
              {/* {activeSection === 'lobbies' && ( */}
              <VStack padding="6">
                {/* Action Buttons */}
                <HStack padding="4" mb="4">


                  {/* My game section */}
                  {activeSection === 'mygame' && (
                    <Card.Root
                      borderWidth="4px"
                      borderStyle="solid"
                      borderColor="gray.900"
                      bg="white"
                      shadow="8px 8px 0px rgba(0,0,0,0.8)"
                      borderRadius="0"
                      p="12"
                      textAlign="center"
                      // transform="rotate(-0.5deg)"
                      _hover={{
                        transform: "rotate(0deg) scale(1.02)",
                        shadow: "12px 12px 0px rgba(0,0,0,0.8)",
                      }}
                      transition="all 0.2s ease"
                    >
                      <Card.Body>
                        {/* <Heading size="xl" fontWeight="black" color="gray.900" mb="6" textTransform="uppercase">
                          🎮 MY GAME
                        </Heading> */}
                        <GamePage />
                      </Card.Body>
                    </Card.Root>
                  )}

                  {activeSection === 'lobbies' && (
                    <VStack padding="6">
                      {/* Action Buttons */}
                      <HStack padding="4" mb="4">
                        <Button
                          onClick={handleCreateLobby}
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
                        {isCreateLobbyModalOpen ? (
                          <CreateLobbyModal
                            isOpen={isCreateLobbyModalOpen}
                            onClose={() => setIsCreateLobbyModalOpen(false)}
                            onLobbyCreated={handleLobbyCreated}
                            // currentUser={currentUserFromHeader} // Pass current user to modal
                          />
                        ) : (
                          <LobbyPending 
                          onJoinLobby={handleJoinLobby}
                          useMockData={false}
                          // onViewDetails={handleViewLobbyDetails}
                          />
                        )}
                      </Box>
                    </VStack>
                  )}

                  {activeSection === 'joined_lobbies' && (
                    <VStack padding="6">
                      <Box w="100%">
                        <LobbyJoined
                          onViewLobbyDetails={handleViewLobbyDetails}
                          currentUser={currentUserFromHeader}
                        />
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

                  {
                    activeSection === 'leaderboard' && <Leaderboard />
                  }

                  {activeSection === 'spectate' && (
                    <VStack padding="6">
                      <Box w="100%">
                        <Spectate />
                      </Box>
                    </VStack>
                  )}
                  
                </HStack>
              </VStack>
            </>
          } />
          <Route path="/lobby/:lobbyId" element={<LobbyDetailsPage />} /> {/* New route for Lobby Details Page */}
        </Routes>
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