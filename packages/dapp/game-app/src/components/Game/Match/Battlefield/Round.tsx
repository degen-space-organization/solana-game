import { database } from '@/supabase/Database';
import { supabase } from '@/supabase';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
    Box,
    VStack,
    Text,
    Button,
    Spinner,
    Card,
    useBreakpointValue,
} from '@chakra-ui/react';
import { AlertTriangle } from 'lucide-react';

import Timer from './Timer';
import ChooseMove from './ChoseMove';
import Battlefield from './Battlefield';

interface RoundInfo {
    id: number;
    match_id: number;
    round_number: number;
    status: string;
    created_at: string;
    player1_move: string | null;
    player2_move: string | null;
    winner_id: number | null;
    completed_at: string | null;
}

interface UserInfo {
    id: number;
    solana_address: string;
    nickname: string | null;
}

export default function Round() {
    const { publicKey } = useWallet();
    const [userId, setUserId] = useState<number | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [componentKey, setComponentKey] = useState(0);
    const [userMatchIds, setUserMatchIds] = useState<number[]>([]);

    const isMobile = useBreakpointValue({ base: true, md: false });

    // Use ref to track current round ID for subscription comparison
    const currentRoundIdRef = useRef<number | null>(null);

    // Fetch user's match IDs
    const fetchUserMatches = useCallback(async (solanaAddress: string) => {
        try {

            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('solana_address', solanaAddress)
                .single();

            if (userError || !user) {
                throw new Error('User not found');
            }

            const { data: matchParticipants, error: matchError } = await supabase
                .from('match_participants')
                .select('match_id')
                .eq('user_id', user.id);

            if (matchError) {
                throw new Error('Failed to fetch user matches');
            }

            const matchIds = matchParticipants?.map(mp => mp.match_id) || [];

            setUserMatchIds(matchIds);
            return matchIds;
        } catch (error) {
            console.error('❌ Error fetching user matches:', error);
            throw error;
        }
    }, []);

    // Fetch round information
    const fetchRoundInfo = useCallback(async () => {
        if (!publicKey) {
            setError('Wallet not connected');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);


            // Fetch user info, match IDs, and latest round info
            const [userResult] = await Promise.all([
                database.users.getByWallet(publicKey.toString()),
                fetchUserMatches(publicKey.toString())
            ]);

            if (!userResult) {
                throw new Error('User not found');
            }

            // Now fetch the latest round
            const roundResult = await database.games.findLatestGameRoundForUser(publicKey.toString());

            if (!roundResult) {
                throw new Error('No active game round found');
            }


            setUserInfo(userResult);
            setUserId(userResult.id);
            setRoundInfo(roundResult as RoundInfo);
            currentRoundIdRef.current = roundResult.id;

        } catch (error) {
            console.error('❌ Error fetching round information:', error);
            setError(error instanceof Error ? error.message : 'Unknown error occurred');
        } finally {
            setLoading(false);
        }
    }, [publicKey, fetchUserMatches]);

    // Initial fetch
    useEffect(() => {
        fetchRoundInfo();
    }, [fetchRoundInfo]);

    // Real-time subscription for round updates
    useEffect(() => {
        if (!userMatchIds.length || !userInfo) {
            return;
        }


        // Create a single channel for all match-related updates
        const channel = supabase
            .channel(`user-game-updates-${userInfo.id}`)
            // .on(
            //     'postgres_changes',
            //     {
            //         event: 'UPDATE',
            //         schema: 'public',
            //         table: 'game_rounds',
            //     },
            //     async (payload) => {
            //         const updatedRound = payload.new as RoundInfo;

            //         // Check if this update is for one of our matches
            //         if (!userMatchIds.includes(updatedRound.match_id)) {
            //             return;
            //         }

            //         // If this is our current round being updated
            //         if (updatedRound.id === currentRoundIdRef.current) {

            //             if (updatedRound.status === 'completed') {

            //                 // Wait for potential new round creation
            //                 setTimeout(async () => {
            //                     try {
            //                         const newRoundResult = await database.games.findLatestGameRoundForUser(userInfo.solana_address);

            //                         if (newRoundResult && newRoundResult.id !== currentRoundIdRef.current) {
            //                             setComponentKey(prev => prev + 1);
            //                             await fetchRoundInfo();
            //                         } else {
            //                             setRoundInfo(updatedRound);
            //                         }
            //                     } catch (error) {
            //                         setRoundInfo(updatedRound);
            //                     }
            //                 }, 2000); // Increased wait time
            //             } else {
            //                 setRoundInfo(updatedRound);
            //             }
            //         }
            //     }
            // )
            // UPDATE handler
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'game_rounds',
                },
                async (payload) => {
                    const updatedRound = payload.new as RoundInfo;

                    // Check if this update is for one of our matches
                    if (!userMatchIds.includes(updatedRound.match_id)) {
                        return;
                    }

                    // Only process updates for our current round
                    if (updatedRound.id === currentRoundIdRef.current) {

                        // Only update if the round is actually completed AND has moves from both players
                        if (updatedRound.status === 'completed' &&
                            updatedRound.player1_move &&
                            updatedRound.player2_move) {
                            setRoundInfo(updatedRound);

                            // Don't immediately check for new rounds - let the INSERT handler do that
                        } else {
                        }
                    }
                }
            )
            // INSERT handler
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'game_rounds',
                },
                async (payload) => {
                    const newRound = payload.new as RoundInfo;

                    // Check if this insert is for one of our matches
                    if (!userMatchIds.includes(newRound.match_id)) {
                        return;
                    }

                    // Check if this is a newer round than our current one
                    if (newRound.id !== currentRoundIdRef.current) {

                        // Always refetch to get the latest round
                        setTimeout(async () => {
                            try {
                                const latestRound = await database.games.findLatestGameRoundForUser(userInfo.solana_address);

                                if (latestRound && latestRound.id !== currentRoundIdRef.current) {
                                    setComponentKey(prev => prev + 1);
                                    await fetchRoundInfo();
                                }
                            } catch (error) {
                                console.error('❌ Error verifying new round:', error);
                            }
                        }, 1000);
                    }
                }
            )
            .subscribe(() => {
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userMatchIds, userInfo?.id, userInfo?.solana_address, fetchRoundInfo]);


    // Loading state
    if (loading) {
        return (
            <Box p={6} textAlign="center">
                <Card.Root
                    bg="bg.default"
                    border="2px solid"
                    borderColor="border.default"
                    borderRadius="sm"
                    shadow="brutalist.md"
                >
                    <Card.Body p={6}>
                        <VStack padding={4}>
                            <Spinner size="lg" color="primary.emphasis" />
                            <Text fontSize="md" fontWeight="bold" color="fg.default" textTransform="uppercase">
                                Loading Round Information...
                            </Text>
                            <Text fontSize="xs" color="fg.muted">
                                Fetching latest game data
                            </Text>
                        </VStack>
                    </Card.Body>
                </Card.Root>
            </Box>
        );
    }

    // Error state
    if (error) {
        return (
            <Box p={6} textAlign="center">
                <Card.Root
                    bg="error"
                    color="fg.inverted"
                    border="2px solid"
                    borderColor="border.default"
                    borderRadius="sm"
                    shadow="brutalist.md"
                >
                    <Card.Body p={6}>
                        <VStack padding={4}>
                            <AlertTriangle size={36} />
                            <Text fontSize="md" fontWeight="bold" textTransform="uppercase">
                                Round Error
                            </Text>
                            <Text fontSize="sm" textAlign="center">
                                {error}
                            </Text>
                            <Button
                                onClick={fetchRoundInfo}
                                bg="fg.inverted"
                                color="error"
                                border="2px solid"
                                borderColor="fg.inverted"
                                borderRadius="sm"
                                shadow="brutalist.sm"
                                fontWeight="bold"
                                textTransform="uppercase"
                                // leftIcon={<RefreshCw size={16} />}
                                _hover={{
                                    transform: "translate(-1px, -1px)",
                                    shadow: "brutalist.md",
                                }}
                            >
                                Retry
                            </Button>
                            {!isMobile && (
                                <Text fontSize="xs" opacity={0.8}>
                                    Check console for debug info
                                </Text>
                            )}
                        </VStack>
                    </Card.Body>
                </Card.Root>
            </Box>
        );
    }

    // No data state
    if (!roundInfo || !userId) {
        return (
            <Box p={6} textAlign="center">
                <Card.Root
                    bg="brutalist.gray.100"
                    color="fg.default"
                    border="2px solid"
                    borderColor="border.default"
                    borderRadius="sm"
                    shadow="brutalist.md"
                >
                    <Card.Body p={6}>
                        <VStack padding={4}>
                            <Text fontSize="3xl">🔍</Text>
                            <Text fontSize="md" fontWeight="bold" textTransform="uppercase">
                                No Active Round Found
                            </Text>
                            <Button
                                onClick={fetchRoundInfo}
                                bg="primary.emphasis"
                                color="fg.inverted"
                                border="2px solid"
                                borderColor="border.default"
                                borderRadius="sm"
                                shadow="brutalist.sm"
                                fontWeight="bold"
                                textTransform="uppercase"
                                // leftIcon={<RefreshCw size={16} />}
                                _hover={{
                                    transform: "translate(-1px, -1px)",
                                    shadow: "brutalist.md",
                                }}
                            >
                                Refresh
                            </Button>
                            {!isMobile && (
                                <Text fontSize="xs" color="fg.muted">
                                    Matches: {userMatchIds.join(', ') || 'None'}
                                </Text>
                            )}
                        </VStack>
                    </Card.Body>
                </Card.Root>
            </Box>
        );
    }

    return (
        <Box key={componentKey} border={'none'} shadow={'none'}>
            {/* <VStack padding={6} align="stretch"> */}

            {/* Timer Component */}
            <Box display="flex" justifyContent="center">
                <Timer
                    gameId={roundInfo.id}
                    key={`timer-${componentKey}-${roundInfo.id}`}
                />
            </Box>

            {/* Battlefield Component */}
            <Box>
                <Battlefield
                    roundId={roundInfo.id}
                    userId={userId}
                    key={`battlefield-${componentKey}-${roundInfo.id}`}
                />
            </Box>

            {/* Choose Move Component */}
            <Box>
                <ChooseMove
                    gameRoundNumber={roundInfo.round_number}
                    userId={userId}
                    matchId={roundInfo.match_id}
                    key={`choosemove-${componentKey}-${roundInfo.id}`}
                />
            </Box>
            {/* </VStack> */}
        </Box>
    );
}