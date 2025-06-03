// packages/dapp/game-app/src/components/Lobby/MyLobby.tsx
// 
// MyLobby Component - Displays current lobby information for the connected user
// 
// This component combines the functionality of LobbyJoined and LobbyDetailsPage into a single
// responsive component following the neobrutalism design theme. It automatically fetches and
// displays the current active lobby for the connected wallet address.
// 
// Features:
// - Fetches current lobby using database.lobbies.getJoined()
// - Mobile responsive layout (actions on top, players below)
// - Desktop layout (players left, actions right)
// - Real-time lobby status and participant information
// - Stake, leave, kick, and start game functionality
// - No routing required - self-contained component
//
// Usage: Replace 'joined_lobbies' section in MainContent.tsx with <MyLobby />

import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
    Box,
    Container,
    Text,
    VStack,
    HStack,
    Spinner,
    Button,
    Badge,
    IconButton,
    Card,
    Grid,
    GridItem,
    Progress,
    useBreakpointValue,
} from '@chakra-ui/react';
import {
    CheckCircle,
    Clock,
    UserX,
    Play,
    X,
    Coins,
    LogOut,
    Shield,
    Trophy,
    Target,
    Zap,
    RefreshCw,
} from 'lucide-react';
import { database } from '@/supabase/Database';
import { toaster } from '@/components/ui/toaster';
import type { PendingLobby } from '@/types/lobby';
import { SystemProgram, Transaction } from '@solana/web3.js';
import { solConnection } from '@/web3';
import { GAME_VAULT_ADDRESS } from '@/web3/constants';
import apiUrl from '@/api/config';

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

interface MyLobbyProps {
    onSectionChange?: (section: 'mygame' | 'lobbies' | 'joined_lobbies' | 'tournaments' | 'leaderboard' | 'spectate' | 'demo') => void;
}

