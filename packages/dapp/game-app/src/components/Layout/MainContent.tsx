// src/components/Layout/MainContent.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  VStack,
  Card,
  Heading,
  Text,
} from "@chakra-ui/react";
import { useNavigate } from 'react-router-dom';
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

interface MainContentProps {
  activeSection: SectionType;
  currentUser: User | null;
  onJoinLobby: (lobbyId: number) => void;
  onSectionChange: (section: SectionType) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  activeSection,
  currentUser,
  onJoinLobby,
  onSectionChange
}) => {
  const [isCreateLobbyModalOpen, setIsCreateLobbyModalOpen] = useState(false);
  const [lobbiesRefreshTrigger, setLobbiesRefreshTrigger] = useState(0);
  const [isUserInLobby, setIsUserInLobby] = useState(false);
  const { publicKey } = useWallet();
  const navigate = useNavigate();

  // Check if user is already in a lobby/game
  const checkUserGameStatus = async () => {
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
  };

  useEffect(() => {
    checkUserGameStatus();
  }, [publicKey, activeSection]);

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
    checkUserGameStatus();

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
      checkUserGameStatus();
    }, 1000);
  };

  const handleRefreshLobbies = () => {
    setLobbiesRefreshTrigger(prev => prev + 1);
    checkUserGameStatus();
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
        return <MyLobby />

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