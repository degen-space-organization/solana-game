// src/components/Layout/MainContent.tsx
import React, { useState } from 'react';
import {
  Box,
  Container,
  VStack,
  Card,
  Heading,
  Text,
} from "@chakra-ui/react";
import { useNavigate } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';

// Components
import Game from '../Game/Game';
import LobbyPending from '../Lobby/LobbyPending';
import LobbyJoined from '../Lobby/LobbyJoined';
import Leaderboard from '../Leaderboard/Leaderboard';
import Spectate from '../Spectate/Spectate';
import { CreateLobbyModal } from '../Lobby/CreateLobbyModal';

// Utils
import { toaster } from '../ui/toaster';
import type { User } from '../../types/lobby';
import type { SectionType } from '../../App';

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
  const navigate = useNavigate();

  const handleCreateLobby = () => {
    setIsCreateLobbyModalOpen(true);
  };

  const handleLobbyCreated = () => {
    setIsCreateLobbyModalOpen(false);
    setLobbiesRefreshTrigger(prev => prev + 1);
    toaster.create({
      title: "Lobby Created! 🎉",
      description: "Your lobby has been created successfully.",
      type: "success",
      duration: 4000,
    });
  };

  const handleViewLobbyDetails = (lobbyId: number) => {
    toaster.create({
      title: "🔎 Viewing Lobby",
      description: `Loading details for lobby #${lobbyId}`,
      type: "info",
      duration: 2000,
    });
    navigate(`/lobby/${lobbyId}`);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'mygame':
        return (
          <Container maxW="100%" p={0}>
            <Card.Root
              borderWidth="4px"
              borderStyle="solid"
              borderColor="border.default"
              bg="bg.default"
              shadow="brutalist.xl"
              borderRadius="0"
              overflow="hidden"
            >
              <Card.Body p={0}>
                <Game />
              </Card.Body>
            </Card.Root>
          </Container>
        );

      case 'lobbies':
        return (
          <LobbyPending 
            onJoinLobby={onJoinLobby}
            useMockData={false}
            refreshTrigger={lobbiesRefreshTrigger}
            onCreateLobby={handleCreateLobby}
            onRefresh={() => setLobbiesRefreshTrigger(prev => prev + 1)}
          />
        );

      case 'joined_lobbies':
        return (
          <LobbyJoined
            onViewLobbyDetails={handleViewLobbyDetails}
            currentUser={currentUser}
          />
        );

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
      {isCreateLobbyModalOpen && (
        <CreateLobbyModal
          isOpen={isCreateLobbyModalOpen}
          onClose={() => setIsCreateLobbyModalOpen(false)}
          onLobbyCreated={handleLobbyCreated}
        />
      )}
    </>
  );
};

export default MainContent;