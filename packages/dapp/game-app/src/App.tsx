// src/App.tsx
import { useState, useEffect } from 'react';
import { Box, Grid, GridItem, useBreakpointValue } from "@chakra-ui/react";
import { Routes, Route } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';

// Components
import Header from './components/Layout/Header';
import Navigation from './components/Layout/Navigation';
import ChatSidebar from './components/Layout/ChatSidebar';
import MainContent from './components/Layout/MainContent';

// Utils
import { database } from '@/supabase/Database';
import { toaster } from './components/ui/toaster';
import type { User } from './types/lobby';
import apiUrl from './api/config';

// Types
export type SectionType = 'mygame' | 'lobbies' | 'joined_lobbies' | 'tournaments' | 'leaderboard' | 'spectate' | 'demo';

interface RankedPlayer extends User {
  net_wins: number;
  rank: 'Unranked' | 'Bronze' | 'Silver' | 'Gold' | 'Legendary';
}

const getPlayerRank = (netWins: number): RankedPlayer['rank'] => {
  if (netWins > 20) return 'Legendary';
  if (netWins > 15) return 'Gold';
  if (netWins > 10) return 'Silver';
  if (netWins > 5) return 'Bronze';
  return 'Unranked';
};

function App() {
  // State
  const [activeSection, setActiveSection] = useState<SectionType>('mygame'); // Default to current game
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<RankedPlayer['rank']>('Unranked');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Hooks
  const { publicKey, connected } = useWallet();
  const isMobile = useBreakpointValue({ base: true, lg: false });

  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (connected && publicKey) {
        const walletAddress = publicKey.toBase58();
        const user = await database.users.getByWallet(walletAddress);
        setCurrentUser(user);
        
        if (user) {
          const netWins = (user.matches_won ?? 0) - (user.matches_lost ?? 0);
          setCurrentUserRank(getPlayerRank(netWins));
        } else {
          setCurrentUserRank('Unranked');
        }
      } else {
        setCurrentUser(null);
        setCurrentUserRank('Unranked');
      }
    };

    fetchCurrentUser();
  }, [connected, publicKey]);

  // Event handlers
  const handleJoinLobby = async (lobbyId: number) => {
    if (!currentUser) {
      toaster.create({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to join a lobby.",
        type: "error",
        duration: 5000,
      });
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/game/join-lobby`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobby_id: lobbyId,
          user_id: currentUser.id,
        }),
      });

      const data = await response.json();

      if (data.error) {
        // toaster.create({
        //   title: "Join Failed",
        //   description: data.error,
        //   type: "error",
        //   duration: 5000,
        // });
      } else {
        toaster.create({
          title: "Success! 🎉",
          description: `Successfully joined lobby #${lobbyId}!`,
          type: "success",
          duration: 4000,
        });
      }
    } catch (error) {
      console.error('Error joining lobby:', error);
      toaster.create({
        title: "Network Error",
        description: "Failed to connect to game server.",
        type: "error",
        duration: 5000,
      });
    }
  };

  const handleSectionChange = (section: SectionType) => {
    setActiveSection(section);
    if (isMobile) {
      setIsNavOpen(false); // Close nav menu on mobile after selection
    }
  };

  const toggleChat = () => setIsChatOpen(!isChatOpen);
  const toggleNav = () => setIsNavOpen(!isNavOpen);

  return (
    <Box 
      minH="100vh"
    >
        {/* Desktop Layout */}
        {!isMobile ? (
          <Grid
            templateColumns="300px 1fr"
            templateRows="auto auto 1fr"
            templateAreas={{
              base: `
                "header header"
                "nav nav"
                "sidebar content"
              `
            }}
            h='100vh'
            // overflow={"auto"}
            // minH="100vh"
          >
            {/* Header */}
            <GridItem area="header">
              <Header 
                currentUser={currentUser}
                currentUserRank={currentUserRank}
                />
            </GridItem>

            {/* Navigation */}
            <GridItem area="nav">
              <Navigation
                activeSection={activeSection}
                onSectionChange={handleSectionChange}
                isMobile={false}
                isOpen={false}
                onToggle={() => {}}
              />
            </GridItem>

            {/* Chat Sidebar */}
            <GridItem area="sidebar"
              overflow={"hidden"}
              h="100%"
            >
              <ChatSidebar 
                isOpen={true}
                onClose={() => {}}
                isMobile={false}
              />
            </GridItem>

            {/* Main Content */}
            <GridItem area="content"
              overflow="auto"
              // overflow="hidden"
            >
              <Routes>
                <Route 
                  path="/" 
                  element={
                    <MainContent
                      activeSection={activeSection}
                      currentUser={currentUser}
                      onJoinLobby={handleJoinLobby}
                      onSectionChange={handleSectionChange}
                    />
                  } 
                />
              </Routes>
            </GridItem>
          </Grid>
        ) : (
          /* Mobile Layout */
          <Grid
            templateRows="auto auto 1fr"
            templateAreas={`
              "header"
              "nav"
              "content"
            `}
            minH="100vh"
          >
            {/* Header */}
            <GridItem area="header">
              <Header 
                currentUser={currentUser}
                currentUserRank={currentUserRank}
                isMobile={true}
                onToggleNav={toggleNav}
                onToggleChat={toggleChat}
              />
            </GridItem>

            {/* Navigation */}
            <GridItem area="nav">
              <Navigation
                activeSection={activeSection}
                onSectionChange={handleSectionChange}
                isMobile={true}
                isOpen={isNavOpen}
                onToggle={toggleNav}
              />
            </GridItem>

            {/* Main Content */}
            <GridItem area="content" overflow="hidden">
              <Routes>
                <Route 
                  path="/" 
                  element={
                    <MainContent
                      activeSection={activeSection}
                      currentUser={currentUser}
                      onJoinLobby={handleJoinLobby}
                      onSectionChange={handleSectionChange}
                    />
                  } 
                />
              </Routes>

              {/* Chat Drawer for Mobile */}
              <ChatSidebar 
                isOpen={isChatOpen}
                onClose={toggleChat}
                isMobile={true}
              />
            </GridItem>
          </Grid>
        )}
      </Box>
    );
  };


export default App;