const MyLobby: React.FC<MyLobbyProps> = ({ onSectionChange }) => {
    const { publicKey, signTransaction } = useWallet();
    const [lobby, setLobby] = useState<PendingLobby | null>(null);
    const [participants, setParticipants] = useState<LobbyParticipant[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userParticipation, setUserParticipation] = useState<LobbyParticipant | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // State tracking to reflect actions initiated by non-current-user
    const [previousLobbyId, setPreviousLobbyId] = useState<number | null>(null);
    const [wasInLobby, setWasInLobby] = useState<boolean>(false);

    const isMobile = useBreakpointValue({ base: true, lg: false });
    const walletAddress = publicKey ? publicKey.toBase58() : null;

    const fetchCurrentLobby = async () => {
        if (!walletAddress) {
            setLobby(null);
            setParticipants([]);
            setCurrentUser(null);
            setUserParticipation(null);
            setLoading(false);
            return;
        }



        setLoading(true);
        setError(null);

        try {
            // Get current user
            const userData = await database.users.getByWallet(walletAddress);
            setCurrentUser(userData);

            if (!userData) {
                setLobby(null);
                setParticipants([]);
                setLoading(false);
                return;
            }

            // Get joined lobbies and find the active one
            const joinedLobbies = await database.lobbies.getJoined(userData.id);
            const activeLobby = joinedLobbies.find(lobby =>
                lobby.status === 'waiting' || lobby.status === 'ready' || lobby.status === 'starting' || lobby.status === 'withdrawal' || lobby.status === 'closing'
            );

            if (!activeLobby) {
                setLobby(null);
                setParticipants([]);
                setUserParticipation(null);
                setLoading(false);
                return;
            }

            setLobby(activeLobby);
            setPreviousLobbyId(activeLobby.id); // Add this line
            setWasInLobby(true); // Add this line

            // Fetch participants for the active lobby
            const fetchedParticipants = await database.lobbies.getParticipants(activeLobby.id);
            setParticipants(fetchedParticipants);

            // Find user's participation
            const userParticipant = fetchedParticipants.find(p => p.users.solana_address === walletAddress);
            setUserParticipation(userParticipant || null);

        } catch (err) {
            console.error('Error fetching current lobby:', err);
            setError('Failed to load lobby information.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCurrentLobby();
    }, [walletAddress]);

    useEffect(() => {
        // Detect if user was kicked or lobby was disbanded
        if (wasInLobby && !loading && !lobby && previousLobbyId) {
            toaster.create({
                title: "Removed from Lobby",
                description: "You have been removed from the lobby or it was closed by the admin.",
                type: "warning",
                duration: 5000,
            });

            onSectionChange?.('lobbies');
            setPreviousLobbyId(null);
            setWasInLobby(false);
        }
    }, [lobby, loading, wasInLobby, previousLobbyId, onSectionChange]);

    const getDisplayName = (user: any) => {
        if (!user) return 'Unknown';
        return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
    };

    const isCreator = () => {
        return currentUser && lobby && currentUser.id === lobby.created_by;
    };

    const hasUserStaked = () => {
        return userParticipation?.has_staked || false;
    };

    const areAllPlayersStaked = () => {
        return participants.every(p => p.has_staked);
    };

    const isLobbyFull = () => {
        return lobby && lobby.current_players === lobby.max_players;
    };

    const canStartMatch = () => {
        if (!lobby || !isCreator() || lobby.tournament_id) return false;
        return isLobbyFull() && areAllPlayersStaked();
    };

    const canStartTournament = () => {
        if (!lobby || !isCreator() || !lobby.tournament_id) return false;
        return lobby.status === 'waiting' && isLobbyFull() && areAllPlayersStaked();
    };

    const handleRefresh = () => {
        fetchCurrentLobby();
    };

    const handleStake = async () => {
        if (!walletAddress || !lobby) return;

        setActionLoading(true);
        try {

            const stakeAmountInLamports = lobby.stake_amount_sol * 1e9;

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

            const signedTransaction = await signTransaction!(transaction);
            const txSignature = await solConnection.sendRawTransaction(signedTransaction.serialize());

            if (!txSignature) throw new Error('Transaction signature is null');

            const response = await fetch(`${apiUrl}/game/submit-stake`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser?.id,
                    lobby_id: lobby?.id,
                    txHash: txSignature,
                }),
            });

            if (!response.ok) throw new Error('Failed to update stake status');

            toaster.create({
                title: "Staked Successfully! 💰",
                description: "You have successfully staked for this lobby",
                type: "success",
                duration: 4000,
            });

            fetchCurrentLobby();

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

    const handleWithdraw = async () => {
        if (!walletAddress || !lobby) return;
        setActionLoading(true);
        try {
            const response = await fetch(`${apiUrl}/game/withdraw-lobby`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    lobby_id: lobby.id,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to withdraw');
            }
            toaster.create({
                title: "Withdraw Successful! 💸",
                description: "You have successfully withdrawn from the lobby",
                type: "success",
                duration: 4000,
            });

            setWasInLobby(false);
            setPreviousLobbyId(null);
            onSectionChange?.('lobbies');
            fetchCurrentLobby();

        } catch (error: any) {
            console.error('Withdraw error:', error);
            toaster.create({
                title: "Withdrawal Failed",
                description: error.message || "Failed to withdraw. Please try again.",
                type: "error",
                duration: 5000,
            });
        }
        finally {
            setActionLoading(false);
        }
    };

    const handleLeave = async () => {
        if (!walletAddress || !lobby) return;

        setActionLoading(true);
        try {

            const response = await fetch(`${apiUrl}/game/leave-lobby`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    lobby_id: lobby.id,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to withdraw');
            }

            toaster.create({
                title: "Left Successfully! 🔄",
                description: "You have successfully left the lobby",
                type: "success",
                duration: 4000,
            });

            setWasInLobby(false);
            setPreviousLobbyId(null);

            onSectionChange?.('lobbies'); // Add this line

            fetchCurrentLobby();

        } catch (error: any) {
            console.error('Leaving error:', error);
            toaster.create({
                title: "Leaving Failed",
                description: error.message || "Failed to leave. Please try again.",
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
            const response = await fetch(`${apiUrl}/game/kick-player`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lobby_id: lobby!.id,
                    player_to_kick_id: playerId,
                    creator_user_id: currentUser!.id,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to kick player');
            }

            toaster.create({
                title: "Player Kicked! 👋",
                description: `${playerName} has been removed from the lobby`,
                type: "success",
                duration: 4000,
            });

            fetchCurrentLobby();

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
            const response = await fetch(`${apiUrl}/game/start-match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lobby_id: lobby!.id,
                    creator_user_id: lobby!.created_by,
                }),
            });

            if (!response.ok) throw new Error('Failed to start match');

            toaster.create({
                title: "Match Started! 🎮",
                description: "The game has begun! Good luck!",
                type: "success",
                duration: 4000,
            });

            fetchCurrentLobby();

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

    const handleStartTournament = async () => {
        if (!canStartTournament()) return;

        setActionLoading(true);
        try {
            const response = await fetch(`${apiUrl}/game/start-tournament`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tournament_id: lobby!.tournament_id,
                    creator_user_id: lobby!.created_by,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start tournament');
            }

            toaster.create({
                title: "Tournament Started! 🏆",
                description: "The tournament has begun! Prepare for battle!",
                type: "success",
                duration: 4000,
            });

            fetchCurrentLobby();

        } catch (error: any) {
            console.error('Start tournament error:', error);
            toaster.create({
                title: "Failed to Start Tournament",
                description: error.message || "Could not start the tournament. Please try again.",
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
            const response = await fetch(`${apiUrl}/game/close-lobby`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lobby_id: lobby!.id,
                    user_id: currentUser!.id,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to close lobby');
            }

            toaster.create({
                title: "Lobby Closed! 🔐",
                description: "The lobby has been closed and players have been refunded",
                type: "success",
                duration: 4000,
            });
            
            setWasInLobby(false);
            setPreviousLobbyId(null);
            onSectionChange?.('lobbies');
            fetchCurrentLobby();

        } catch (error: any) {
            console.error('Close lobby error:', error);
            toaster.create({
                title: "Failed to Close Lobby",
                description: error.message || "Could not close the lobby. Please try again.",
                type: "error",
                duration: 5000,
            });
        } finally {
            setActionLoading(false);
        }
    };

    if (!walletAddress) {
        return (
            <Container maxW="6xl" py={8}>
                <Card.Root
                    bg="bg.default"
                    border="brutalist.thick"
                    borderRadius="none"
                    shadow="brutalist.xl"
                    overflow="hidden"
                >
                    <Box p={12} textAlign="center">
                        <Text fontSize="6xl" mb={4}>🔗</Text>
                        <Text
                            fontSize="xl"
                            fontWeight="black"
                            color="fg.muted"
                            mb={4}
                            textTransform="uppercase"
                        >
                            Connect Wallet
                        </Text>
                        <Text fontSize="md" color="fg.subtle">
                            Connect your wallet to view your current lobby
                        </Text>
                    </Box>
                </Card.Root>
            </Container>
        );
    }

    if (loading) {
        return (
            <Container maxW="6xl" py={8}>
                <VStack padding={6}>
                    <Spinner
                        size="xl"
                        color="primary.emphasis"
                    />
                    <Text
                        fontSize="lg"
                        fontWeight="bold"
                        color="fg.muted"
                        textTransform="uppercase"
                    >
                        Loading Your Lobby...
                    </Text>
                </VStack>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxW="6xl" py={8}>
                <Card.Root
                    bg="error"
                    color="fg.inverted"
                    border="brutalist.thick"
                    borderRadius="none"
                    shadow="brutalist.lg"
                >
                    <Box p={8} textAlign="center">
                        <Text fontSize="6xl" mb={4}>⚠️</Text>
                        <Text fontSize="lg" mb={6}>{error}</Text>
                        <Button
                            onClick={handleRefresh}
                            bg="fg.inverted"
                            color="error"
                            fontWeight="bold"
                            border="2px solid"
                            borderColor="fg.inverted"
                            borderRadius="sm"
                            shadow="brutalist.md"
                            _hover={{
                                transform: "translate(-2px, -2px)",
                                shadow: "brutalist.lg",
                            }}
                            _active={{
                                transform: "translate(0px, 0px)",
                                shadow: "brutalist.sm",
                            }}
                        >
                            <RefreshCw size={16} />
                            <Text ml={2}>RETRY</Text>
                        </Button>
                    </Box>
                </Card.Root>
            </Container>
        );
    }

    if (!lobby) {
        return (
            <Container maxW="6xl" py={8}>
                <Card.Root
                    bg="bg.default"
                    border="brutalist.thick"
                    borderRadius="none"
                    shadow="brutalist.xl"
                    overflow="hidden"
                >
                    <Box p={12} textAlign="center">
                        <Text fontSize="6xl" mb={4}>🎮</Text>
                        <Text
                            fontSize="xl"
                            fontWeight="black"
                            color="fg.muted"
                            mb={4}
                            textTransform="uppercase"
                        >
                            No Active Lobby
                        </Text>
                        <Text fontSize="md" color="fg.subtle">
                            You are not currently in any active lobby. Join or create a lobby to get started!
                        </Text>
                    </Box>
                </Card.Root>
            </Container>
        );
    }

    return (
        <Container maxW="6xl" py={6}>
            <Card.Root
                bg="bg.default"
                // border="brutalist.thick"
                border="2px solid"
                borderRadius="none"
                shadow="brutalist.2xl"
                overflow="hidden"
            >
                {/* Lobby Header */}
                <Box
                    bg="primary.solid"
                    borderBottom="2px solid"
                    borderColor="border.default"
                    p={6}
                >
                    <VStack padding={0} align="stretch">
                        {/* Title Row */}
                        <HStack justify="space-between" align="center" wrap="wrap">
                            <HStack>
                                {lobby.tournament_id ? (
                                    <Trophy size={28} color="#7B2CBF" />
                                ) : (
                                    <Target size={28} color="#FF6B35" />
                                )}
                                <VStack align="start" padding={0}>
                                    <Text
                                        fontSize={{ base: "lg", md: "xl" }}
                                        fontWeight="black"
                                        color="fg.default"
                                        textTransform="uppercase"
                                    >
                                        {/* Game ID followed by optional name */}
                                        #{lobby.id} {lobby.name ? `- ${lobby.name}` : ''}
                                    </Text>
                                    {/* Lobby ID */}

                                    <Text fontSize="sm" color="fg.muted">
                                        Created by {getDisplayName(lobby.created_by_user)}
                                    </Text>
                                </VStack>
                            </HStack>

                            <HStack>
                                <Badge
                                    bg={lobby.tournament_id ? "#A855F7" : "#3B82F6"}
                                    color="white"
                                    fontSize="xs"
                                    fontWeight="black"
                                    px={3}
                                    py={1}
                                    borderRadius="none"
                                    textTransform="uppercase"
                                    border="2px solid"
                                    borderColor="border.default"
                                    shadow="brutalist.sm"
                                >
                                    {lobby.is_tournament ? '🏆 TOURNAMENT' : '⚔️ 1v1 DUEL'}
                                </Badge>

                                <Badge
                                    bg={
                                        lobby.status === 'waiting' ? "#2DD4BF" :
                                            lobby.status === 'starting' ? "#FF8A5B" : "#3B82F6"
                                    }
                                    color="white"
                                    fontSize="xs"
                                    fontWeight="black"
                                    px={2}
                                    py={1}
                                    borderRadius="none"
                                    textTransform="uppercase"
                                    border="2px solid"
                                    borderColor="border.default"
                                    shadow="brutalist.sm"
                                >
                                    {lobby.status}
                                </Badge>
                            </HStack>
                        </HStack>

                        {/* Stats Row */}
                        <Grid
                            templateColumns={{ base: "1fr 1fr", md: "1fr 1fr 1fr 1fr" }}
                            gap={4}
                            mt={4}
                        >
                            <Box
                                bg="yellow.100"
                                border="3px solid"
                                borderColor="yellow.600"
                                p={3}
                                borderRadius="none"
                                textAlign="center"
                                shadow="brutalist.sm"
                            >
                                <Text fontSize="xs" fontWeight="black" color="yellow.800" textTransform="uppercase">
                                    PRIZE POOL
                                </Text>
                                <Text fontSize="lg" fontWeight="black" color="yellow.900">
                                    {lobby.total_prize_pool_sol} SOL
                                </Text>
                            </Box>

                            <Box
                                bg="green.100"
                                border="3px solid"
                                borderColor="green.600"
                                p={3}
                                borderRadius="none"
                                textAlign="center"
                                shadow="brutalist.sm"
                            >
                                <Text fontSize="xs" fontWeight="black" color="green.800" textTransform="uppercase">
                                    STAKE
                                </Text>
                                <Text fontSize="lg" fontWeight="black" color="green.900">
                                    {lobby.stake_amount_sol} SOL
                                </Text>
                            </Box>

                            <Box
                                bg="blue.100"
                                border="3px solid"
                                borderColor="blue.600"
                                p={3}
                                borderRadius="none"
                                textAlign="center"
                                shadow="brutalist.sm"
                            >
                                <Text fontSize="xs" fontWeight="black" color="blue.800" textTransform="uppercase">
                                    PLAYERS
                                </Text>
                                <Text fontSize="lg" fontWeight="black" color="blue.900">
                                    {lobby.current_players}/{lobby.max_players}
                                </Text>
                            </Box>

                            <Box
                                bg="purple.100"
                                border="3px solid"
                                borderColor="purple.600"
                                p={3}
                                borderRadius="none"
                                textAlign="center"
                                shadow="brutalist.sm"
                            >
                                <Text fontSize="xs" fontWeight="black" color="purple.800" textTransform="uppercase">
                                    STAKED
                                </Text>
                                <Text fontSize="lg" fontWeight="black" color="purple.900">
                                    {participants.filter(p => p.has_staked).length}/{participants.length}
                                </Text>
                            </Box>
                        </Grid>

                        {isCreator() && (
                            <Box
                                bg="#FF8A5B"
                                color="white"
                                px={3}
                                py={1}
                                fontSize="xs"
                                fontWeight="black"
                                borderRadius="none"
                                border="2px solid"
                                borderColor="border.default"
                                display="inline-block"
                                alignSelf="flex-start"
                                textTransform="uppercase"
                                mt={2}
                                shadow="brutalist.sm"
                            >
                                <Shield size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                YOU ARE THE CREATOR
                            </Box>
                        )}

                        {/* Refresh Button */}
                        <HStack justify="flex-end">
                            <IconButton
                                onClick={handleRefresh}
                                bg="bg.default"
                                color="fg.default"
                                border="border.default"
                                borderRadius="sm"
                                shadow="brutalist.sm"
                                size="sm"
                                _hover={{
                                    transform: "translate(-1px, -1px)",
                                    shadow: "brutalist.md",
                                }}
                            >
                                <RefreshCw size={16} />
                            </IconButton>
                        </HStack>
                    </VStack>
                </Box>

                {/* Main Content */}
                <Grid
                    templateColumns={{
                        base: "1fr",
                        lg: "2fr 1fr"
                    }}
                    templateRows={{
                        base: "auto auto",
                        lg: "1fr"
                    }}
                    gap={0}
                >
                    {/* Mobile: Actions First */}
                    {isMobile && (
                        <GridItem>
                            <Box
                                bg="bg.subtle"
                                borderBottom="2px solid"
                                borderColor="border.default"
                                p={4}
                            >
                                <Text
                                    fontSize="sm"
                                    fontWeight="bold"
                                    color="fg.muted"
                                    textTransform="uppercase"
                                    mb={3}
                                >
                                    Actions
                                </Text>
                                <VStack padding={2} align="stretch">
                                    {isCreator() ? (
                                        <>
                                            {lobby.tournament_id ? (
                                                <Button
                                                    onClick={handleStartTournament}
                                                    disabled={!canStartTournament() || actionLoading}
                                                    bg={canStartTournament() ? "#A855F7" : "gray.400"}
                                                    color="white"
                                                    fontWeight="black"
                                                    fontSize="sm"
                                                    borderRadius="none"
                                                    border="2px solid"
                                                    borderColor="border.default"
                                                    shadow="brutalist.md"
                                                    textTransform="uppercase"
                                                    _hover={canStartTournament() && !actionLoading ? {
                                                        transform: "translate(-2px, -2px)",
                                                        shadow: "brutalist.lg",
                                                    } : {}}
                                                    _active={canStartTournament() && !actionLoading ? {
                                                        transform: "translate(0px, 0px)",
                                                        shadow: "brutalist.sm",
                                                    } : {}}
                                                >
                                                    {actionLoading ? <Spinner size="sm" /> : <><Trophy size={16} /><Text ml={2}>Start Tournament</Text></>}
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={handleStartMatch}
                                                    disabled={!canStartMatch() || actionLoading}
                                                    bg={canStartMatch() ? "#2DD4BF" : "gray.400"}
                                                    color="white"
                                                    fontWeight="black"
                                                    fontSize="sm"
                                                    borderRadius="none"
                                                    border="2px solid"
                                                    borderColor="border.default"
                                                    shadow="brutalist.md"
                                                    textTransform="uppercase"
                                                    _hover={canStartMatch() && !actionLoading ? {
                                                        transform: "translate(-2px, -2px)",
                                                        shadow: "brutalist.lg",
                                                    } : {}}
                                                    _active={canStartMatch() && !actionLoading ? {
                                                        transform: "translate(0px, 0px)",
                                                        shadow: "brutalist.sm",
                                                    } : {}}
                                                >
                                                    {actionLoading ? <Spinner size="sm" /> : <><Play size={16} /><Text ml={2}>Start Match</Text></>}
                                                </Button>
                                            )}

                                            <Button
                                                onClick={handleCloseLobby}
                                                disabled={actionLoading}
                                                bg="#EF4444"
                                                color="white"
                                                fontWeight="black"
                                                fontSize="sm"
                                                borderRadius="none"
                                                border="2px solid"
                                                borderColor="border.default"
                                                shadow="brutalist.md"
                                                textTransform="uppercase"
                                                _hover={!actionLoading ? {
                                                    transform: "translate(-2px, -2px)",
                                                    shadow: "brutalist.lg",
                                                } : {}}
                                                _active={!actionLoading ? {
                                                    transform: "translate(0px, 0px)",
                                                    shadow: "brutalist.sm",
                                                } : {}}
                                            >
                                                {actionLoading ? <Spinner size="sm" /> : <><X size={16} /><Text ml={2}>Close Lobby</Text></>}
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            {!hasUserStaked() && (
                                                <Button
                                                    onClick={handleStake}
                                                    disabled={actionLoading}
                                                    bg="#9f7aea"
                                                    color="white"
                                                    fontWeight="black"
                                                    fontSize="sm"
                                                    borderRadius="none"
                                                    border="2px solid"
                                                    borderColor="border.default"
                                                    shadow="brutalist.md"
                                                    textTransform="uppercase"
                                                    _hover={!actionLoading ? {
                                                        transform: "translate(-2px, -2px)",
                                                        shadow: "brutalist.lg",
                                                    } : {}}
                                                    _active={!actionLoading ? {
                                                        transform: "translate(0px, 0px)",
                                                        shadow: "brutalist.sm",
                                                    } : {}}
                                                >
                                                    {actionLoading ? <Spinner size="sm" /> : <><Coins size={16} /><Text ml={2}>Stake {lobby.stake_amount_sol} SOL</Text></>}
                                                </Button>
                                            )}

                                            <Button
                                                onClick={handleLeave}
                                                disabled={actionLoading}
                                                bg="#FF8A5B"
                                                color="white"
                                                fontWeight="black"
                                                fontSize="sm"
                                                borderRadius="none"
                                                border="2px solid"
                                                borderColor="border.default"
                                                shadow="brutalist.md"
                                                textTransform="uppercase"
                                                _hover={!actionLoading ? {
                                                    transform: "translate(-2px, -2px)",
                                                    shadow: "brutalist.lg",
                                                } : {}}
                                                _active={!actionLoading ? {
                                                    transform: "translate(0px, 0px)",
                                                    shadow: "brutalist.sm",
                                                } : {}}
                                            >
                                                {actionLoading ? <Spinner size="sm" /> : <><LogOut size={16} /><Text ml={2}>Leave Lobby</Text></>}
                                            </Button>
                                        </>
                                    )}
                                </VStack>
                            </Box>
                        </GridItem>
                    )}

                    {/* Players List */}
                    <GridItem>
                        <Box bg="bg.default">
                            {/* Players Header */}
                            <Box
                                p={4}
                                bg="bg.subtle"
                                borderBottom="2px solid"
                                borderColor="border.default"
                                display={{ base: "block", lg: "none" }}
                            >
                                <HStack justify="space-between">
                                    <Text
                                        fontSize="sm"
                                        fontWeight="bold"
                                        color="fg.muted"
                                        textTransform="uppercase"
                                    >
                                        Players ({participants.length}/{lobby.max_players})
                                    </Text>
                                    <Progress.Root
                                        value={(participants.length / lobby.max_players) * 100}
                                        bg="bg.muted"
                                        borderRadius="none"
                                        w="100px"
                                        h="4"
                                        border="2px solid"
                                        borderColor="border.default"
                                    >
                                        <Progress.Track bg="bg.muted">
                                            <Progress.Range bg="#3B82F6" />
                                        </Progress.Track>
                                    </Progress.Root>
                                </HStack>
                            </Box>

                            {/* Players List */}
                            <VStack padding={0} align="stretch">
                                {participants.map((participant, index) => (
                                    <Box
                                        key={participant.id}
                                        p={4}
                                        bg="bg.default"
                                        borderBottom="1px solid"
                                        borderColor="border.subtle"
                                        _hover={{ bg: "bg.subtle" }}
                                        transition="all 0.2s ease"
                                    >
                                        <HStack justify="space-between" align="center">
                                            <HStack>
                                                <Box
                                                    bg={index === 0 ? "#FF8A5B" : "#3B82F6"}
                                                    color="white"
                                                    px={2}
                                                    py={1}
                                                    fontSize="xs"
                                                    fontWeight="black"
                                                    borderRadius="none"
                                                    border="2px solid"
                                                    borderColor="border.default"
                                                    minW="8"
                                                    textAlign="center"
                                                    shadow="brutalist.sm"
                                                >
                                                    P{index + 1}
                                                </Box>
                                                <VStack align="start" padding={0}>
                                                    <HStack>
                                                        <Text fontSize="sm" fontWeight="bold" color="fg.default">
                                                            {getDisplayName(participant.users)}
                                                        </Text>
                                                        {participant.user_id === lobby.created_by && (
                                                            <Badge
                                                                bg="#A855F7"
                                                                color="white"
                                                                fontSize="xs"
                                                                fontWeight="black"
                                                                px={2}
                                                                py={0.5}
                                                                borderRadius="none"
                                                                border="1px solid"
                                                                borderColor="border.default"
                                                            >
                                                                HOST
                                                            </Badge>
                                                        )}
                                                        {participant.user_id === currentUser?.id && (
                                                            <Badge
                                                                bg="#2DD4BF"
                                                                color="white"
                                                                fontSize="xs"
                                                                fontWeight="black"
                                                                px={2}
                                                                py={0.5}
                                                                borderRadius="none"
                                                                border="1px solid"
                                                                borderColor="border.default"
                                                            >
                                                                YOU
                                                            </Badge>
                                                        )}
                                                    </HStack>
                                                    <Text fontSize="xs" color="fg.muted">
                                                        {participant.users.matches_won}W - {participant.users.matches_lost}L
                                                    </Text>
                                                </VStack>
                                            </HStack>

                                            <HStack>
                                                {participant.has_staked ? (
                                                    <Box
                                                        bg="#2DD4BF"
                                                        color="white"
                                                        p={1.5}
                                                        borderRadius="none"
                                                        border="2px solid"
                                                        borderColor="border.default"
                                                        shadow="brutalist.sm"
                                                    >
                                                        <CheckCircle size={14} />
                                                    </Box>
                                                ) : (
                                                    <Box
                                                        bg="#F59E0B"
                                                        color="white"
                                                        p={1.5}
                                                        borderRadius="none"
                                                        border="2px solid"
                                                        borderColor="border.default"
                                                        shadow="brutalist.sm"
                                                    >
                                                        <Clock size={14} />
                                                    </Box>
                                                )}

                                                {isCreator() &&
                                                    participant.user_id !== currentUser?.id &&
                                                    !participant.has_staked && (
                                                        <IconButton
                                                            onClick={() => handleKickPlayer(participant.user_id, getDisplayName(participant.users))}
                                                            disabled={actionLoading}
                                                            bg="#EF4444"
                                                            color="white"
                                                            border="2px solid"
                                                            borderColor="border.default"
                                                            borderRadius="none"
                                                            shadow="brutalist.sm"
                                                            size="sm"
                                                            _hover={{
                                                                transform: "translate(-1px, -1px)",
                                                                shadow: "brutalist.sm",
                                                            }}
                                                            _active={{
                                                                transform: "translate(0px, 0px)",
                                                                shadow: "none",
                                                            }}
                                                        >
                                                            <UserX size={12} />
                                                        </IconButton>
                                                    )}
                                            </HStack>
                                        </HStack>
                                    </Box>
                                ))}

                                {/* Empty slots */}
                                {Array.from({ length: lobby.max_players - participants.length }).map((_, index) => (
                                    <Box
                                        key={`empty-${index}`}
                                        p={4}
                                        bg="bg.subtle"
                                        borderBottom="1px solid"
                                        borderColor="border.subtle"
                                        textAlign="center"
                                    >
                                        <Text fontSize="sm" color="fg.muted" fontWeight="bold" textTransform="uppercase">
                                            Waiting for Player...
                                        </Text>
                                    </Box>
                                ))}
                            </VStack>
                        </Box>
                    </GridItem>

                    {/* Desktop: Actions on Right */}
                    {!isMobile && (
                        <GridItem>
                            <Box
                                bg="bg.subtle"
                                borderLeft="2px solid"
                                borderColor="border.default"
                                p={4}
                                h="100%"
                            >
                                <Text
                                    fontSize="sm"
                                    fontWeight="bold"
                                    color="fg.muted"
                                    textTransform="uppercase"
                                    mb={4}
                                >
                                    <Zap size={16} style={{ display: 'inline', marginRight: '8px' }} />
                                    Actions
                                </Text>

                                <VStack padding={2} align="stretch">
                                    {isCreator() ? (
                                        <>
                                            {lobby.tournament_id ? (
                                                <Button
                                                    onClick={handleStartTournament}
                                                    disabled={!canStartTournament() || actionLoading}
                                                    bg={canStartTournament() ? "#A855F7" : "gray.400"}
                                                    color="white"
                                                    fontWeight="black"
                                                    fontSize="md"
                                                    py={4}
                                                    borderRadius="none"
                                                    border="2px solid"
                                                    borderColor="border.default"
                                                    shadow="brutalist.md"
                                                    textTransform="uppercase"
                                                    _hover={canStartTournament() && !actionLoading ? {
                                                        transform: "translate(-2px, -2px)",
                                                        shadow: "brutalist.lg",
                                                    } : {}}
                                                    _active={canStartTournament() && !actionLoading ? {
                                                        transform: "translate(0px, 0px)",
                                                        shadow: "brutalist.sm",
                                                    } : {}}
                                                >
                                                    {actionLoading ? (
                                                        <Spinner size="sm" />
                                                    ) : (
                                                        <HStack>
                                                            <Trophy size={20} />
                                                            <Text>Start Tournament</Text>
                                                        </HStack>
                                                    )}
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={handleStartMatch}
                                                    disabled={!canStartMatch() || actionLoading}
                                                    bg={canStartMatch() ? "#2DD4BF" : "gray.400"}
                                                    color="white"
                                                    fontWeight="black"
                                                    fontSize="md"
                                                    py={4}
                                                    borderRadius="none"
                                                    border="2px solid"
                                                    borderColor="border.default"
                                                    shadow="brutalist.md"
                                                    textTransform="uppercase"
                                                    _hover={canStartMatch() && !actionLoading ? {
                                                        transform: "translate(-2px, -2px)",
                                                        shadow: "brutalist.lg",
                                                    } : {}}
                                                    _active={canStartMatch() && !actionLoading ? {
                                                        transform: "translate(0px, 0px)",
                                                        shadow: "brutalist.sm",
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
                                            )}

                                            {(!canStartMatch() && !canStartTournament()) && (
                                                <Text fontSize="xs" color="fg.subtle" textAlign="center" fontWeight="bold">
                                                    All players must join and stake before starting
                                                </Text>
                                            )}

                                            <Button
                                                onClick={handleCloseLobby}
                                                disabled={actionLoading}
                                                bg="#EF4444"
                                                color="white"
                                                fontWeight="black"
                                                fontSize="md"
                                                py={3}
                                                borderRadius="none"
                                                border="2px solid"
                                                borderColor="border.default"
                                                shadow="brutalist.md"
                                                textTransform="uppercase"
                                                _hover={!actionLoading ? {
                                                    transform: "translate(-2px, -2px)",
                                                    shadow: "brutalist.lg",
                                                } : {}}
                                                _active={!actionLoading ? {
                                                    transform: "translate(0px, 0px)",
                                                    shadow: "brutalist.sm",
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
                                        </>
                                    ) : (
                                        <>
                                            {!hasUserStaked() && (
                                                <Button
                                                    onClick={handleStake}
                                                    disabled={actionLoading}
                                                    bg="#9f7aea"
                                                    color="white"
                                                    fontWeight="black"
                                                    fontSize="md"
                                                    py={4}
                                                    borderRadius="none"
                                                    border="2px solid"
                                                    borderColor="border.default"
                                                    shadow="brutalist.md"
                                                    textTransform="uppercase"
                                                    _hover={!actionLoading ? {
                                                        transform: "translate(-2px, -2px)",
                                                        shadow: "brutalist.lg",
                                                    } : {}}
                                                    _active={!actionLoading ? {
                                                        transform: "translate(0px, 0px)",
                                                        shadow: "brutalist.sm",
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
                                            )}


                                            {/* Leave / Withdraw buttons */}
                                            {hasUserStaked() ? (
                                                <Button
                                                    onClick={handleWithdraw}
                                                    disabled={actionLoading}
                                                    bg="#2DD4BF"
                                                    color="white"
                                                    fontWeight="black"
                                                    fontSize="md"
                                                    py={4}
                                                    borderRadius="none"
                                                    border="2px solid"
                                                    borderColor="border.default"
                                                    shadow="brutalist.md"
                                                    textTransform="uppercase"
                                                    _hover={!actionLoading ? {
                                                        transform: "translate(-2px, -2px)",
                                                        shadow: "brutalist.lg",
                                                    } : {}}
                                                    _active={!actionLoading ? {
                                                        transform: "translate(0px, 0px)",
                                                        shadow: "brutalist.sm",
                                                    } : {}}
                                                >
                                                    {actionLoading ? (
                                                        <Spinner size="sm" />
                                                    ) : (
                                                        <HStack>
                                                            <LogOut size={20} />
                                                            <Text>Withdraw</Text>
                                                        </HStack>
                                                    )}
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={handleLeave}
                                                    disabled={actionLoading}
                                                    bg="#FF8A5B"
                                                    color="white"
                                                    fontWeight="black"
                                                    fontSize="md"
                                                    py={4}
                                                    borderRadius="none"
                                                    border="2px solid"
                                                    borderColor="border.default"
                                                    shadow="brutalist.md"
                                                    textTransform="uppercase"
                                                    _hover={!actionLoading ? {
                                                        transform: "translate(-2px, -2px)",
                                                        shadow: "brutalist.lg",
                                                    } : {}}
                                                    _active={!actionLoading ? {
                                                        transform: "translate(0px, 0px)",
                                                        shadow: "brutalist.sm",
                                                    } : {}}
                                                >
                                                    {actionLoading ? (
                                                        <Spinner size="sm" />
                                                    ) : (
                                                        <HStack>
                                                            <LogOut size={20} />
                                                            <Text>{'Leave'}</Text>
                                                        </HStack>
                                                    )}
                                                </Button>
                                            )}

                                            {!hasUserStaked() && (
                                                <Text fontSize="xs" color="fg.subtle" textAlign="center" fontWeight="bold">
                                                    Stake your SOL to secure your spot in the game
                                                </Text>
                                            )}
                                        </>
                                    )}
                                </VStack>
                            </Box>
                        </GridItem>
                    )}
                </Grid>
            </Card.Root>
        </Container>
    );
};

export default MyLobby;