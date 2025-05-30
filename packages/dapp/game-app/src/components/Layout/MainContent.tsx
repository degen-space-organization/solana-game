// src/components/Layout/MainContent.tsx
import React, { useState } from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Button,
  Card,
  Heading,
  Text,
} from "@chakra-ui/react";
import { useNavigate } from 'react-router-dom';

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
              borderRadius="none"
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
          <VStack padding={6} align="stretch">
            {/* Action Buttons */}
            <HStack padding={4} justify="center" wrap="wrap">
              <Button
                onClick={handleCreateLobby}
                bg="brutalist.green"
                color="primary.contrast"
                fontWeight="black"
                fontSize="xl"
                textTransform="uppercase"
                letterSpacing="wider"
                borderRadius="none"
                border="4px solid"
                borderColor="border.default"
                shadow="brutalist.lg"
                _hover={{
                  transform: "translate(-3px, -3px)",
                  shadow: "brutalist.xl",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "brutalist.md",
                }}
                size="lg"
                px={12}
                py={6}
              >
                🚀 Create New Game
              </Button>

              <Button
                onClick={() => window.location.reload()}
                bg="primary.solid"
                color="primary.contrast"
                fontWeight="black"
                fontSize="xl"
                textTransform="uppercase"
                letterSpacing="wider"
                borderRadius="none"
                border="4px solid"
                borderColor="border.default"
                shadow="brutalist.lg"
                _hover={{
                  transform: "translate(-3px, -3px)",
                  shadow: "brutalist.xl",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "brutalist.md",
                }}
                size="lg"
                px={12}
                py={6}
              >
                🔄 Refresh Games
              </Button>
            </HStack>

            {/* Lobbies List */}
            <Box>
              {isCreateLobbyModalOpen ? (
                <CreateLobbyModal
                  isOpen={isCreateLobbyModalOpen}
                  onClose={() => setIsCreateLobbyModalOpen(false)}
                  onLobbyCreated={handleLobbyCreated}
                />
              ) : (
                <LobbyPending 
                  onJoinLobby={onJoinLobby}
                  useMockData={false}
                />
              )}
            </Box>
          </VStack>
        );

      case 'joined_lobbies':
        return (
          <LobbyJoined
            onViewLobbyDetails={handleViewLobbyDetails}
            currentUser={currentUser}
          />
        );

      case 'tournaments':
        return (
          <Container maxW="4xl">
            <Card.Root
              borderWidth="4px"
              borderStyle="solid"
              borderColor="border.default"
              bg="bg.default"
              shadow="brutalist.xl"
              borderRadius="none"
              p={12}
              textAlign="center"
              transform="rotate(-0.5deg)"
              _hover={{
                transform: "rotate(0deg) scale(1.02)",
                shadow: "brutalist.2xl",
              }}
              transition="all 0.2s ease"
            >
              <Card.Body>
                <Heading 
                  size="xl" 
                  fontWeight="black" 
                  color="fg.default" 
                  mb={6} 
                  textTransform="uppercase"
                >
                  🏆 TOURNAMENTS
                </Heading>
                <Text fontSize="xl" color="fg.muted" mb={4}>
                  Tournament brackets coming soon!
                </Text>
                <Text fontSize="md" color="fg.subtle">
                  Get ready for epic multi-player competitions with prize pools!
                </Text>
              </Card.Body>
            </Card.Root>
          </Container>
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
              borderRadius="none"
              p={12}
              textAlign="center"
            >
              <Card.Body>
                <Heading size="xl" fontWeight="black" color="fg.default" mb={4}>
                  🎮 Welcome to Solana Game
                </Heading>
                <Text fontSize="lg" color="fg.muted">
                  Select a section from the navigation above to get started!
                </Text>
              </Card.Body>
            </Card.Root>
          </Container>
        );
    }
  };

  return (
    <Box
      p={6}
      minH="100%"
      overflow="auto"
    >
      {renderContent()}
    </Box>
  );
};

export default MainContent;