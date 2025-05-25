// src/App.tsx - Updated to show LobbyPending component
import { useState } from 'react'
import { Box, Button, VStack } from "@chakra-ui/react"
import LobbyPending from './components/Lobby/LobbyPending'
import { toaster } from './components/ui/toaster'
import './index.css'

function App() {
  const handleJoinLobby = (lobbyId: number) => {
    // Show toast notification
    toaster.create({
      title: "Joining Lobby",
      description: `Attempting to join lobby #${lobbyId}...`,
      type: "info",
      duration: 3000,
    })
    
    // Here you would implement the actual join logic
    console.log(`Joining lobby ${lobbyId}`)
    
    // Simulate success after a delay
    setTimeout(() => {
      toaster.create({
        title: "Success!",
        description: `Successfully joined lobby #${lobbyId}`,
        type: "success",
        duration: 3000,
      })
    }, 1500)
  }

  return (
    <Box minH="100vh" bg="gray.100" p="4">
      <VStack padding="8" maxW="7xl" mx="auto">
        {/* Main Content */}
        <LobbyPending onJoinLobby={handleJoinLobby} useMockData={false} />
        
        {/* Additional buttons for testing */}
        <Box>
          <Button
            onClick={() => {
              toaster.create({
                title: "Feature Coming Soon",
                description: "Create lobby functionality will be available soon!",
                type: "info",
                duration: 3000,
              })
            }}
            bg="#FF6B35"
            color="white"
            fontWeight="black"
            textTransform="uppercase"
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
            size="lg"
            px="8"
          >
            🚀 Create New Game
          </Button>
        </Box>
      </VStack>
    </Box>
  )
}

export default App