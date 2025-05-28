// packages/dapp/game-app/src/components/Lobby/LobbyDetailsPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Spinner,
  Button,
  Flex,
  Badge,
  Container,
  Grid,
  Card,
  IconButton,
  Progress,
} from '@chakra-ui/react';
import {
  Users,
  CheckCircle,
  Clock,
  UserX,
  Play,
  X,
  Coins,
  LogOut,
  Shield,
  Target,
  Trophy,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import { database } from '@/supabase/Database';
import { toaster } from '@/components/ui/toaster';
import type { PendingLobby } from '@/types/lobby';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { solConnection } from '@/web3';

const GAME_VAULT_ADDRESS = new PublicKey('48wcCEj1hdV5UGwr3PmhqvU3ix1eN5rMqEsBxT4XKRfc'); // Replace with your actual vault address


interface LobbyParticipant {
  id: number;
  lobby_id: number;
  user_id: number;
  joined_at: string;
  is_ready: boolean;
  has_staked: boolean;
  stake_transaction_hash: string | null;
  staked_at: string | null;
  users: {
    id: number;
    nickname: string | null;
    solana_address: string;
    matches_won: number;
    matches_lost: number;
  };
}

const LobbyDetailsPage: React.FC = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const navigate = useNavigate();
  const { publicKey, signTransaction } = useWallet();

  const [lobby, setLobby] = useState<PendingLobby | null>(null);
  const [participants, setParticipants] = useState<LobbyParticipant[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userParticipation, setUserParticipation] = useState<LobbyParticipant | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = publicKey ? publicKey.toBase58() : null;

  useEffect(() => {
    const fetchLobbyDetails = async () => {
      if (!lobbyId) {
        setError('Lobby ID not found in URL.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const id = parseInt(lobbyId, 10);
        if (isNaN(id)) {
          setError('Invalid Lobby ID.');
          setLoading(false);
          return;
        }

        // Fetch lobby details
        const fetchedLobby = await database.lobbies.getById(id);
        if (!fetchedLobby) {
          setError('Lobby not found.');
          setLoading(false);
          return;
        }
        setLobby(fetchedLobby);

        // Fetch participants
        const fetchedParticipants = await database.lobbies.getParticipants(id);
        setParticipants(fetchedParticipants);

        // Get current user info if wallet is connected
        if (walletAddress) {
          const userData = await database.users.getByWallet(walletAddress);
          setCurrentUser(userData);

          // Check if current user is a participant
          const userParticipant = fetchedParticipants.find(p => p.users.solana_address === walletAddress);
          setUserParticipation(userParticipant || null);
        }

      } catch (err) {
        console.error('Error fetching lobby details:', err);
        setError('Failed to load lobby details.');
      } finally {
        setLoading(false);
      }
    };

    fetchLobbyDetails();
  }, [lobbyId, walletAddress]);

  const getDisplayName = (user: any) => {
    if (!user) return 'Unknown';
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  };

  const isCreator = () => {
    return currentUser && lobby && currentUser.id === lobby.created_by;
  };

  const isParticipant = () => {
    return userParticipation !== null;
  };

  const hasUserStaked = () => {
    return userParticipation?.has_staked || false;
  };

  const canStartMatch = () => {
    if (!lobby || !isCreator()) return false;
    return lobby.current_players === lobby.max_players &&
      participants.every(p => p.has_staked);
  };

  const handleStake = async () => {
    if (!walletAddress || !lobby) return;

    setActionLoading(true);
    try {
      // TODO: Implement actual staking logic with your Solana contract
      toaster.create({
        title: "Staking...",
        description: `Staking ${lobby.stake_amount_sol} SOL for this lobby`,
        type: "loading",
        duration: 3000,
      });

      const curentUser = await database.users.getByWallet(walletAddress);
      const lobbyFetch = await database.lobbies.getById(lobby.id);
      const stakeAmountInLamports = lobbyFetch!.stake_amount_sol * 1e9; // Convert SOL to Lamports

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey!,
          toPubkey: GAME_VAULT_ADDRESS,
          lamports: stakeAmountInLamports,
        })
      );

      const { blockhash, lastValidBlockHeight } = await solConnection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey!;

      // Sign transaction (opens wallet)
      const signedTransaction = await signTransaction!(transaction);
      console.log('Sending out tx with following params: ', {
        from: signedTransaction.feePayer!.toBase58(),
        to: GAME_VAULT_ADDRESS.toBase58(),
        amount: lobbyFetch!.stake_amount_sol,
        blockhash: signedTransaction.recentBlockhash,
      })
      // Send and get signature
      const txSignature = await solConnection.sendRawTransaction(signedTransaction.serialize());
      if (!txSignature) throw new Error('Transaction signature is null');
      console.log('Transaction signature:', txSignature);      

      toaster.create({
        title: "Staked Successfully! 💰",
        description: "You have successfully staked for this lobby",
        type: "success",
        duration: 4000,
      });

      const response = await fetch('http://localhost:4000/api/v1/game/submit-stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: curentUser?.id,
          lobby_id: lobbyFetch?.id,
          txHash: txSignature,
        }),
      });

      if (!response.ok) throw new Error('Failed to update stake status');

      // Refresh the data
      window.location.reload();

    } catch (error) {
      console.error('Staking error:', error);
      toaster.create({
        title: "Staking Failed",
        description: "Failed to stake. Please try again.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!walletAddress || !lobby) 
      return;

    setActionLoading(true);
    try {
      toaster.create({
        title: "Withdrawing...",
        description: "Processing withdrawal from lobby",
        type: "loading",
        duration: 3000,
      });

      // Call the backend API to handle withdrawal logic including Solana refund
      const response = await fetch('http://localhost:4000/api/v1/game/leave-lobby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: currentUser.id, // Pass current user's ID
          lobby_id: lobby.id,
        }),
      });

      toaster.create({
        title: "Left Successfully! 🔄",
        description: "You have successfully left from the lobby",
        type: "success",
        duration: 4000,
      });

      // Navigate back or refresh
      navigate('/');

    } catch (error) {
      console.error('Leaving error:', error);
      toaster.create({
        title: "Leaving Failed",
        description: "Failed to leave. Please try again.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleKickPlayer = async (playerId: number, playerName: string) => {
    if (!isCreator()) return;

    const participant = participants.find(p => p.user_id === playerId);
    if (participant?.has_staked) {
      toaster.create({
        title: "Cannot Kick Player",
        description: "Cannot kick a player who has already staked",
        type: "error",
        duration: 4000,
      });
      return;
    }

    setActionLoading(true);
    try {
      toaster.create({
        title: "Kicking Player...",
        description: `Removing ${playerName} from the lobby`,
        type: "loading",
        duration: 3000,
      });

      // Call the backend API to handle kicking a player
      const response = await fetch('http://localhost:4000/api/v1/game/kick-player', { // Calling the new kick-player endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lobby_id: lobby!.id,
          user_id: playerId,
          creator_user_id: currentUser!.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Kick API error:', errorData.error);
        throw new Error(errorData.error || 'Failed to kick player');
      }

      toaster.create({
        title: "Player Kicked! 👋",
        description: `${playerName} has been removed from the lobby`,
        type: "success",
        duration: 4000,
      });

      // Refresh the data to reflect the kicked player's removal
      window.location.reload();

    } catch (error: any) {
      console.error('Kick player error:', error);
      toaster.create({
        title: "Kick Failed",
        description: error.message || "Failed to kick player. Please try again.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartMatch = async () => {
    if (!canStartMatch()) return;

    setActionLoading(true);
    try {
      toaster.create({
        title: "Starting Match...",
        description: "Initializing the game for all players",
        type: "loading",
        duration: 3000,
      });
      const response = await fetch('http://localhost:4000/api/v1/game/start-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lobby_id: lobby!.id,
          creator_user_id: lobby!.created_by,
        }),
      });

      if (!response.ok) {
        console.error('Failed to start match:', response.statusText);
        throw new Error('Failed to start match');
      }

      toaster.create({
        title: "Match Started! 🎮",
        description: "The game has begun! Good luck!",
        type: "success",
        duration: 4000,
      });

      // Navigate to game view
      navigate('/game');

    } catch (error) {
      console.error('Start match error:', error);
      toaster.create({
        title: "Failed to Start Match",
        description: "Could not start the match. Please try again.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseLobby = async () => {
    if (!isCreator()) return;

    setActionLoading(true);
    try {
      toaster.create({
        title: "Closing Lobby...",
        description: "Disbanding the lobby and refunding players",
        type: "loading",
        duration: 3000,
      });

      // TODO: Implement actual lobby close logic
      await new Promise(resolve => setTimeout(resolve, 2000));

      toaster.create({
        title: "Lobby Closed! 🔐",
        description: "The lobby has been closed and players have been refunded",
        type: "success",
        duration: 4000,
      });

      navigate('/');

    } catch (error) {
      console.error('Close lobby error:', error);
      toaster.create({
        title: "Failed to Close Lobby",
        description: "Could not close the lobby. Please try again.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!walletAddress || !currentUser || isParticipant()) return;

    setActionLoading(true);
    try {
      toaster.create({
        title: "Joining Lobby...",
        description: "Adding you to the lobby",
        type: "loading",
        duration: 3000,
      });

      // TODO: Implement actual join lobby logic via your API
      await new Promise(resolve => setTimeout(resolve, 2000));

      toaster.create({
        title: "Joined Successfully! 🎉",
        description: "You have joined the lobby. Don't forget to stake!",
        type: "success",
        duration: 4000,
      });

      // Refresh the data
      window.location.reload();

    } catch (error) {
      console.error('Join lobby error:', error);
      toaster.create({
        title: "Failed to Join",
        description: "Could not join the lobby. Please try again.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxW="100%" p="6">
        <VStack justify="center" align="center" minH="50vh">
          <Spinner size="xl" color="purple.500" />
          <Text fontSize="lg" fontWeight="bold" color="gray.600">
            Loading lobby details...
          </Text>
        </VStack>
      </Container>
    );
  }

  if (error) {
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
            <VStack align="center">
              <Heading size="lg" color="red.600" fontWeight="black" textTransform="uppercase">
                ⚠️ ERROR
              </Heading>
              <Text fontSize="md" color="red.500" mb="4">{error}</Text>
              <Button
                onClick={() => navigate('/')}
                bg="red.500"
                color="white"
                fontWeight="bold"
                borderRadius="0"
                border="3px solid"
                borderColor="gray.900"
                shadow="4px 4px 0px rgba(0,0,0,0.8)"
                _hover={{
                  bg: "red.600",
                  transform: "translate(-2px, -2px)",
                  shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                }}
              >
                <ArrowLeft size={16} />
                <Text ml="2">Go Home</Text>
              </Button>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    );
  }

  if (!lobby) {
    return (
      <Container maxW="100%" p="6">
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.400"
          bg="gray.50"
          shadow="8px 8px 0px rgba(0,0,0,0.4)"
          borderRadius="0"
          p="8"
          textAlign="center"
        >
          <Card.Body>
            <VStack align="center">
              <Heading size="lg" color="gray.500" fontWeight="black" textTransform="uppercase">
                Lobby Not Found
              </Heading>
              <Text fontSize="md" color="gray.600" mb="4">
                The lobby you are looking for does not exist or has been removed.
              </Text>
              <Button
                onClick={() => navigate('/')}
                bg="gray.500"
                color="white"
                fontWeight="bold"
                borderRadius="0"
                border="3px solid"
                borderColor="gray.900"
                shadow="4px 4px 0px rgba(0,0,0,0.8)"
              >
                <ArrowLeft size={16} />
                <Text ml="2">Go Home</Text>
              </Button>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50" py="6">
      <Container maxW="100%">
        {/* Back Button */}
        <Button
          onClick={() => navigate(-1)}
          mb="6"
          bg="gray.700"
          color="white"
          fontWeight="black"
          fontSize="md"
          px="6"
          py="3"
          borderRadius="0"
          border="3px solid"
          borderColor="gray.900"
          shadow="4px 4px 0px rgba(0,0,0,0.8)"
          _hover={{
            bg: "gray.800",
            transform: "translate(-2px, -2px)",
            shadow: "6px 6px 0px rgba(0,0,0,0.8)",
          }}
          _active={{
            transform: "translate(0px, 0px)",
            shadow: "2px 2px 0px rgba(0,0,0,0.8)",
          }}
        >
          <ArrowLeft size={20} />
          <Text ml="2">Go Back</Text>
        </Button>

        {/* Lobby Header */}
        <Card.Root
          borderWidth="4px"
          borderStyle="solid"
          borderColor="gray.900"
          bg="gray.900"
          shadow="8px 8px 0px rgba(0,0,0,0.8)"
          borderRadius="0"
          mb="6"
          transform="rotate(-0.5deg)"
        >
          <Card.Body p="6">
            <Flex justify="space-between" align="flex-start" mb="2">
              <VStack align="flex-start" padding="0">
                <HStack>
                  {lobby.is_tournament ? (
                    <Trophy size={28} color="#FFD700" />
                  ) : (
                    <Target size={28} color="#FF6B35" />
                  )}
                  <Heading
                    size="xl"
                    fontWeight="black"
                    color="white"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    {lobby.name || `Game #${lobby.id}`}
                  </Heading>
                </HStack>
                <Text fontSize="md" color="gray.300">
                  Created by {getDisplayName(lobby.created_by_user)} • {new Date(lobby.created_at).toLocaleDateString()}
                </Text>
              </VStack>

              <VStack align="flex-end" padding="0">
                <Badge
                  bg={lobby.is_tournament ? "#7B2CBF" : "#118AB2"}
                  color="white"
                  fontSize="sm"
                  fontWeight="black"
                  px="3"
                  py="2"
                  borderRadius="0"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  transform="rotate(3deg)"
                  border="2px solid white"
                >
                  {lobby.is_tournament ? '🏆 TOURNAMENT' : '⚔️ 1v1 DUEL'}
                </Badge>

                <Badge
                  bg={
                    lobby.status === 'waiting' ? "#06D6A0" :
                      lobby.status === 'starting' ? "#FF6B35" :
                        lobby.status === 'closed' ? "#DC143C" : "#118AB2"
                  }
                  color="white"
                  fontSize="xs"
                  fontWeight="black"
                  px="2"
                  py="1"
                  borderRadius="0"
                  textTransform="uppercase"
                  border="2px solid white"
                >
                  {lobby.status}
                </Badge>
              </VStack>
            </Flex>

            {isCreator() && (
              <Box
                bg="orange.500"
                color="white"
                px="3"
                py="1"
                fontSize="xs"
                fontWeight="black"
                borderRadius="0"
                border="2px solid white"
                display="inline-block"
                textTransform="uppercase"
                mt="2"
              >
                <Shield size={12} style={{ display: 'inline', marginRight: '4px' }} />
                YOU ARE THE CREATOR
              </Box>
            )}
          </Card.Body>
        </Card.Root>

        {/* Main Content - Two Column Layout */}
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap="6">
          {/* Left Column - Players List */}
          <Card.Root
            borderWidth="4px"
            borderStyle="solid"
            borderColor="gray.900"
            bg="white"
            shadow="8px 8px 0px rgba(0,0,0,0.8)"
            borderRadius="0"
          >
            <Card.Header
              p="4"
              borderBottom="4px solid"
              borderColor="gray.900"
              bg="gray.100"
            >
              <HStack justify="space-between">
                <HStack>
                  <Users size={24} color="#118AB2" />
                  <Heading
                    size="md"
                    fontWeight="black"
                    color="gray.900"
                    textTransform="uppercase"
                  >
                    Players ({participants.length}/{lobby.max_players})
                  </Heading>
                </HStack>

                <Progress.Root
                  value={(participants.length / lobby.max_players) * 100}
                  bg="gray.300"
                  borderRadius="0"
                  w="100px"
                  h="4"
                >
                  <Progress.Track bg="gray.300">
                    <Progress.Range bg="#118AB2" />
                  </Progress.Track>
                </Progress.Root>
              </HStack>
            </Card.Header>

            <Card.Body p="4">
              <VStack align="stretch" padding="2">
                {participants.map((participant, index) => (
                  <Box
                    key={participant.id}
                    bg={participant.has_staked ? "green.50" : "orange.50"}
                    border="3px solid"
                    borderColor={participant.has_staked ? "green.500" : "orange.500"}
                    p="4"
                    borderRadius="0"
                    shadow="4px 4px 0px rgba(0,0,0,0.8)"
                    position="relative"
                  >
                    <Flex justify="space-between" align="center">
                      <VStack align="flex-start" padding="0">
                        <HStack>
                          <Box
                            bg={index === 0 ? "#FF6B35" : "#118AB2"}
                            color="white"
                            px="2"
                            py="1"
                            fontSize="xs"
                            fontWeight="black"
                            borderRadius="0"
                            border="2px solid"
                            borderColor="gray.900"
                          >
                            P{index + 1}
                          </Box>
                          <Text fontSize="md" fontWeight="bold" color="gray.900">
                            {getDisplayName(participant.users)}
                          </Text>
                          {participant.user_id === lobby.created_by && (
                            <Badge
                              bg="purple.500"
                              color="white"
                              fontSize="xs"
                              fontWeight="black"
                              px="2"
                              py="1"
                              borderRadius="0"
                            >
                              CREATOR
                            </Badge>
                          )}
                        </HStack>
                        <Text fontSize="xs" color="gray.600">
                          {participant.users.matches_won}W - {participant.users.matches_lost}L
                        </Text>
                        {participant.staked_at && (
                          <Text fontSize="xs" color="green.600" fontWeight="bold">
                            Staked: {new Date(participant.staked_at).toLocaleString()}
                          </Text>
                        )}
                      </VStack>

                      <HStack>
                        {/* Staking Status */}
                        {participant.has_staked ? (
                          <Box
                            bg="green.500"
                            color="white"
                            p="2"
                            borderRadius="0"
                            border="2px solid"
                            borderColor="gray.900"
                          >
                            <CheckCircle size={20} />
                          </Box>
                        ) : (
                          <Box
                            bg="orange.500"
                            color="white"
                            p="2"
                            borderRadius="0"
                            border="2px solid"
                            borderColor="gray.900"
                          >
                            <Clock size={20} />
                          </Box>
                        )}

                        {/* Kick Button (only for creator, only for non-staked players) */}
                        {isCreator() &&
                          participant.user_id !== currentUser?.id &&
                          !participant.has_staked && (
                            <IconButton
                              onClick={() => handleKickPlayer(participant.user_id, getDisplayName(participant.users))}
                              disabled={actionLoading}
                              bg="red.500"
                              color="white"
                              _hover={{ bg: "red.600" }}
                              _active={{ bg: "red.700" }}
                              border="2px solid"
                              borderColor="gray.900"
                              borderRadius="0"
                              shadow="2px 2px 0px rgba(0,0,0,0.8)"
                              size="sm"
                            >
                              <UserX size={16} />
                            </IconButton>
                          )}
                      </HStack>
                    </Flex>
                  </Box>
                ))}

                {/* Empty slots */}
                {Array.from({ length: lobby.max_players - participants.length }).map((_, index) => (
                  <Box
                    key={`empty-${index}`}
                    bg="gray.100"
                    border="3px dashed"
                    borderColor="gray.400"
                    p="4"
                    borderRadius="0"
                    textAlign="center"
                  >
                    <Text fontSize="sm" color="gray.500" fontWeight="bold" textTransform="uppercase">
                      Waiting for Player...
                    </Text>
                  </Box>
                ))}
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Right Column - Lobby Info & Actions */}
          <VStack align="stretch" padding="0">
            {/* Lobby Stats */}
            <Card.Root
              borderWidth="4px"
              borderStyle="solid"
              borderColor="gray.900"
              bg="white"
              shadow="8px 8px 0px rgba(0,0,0,0.8)"
              borderRadius="0"
            >
              <Card.Header
                p="4"
                borderBottom="4px solid"
                borderColor="gray.900"
                bg="gray.100"
              >
                <HStack>
                  <Zap size={24} color="#FF6B35" />
                  <Heading
                    size="md"
                    fontWeight="black"
                    color="gray.900"
                    textTransform="uppercase"
                  >
                    Lobby Information
                  </Heading>
                </HStack>
              </Card.Header>

              <Card.Body p="6">
                <VStack align="stretch" padding="4">
                  {/* Prize Pool */}
                  <Box
                    bg="yellow.100"
                    border="3px solid"
                    borderColor="yellow.600"
                    p="4"
                    borderRadius="0"
                  >
                    <HStack justify="space-between">
                      <HStack>
                        <Coins size={20} color="#D69E2E" />
                        <Text fontSize="sm" fontWeight="bold" color="yellow.800">
                          TOTAL PRIZE POOL
                        </Text>
                      </HStack>
                      <Text fontSize="xl" fontWeight="black" color="yellow.900">
                        {lobby.total_prize_pool_sol} SOL
                      </Text>
                    </HStack>
                  </Box>

                  {/* Stake Amount */}
                  <Box
                    bg="green.100"
                    border="3px solid"
                    borderColor="green.600"
                    p="4"
                    borderRadius="0"
                  >
                    <HStack justify="space-between">
                      <Text fontSize="sm" fontWeight="bold" color="green.800">
                        STAKE PER PLAYER
                      </Text>
                      <Text fontSize="lg" fontWeight="black" color="green.900">
                        {lobby.stake_amount_sol} SOL
                      </Text>
                    </HStack>
                  </Box>

                  {/* Players Status */}
                  <Box
                    bg="blue.100"
                    border="3px solid"
                    borderColor="blue.600"
                    p="4"
                    borderRadius="0"
                  >
                    <VStack align="stretch" padding="0">
                      <HStack justify="space-between">
                        <Text fontSize="sm" fontWeight="bold" color="blue.800">
                          PLAYERS STAKED
                        </Text>
                        <Text fontSize="lg" fontWeight="black" color="blue.900">
                          {participants.filter(p => p.has_staked).length}/{participants.length}
                        </Text>
                      </HStack>
                      <Progress.Root
                        value={participants.length > 0 ? (participants.filter(p => p.has_staked).length / participants.length) * 100 : 0}
                        bg="blue.200"
                        borderRadius="0"
                        h="3"
                      >
                        <Progress.Track bg="blue.200">
                          <Progress.Range bg="blue.600" />
                        </Progress.Track>
                      </Progress.Root>
                    </VStack>
                  </Box>
                </VStack>
              </Card.Body>
            </Card.Root>

            {/* Action Buttons */}
            <Card.Root
              borderWidth="4px"
              borderStyle="solid"
              borderColor="gray.900"
              bg="white"
              shadow="8px 8px 0px rgba(0,0,0,0.8)"
              borderRadius="0"
            >
              <Card.Body p="6">
                <VStack align="stretch" padding="4">
                  {!walletAddress ? (
                    <Box
                      bg="red.100"
                      border="3px solid"
                      borderColor="red.500"
                      p="4"
                      borderRadius="0"
                      textAlign="center"
                    >
                      <Text fontSize="md" fontWeight="bold" color="red.700">
                        Connect your wallet to interact with this lobby
                      </Text>
                    </Box>
                  ) : isCreator() ? (
                    // Creator Actions
                    <VStack align="stretch" padding="2">
                      <Button
                        onClick={handleStartMatch}
                        disabled={!canStartMatch() || actionLoading}
                        bg={canStartMatch() ? "#06D6A0" : "gray.400"}
                        color="white"
                        fontWeight="black"
                        fontSize="lg"
                        py="6"
                        borderRadius="0"
                        border="3px solid"
                        borderColor="gray.900"
                        shadow="4px 4px 0px rgba(0,0,0,0.8)"
                        textTransform="uppercase"
                        _hover={canStartMatch() && !actionLoading ? {
                          bg: "#04C28D",
                          transform: "translate(-2px, -2px)",
                          shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                        } : {}}
                        _active={canStartMatch() && !actionLoading ? {
                          transform: "translate(0px, 0px)",
                          shadow: "2px 2px 0px rgba(0,0,0,0.8)",
                        } : {}}
                      >
                        {actionLoading ? (
                          <Spinner size="sm" />
                        ) : (
                          <HStack>
                            <Play size={20} />
                            <Text>Start Match</Text>
                          </HStack>
                        )}
                      </Button>

                      {!canStartMatch() && (
                        <Text fontSize="xs" color="gray.600" textAlign="center" fontWeight="bold">
                          All players must join and stake before starting
                        </Text>
                      )}

                      <Button
                        onClick={handleCloseLobby}
                        disabled={actionLoading}
                        bg="#DC2626"
                        color="white"
                        fontWeight="black"
                        fontSize="md"
                        py="4"
                        borderRadius="0"
                        border="3px solid"
                        borderColor="gray.900"
                        shadow="4px 4px 0px rgba(0,0,0,0.8)"
                        textTransform="uppercase"
                        _hover={!actionLoading ? {
                          bg: "#B91C1C",
                          transform: "translate(-2px, -2px)",
                          shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                        } : {}}
                      >
                        {actionLoading ? (
                          <Spinner size="sm" />
                        ) : (
                          <HStack>
                            <X size={16} />
                            <Text>Close Lobby</Text>
                          </HStack>
                        )}
                      </Button>
                    </VStack>
                  ) : isParticipant() ? (
                    // Participant Actions
                    <VStack align="stretch" padding="2">
                      {hasUserStaked() ? (

                          <Button
                            onClick={handleLeave}
                            disabled={actionLoading}
                            bg="#FF6B35"
                            color="white"
                            fontWeight="black"
                            fontSize="lg"
                            py="6"
                            borderRadius="0"
                            border="3px solid"
                            borderColor="gray.900"
                            shadow="4px 4px 0px rgba(0,0,0,0.8)"
                            textTransform="uppercase"
                            _hover={!actionLoading ? {
                              bg: "#E55A2B",
                              transform: "translate(-2px, -2px)",
                              shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                            } : {}}
                          >
                            {actionLoading ? (
                              <Spinner size="sm" />
                            ) : (
                              <HStack>
                                <LogOut size={20} />
                                <Text>Withdraw from Lobby</Text>
                              </HStack>
                            )}
                          </Button>  
                      ) : (
                        <VStack> 
                          <Button
                            onClick={handleStake}
                            disabled={actionLoading}
                            bg="#7B2CBF"
                            color="white"
                            fontWeight="black"
                            fontSize="lg"
                            py="6"
                            borderRadius="0"
                            border="3px solid"
                            borderColor="gray.900"
                            shadow="4px 4px 0px rgba(0,0,0,0.8)"
                            textTransform="uppercase"
                            _hover={!actionLoading ? {
                              bg: "#6A1B9A",
                              transform: "translate(-2px, -2px)",
                              shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                            } : {}}
                          >
                            {actionLoading ? (
                              <Spinner size="sm" />
                            ) : (
                              <HStack>
                                <Coins size={20} />
                                <Text>Stake {lobby.stake_amount_sol} SOL</Text>
                              </HStack>
                            )}
                          </Button>

                          <Button
                            onClick={handleLeave}
                            disabled={actionLoading}
                            bg="#FF6B35"
                            color="white"
                            fontWeight="black"
                            fontSize="lg"
                            py="6"
                            borderRadius="0"
                            border="3px solid"
                            borderColor="gray.900"
                            shadow="4px 4px 0px rgba(0,0,0,0.8)"
                            textTransform="uppercase"
                            _hover={!actionLoading ? {
                              bg: "#E55A2B",
                              transform: "translate(-2px, -2px)",
                              shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                            } : {}}
                          >
                            <HStack>
                                <LogOut size={20} />
                                <Text>Leave Lobby</Text>
                              </HStack>
                          </Button>
                        </VStack>
                      )}

                      <Text fontSize="xs" color="gray.600" textAlign="center" fontWeight="bold">
                        {hasUserStaked()
                          ? "You have staked and are ready to play!"
                          : "Stake your SOL to secure your spot in the game"
                        }
                      </Text>
                    </VStack>
                  ) : (
                    // Non-participant Actions
                    <VStack align="stretch" padding="2">
                      <Button
                        onClick={handleJoinLobby}
                        disabled={actionLoading || lobby.current_players >= lobby.max_players}
                        bg={lobby.current_players >= lobby.max_players ? "gray.400" : "#118AB2"}
                        color="white"
                        fontWeight="black"
                        fontSize="lg"
                        py="6"
                        borderRadius="0"
                        border="3px solid"
                        borderColor="gray.900"
                        shadow="4px 4px 0px rgba(0,0,0,0.8)"
                        textTransform="uppercase"
                        _hover={lobby.current_players < lobby.max_players && !actionLoading ? {
                          bg: "#0E7FA1",
                          transform: "translate(-2px, -2px)",
                          shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                        } : {}}
                      >
                        {actionLoading ? (
                          <Spinner size="sm" />
                        ) : lobby.current_players >= lobby.max_players ? (
                          <Text>🔒 LOBBY FULL</Text>
                        ) : (
                          <HStack>
                            <Users size={20} />
                            <Text>Join Lobby</Text>
                          </HStack>
                        )}
                      </Button>

                      <Text fontSize="xs" color="gray.600" textAlign="center" fontWeight="bold">
                        {lobby.current_players >= lobby.max_players
                          ? "This lobby is at maximum capacity"
                          : "Join this lobby to participate in the game"
                        }
                      </Text>
                    </VStack>
                  )}
                </VStack>
              </Card.Body>
            </Card.Root>
          </VStack>
        </Grid>
      </Container>
    </Box>
  );
};

export default LobbyDetailsPage;