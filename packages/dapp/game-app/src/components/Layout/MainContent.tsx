// src/components/Layout/MainContent.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  VStack,
  Card,
  Heading,
  Text,
} from "@chakra-ui/react";
// import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { Gamepad2 } from 'lucide-react';

// Components
import LobbyPending from '../Lobby/LobbyPending';
import Leaderboard from '../Leaderboard/Leaderboard';
import Spectate from '../Spectate/Spectate';
import { CreateLobbyModal } from '../Lobby/CreateLobbyModal';

// Utils
import { toaster } from '../ui/toaster';
import { database } from '@/supabase/Database';
import type { User } from '../../types/lobby';
import type { SectionType } from '../../App';
import MyLobby from '../Lobby/MyLobby';
import GamePage from '../Game/GamePage';
import { supabase } from '@/supabase';

interface MainContentProps {
  activeSection: SectionType;
  currentUser: User | null;
  onJoinLobby: (lobbyId: number) => void;
  onSectionChange: (section: SectionType) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  activeSection,
  // currentUser,
  onJoinLobby,
  onSectionChange
}) => {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isCreateLobbyModalOpen, setIsCreateLobbyModalOpen] = useState(false);
  const [lobbiesRefreshTrigger, setLobbiesRefreshTrigger] = useState(0);
  const [isUserInLobby, setIsUserInLobby] = useState(false);
  const { publicKey } = useWallet();
  // const navigate = useNavigate();

  // const checkUserGameStatus = async () => {
  //   if (!publicKey) {
  //     setIsUserInLobby(false);
  //     return;
  //   }

  //   try {
  //     const isInGame = await database.games.isInTournamentOrMatch(publicKey.toBase58());
  //     setIsUserInLobby(isInGame);
  //   } catch (error) {
  //     console.error("Error checking user game status:", error);
  //     setIsUserInLobby(false);
  //   }
  // };

  useEffect(() => {
    // checkUserGameStatus();
    checkUserGameStatusCallback();
  }, [publicKey, activeSection]);

  const checkUserGameStatusCallback = useCallback(async () => {
    if (!publicKey) {
      setIsUserInLobby(false);
      return;
    }

    try {
      const isInGame = await database.games.isInTournamentOrMatch(publicKey.toBase58());
      setIsUserInLobby(isInGame);
    } catch (error) {
      console.error("Error checking user game status:", error);
      setIsUserInLobby(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      const fetchUserId = async () => {
        const userData = await database.users.getByWallet(publicKey.toBase58());
        setCurrentUserId(userData?.id || null);
      };
      fetchUserId();
    } else {
      setCurrentUserId(null);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!currentUserId) return;

    console.log('Setting up global realtime listeners for user:', currentUserId);

    const channel = supabase
      .channel(`global-user-events-${currentUserId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_participants',
          filter: `user_id=eq.${currentUserId}`
        },
        (payload) => {
          console.log('User added to match globally!', payload.new);

          toaster.create({
            title: "Match Started! 🎮",
            description: "You've been added to a match. Loading game...",
            type: "success",
            duration: 3000,
          });

          // Auto-redirect to game page
          onSectionChange('mygame');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'lobby_participants',
          filter: `user_id=eq.${currentUserId}`
        },
        (payload) => {
          console.log('User removed from lobby!', payload.old);

          toaster.create({
            title: "Removed from Lobby 👋",
            description: "You have been removed from the lobby or it was closed.",
            type: "warning",
            duration: 5000,
          });

          // If user is currently viewing their lobby, redirect them
          if (activeSection === 'joined_lobbies') {
            onSectionChange('lobbies');
          }

          // Refresh user status
          // checkUserGameStatus();
          checkUserGameStatusCallback();
        }
      )
      .subscribe((status) => {
        console.log('Global user events subscription status:', status);
      });

    return () => {
      console.log('Cleaning up global user events subscription');
      channel.unsubscribe();
    };
  }, [currentUserId, onSectionChange, activeSection]);

  // Check if user is already in a lobby/game


  const handleCreateLobby = () => {
    // Only allow creating lobby if user is not already in one
    if (isUserInLobby) {
      toaster.create({
        title: "Already in Game",
        description: "You're already participating in a game. Complete it first before creating a new lobby.",
        type: "warning",
        duration: 5000,
      });
      return;
    }

    if (!publicKey) {
      toaster.create({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a lobby.",
        type: "error",
        duration: 5000,
      });
      return;
    }

    setIsCreateLobbyModalOpen(true);
  };

  const handleLobbyCreated = () => {
    setIsCreateLobbyModalOpen(false);
    setLobbiesRefreshTrigger(prev => prev + 1);

    // Refresh user status after creating lobby
    // checkUserGameStatus();
    checkUserGameStatusCallback();
    onSectionChange('joined_lobbies'); // Add this line

    toaster.create({
      title: "Lobby Created! 🎉",
      description: "Your lobby has been created successfully.",
      type: "success",
      duration: 4000,
    });
  };

  const handleJoinLobbyWithStatusCheck = async (lobbyId: number) => {
    // Check user status before allowing join
    if (isUserInLobby) {
      toaster.create({
        title: "Already in Game",
        description: "You're already participating in a game. Complete it first before joining another lobby.",
        type: "warning",
        duration: 5000,
      });
      return;
    }

    onJoinLobby(lobbyId);

    //set activeSection to 'joined_lobbies' after joining
    onSectionChange('joined_lobbies');

    // Refresh user status after attempting to join
    setTimeout(() => {
      // checkUserGameStatus();
      checkUserGameStatusCallback();
    }, 1000);
  };

  const handleRefreshLobbies = () => {
    setLobbiesRefreshTrigger(prev => prev + 1);
    // checkUserGameStatus();
    checkUserGameStatusCallback();
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'mygame':
        return <GamePage />;

      case 'lobbies':
        return (
          <LobbyPending
            onJoinLobby={handleJoinLobbyWithStatusCheck}
            useMockData={false}
            refreshTrigger={lobbiesRefreshTrigger}
            onCreateLobby={handleCreateLobby}
            onRefresh={handleRefreshLobbies}
          />
        );

      case 'joined_lobbies':
        return <MyLobby onSectionChange={onSectionChange} />

      case 'leaderboard':
        return <Leaderboard />;

      case 'spectate':
        return <Spectate />;

      default:
        return (
          <Container maxW="4xl">
            <Card.Root
              borderWidth="4px"
              borderStyle="solid"
              borderColor="border.default"
              bg="bg.default"
              shadow="brutalist.xl"
              borderRadius="0"
              p={12}
              textAlign="center"
            >
              <Card.Body>
                <VStack padding={6}>
                  <Box
                    bg="primary.solid"
                    p={6}
                    border="4px solid"
                    borderColor="border.default"
                  >
                    <Gamepad2 size={64} color="black" />
                  </Box>
                  <Heading size="xl" fontWeight="black" color="fg.default">
                    🎮 Welcome to Solana Game
                  </Heading>
                  <Text fontSize="lg" color="fg.muted" textAlign="center" maxW="400px">
                    Select a section from the navigation to get started with your gaming adventure!
                  </Text>
                </VStack>
              </Card.Body>
            </Card.Root>
          </Container>
        );
    }
  };

  return (
    <>
      <Box
        p={{ base: 4, md: 6 }}
        minH="100%"
        overflow="auto"
      >
        {renderContent()}
      </Box>

      {/* Create Lobby Modal */}
      <CreateLobbyModal
        isOpen={isCreateLobbyModalOpen}
        onClose={() => setIsCreateLobbyModalOpen(false)}
        onLobbyCreated={handleLobbyCreated}
      />
    </>
  );
};

export default MainContent;