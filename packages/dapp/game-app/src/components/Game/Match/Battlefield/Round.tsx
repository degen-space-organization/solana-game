import { database } from '@/supabase/Database';
import { supabase } from '@/supabase';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState, useCallback, useRef } from 'react';

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

    // Use ref to track current round ID for subscription comparison
    const currentRoundIdRef = useRef<number | null>(null);

    // Fetch user's match IDs
    const fetchUserMatches = useCallback(async (solanaAddress: string) => {
        try {
            console.log('🔍 Fetching user matches for:', solanaAddress);

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
            console.log('📍 User is in matches:', matchIds);

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

            console.log('🔄 Fetching round info for:', publicKey.toString());

            // Fetch user info, match IDs, and latest round info
            const [userResult, matchIds] = await Promise.all([
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

            console.log('✅ Fetched round information:', roundResult);
            console.log('✅ Fetched user information:', userResult);

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
            console.log('⏳ Waiting for user match IDs...', { userMatchIds, userInfo: !!userInfo });
            return;
        }

        console.log('🔔 Setting up real-time subscriptions for matches:', userMatchIds);

        // Create a single channel for all match-related updates
        const channel = supabase
            .channel(`user-game-updates-${userInfo.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'game_rounds',
                },
                async (payload) => {
                    const updatedRound = payload.new as RoundInfo;
                    console.log('🔄 Round UPDATE detected:', updatedRound);

                    // Check if this update is for one of our matches
                    if (!userMatchIds.includes(updatedRound.match_id)) {
                        console.log('⏭️ Update not for our matches, ignoring');
                        return;
                    }

                    // If this is our current round being updated
                    if (updatedRound.id === currentRoundIdRef.current) {
                        console.log('📝 Current round updated:', updatedRound);

                        if (updatedRound.status === 'completed') {
                            console.log('✅ Current round completed, checking for new rounds...');

                            // Wait for potential new round creation
                            setTimeout(async () => {
                                try {
                                    const newRoundResult = await database.games.findLatestGameRoundForUser(userInfo.solana_address);

                                    if (newRoundResult && newRoundResult.id !== currentRoundIdRef.current) {
                                        console.log('🆕 New round found, remounting component:', newRoundResult);
                                        setComponentKey(prev => prev + 1);
                                        await fetchRoundInfo();
                                    } else {
                                        console.log('📍 No new round found, updating current round info');
                                        setRoundInfo(updatedRound);
                                    }
                                } catch (error) {
                                    console.error('❌ Error checking for new rounds:', error);
                                    setRoundInfo(updatedRound);
                                }
                            }, 2000); // Increased wait time
                        } else {
                            console.log('📝 Updating current round status to:', updatedRound.status);
                            setRoundInfo(updatedRound);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'game_rounds',
                },
                async (payload) => {
                    const newRound = payload.new as RoundInfo;
                    console.log('🆕 New round INSERT detected:', newRound);

                    // Check if this insert is for one of our matches
                    if (!userMatchIds.includes(newRound.match_id)) {
                        console.log('⏭️ Insert not for our matches, ignoring');
                        return;
                    }

                    // Check if this is a newer round than our current one
                    if (newRound.id !== currentRoundIdRef.current) {
                        console.log('🚀 New round for our match detected, checking if it\'s newer...');

                        // Always refetch to get the latest round
                        setTimeout(async () => {
                            try {
                                const latestRound = await database.games.findLatestGameRoundForUser(userInfo.solana_address);

                                if (latestRound && latestRound.id !== currentRoundIdRef.current) {
                                    console.log('🔄 Newer round confirmed, remounting component:', latestRound);
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
            .subscribe((status) => {
                console.log('📡 Subscription status:', status);
            });

        return () => {
            console.log('🧹 Cleaning up real-time subscription');
            supabase.removeChannel(channel);
        };
    }, [userMatchIds, userInfo?.id, userInfo?.solana_address, fetchRoundInfo]);

    // Debug effect to log state changes
    useEffect(() => {
        console.log('🏷️ Component state changed:', {
            componentKey,
            roundId: roundInfo?.id,
            roundNumber: roundInfo?.round_number,
            status: roundInfo?.status,
            matchId: roundInfo?.match_id,
            userId
        });
    }, [componentKey, roundInfo?.id, roundInfo?.round_number, roundInfo?.status, roundInfo?.match_id, userId]);

    // Loading state
    if (loading) {
        return (
            <div className="round-info" style={{ padding: '20px', textAlign: 'center' }}>
                <div>Loading round information...</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Check console for debug info
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="round-info" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ color: 'red' }}>Error: {error}</div>
                <button
                    onClick={fetchRoundInfo}
                    style={{ marginTop: '10px', padding: '5px 10px' }}
                >
                    Retry
                </button>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Check console for debug info
                </div>
            </div>
        );
    }

    // No data state
    if (!roundInfo || !userId) {
        return (
            <div className="round-info" style={{ padding: '20px', textAlign: 'center' }}>
                <div>No active round found</div>
                <button
                    onClick={fetchRoundInfo}
                    style={{ marginTop: '10px', padding: '5px 10px' }}
                >
                    Refresh
                </button>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Matches: {userMatchIds.join(', ') || 'None'} | Check console for debug info
                </div>
            </div>
        );
    }

    return (
        <div className="round-info" key={componentKey}>
            {/* Enhanced debug info */}
            <div style={{
                fontSize: '12px',
                color: '#666',
                marginBottom: '10px',
                padding: '5px',
                background: '#f0f0f0',
                borderRadius: '3px'
            }}>
                <div>🎮 Round {roundInfo.round_number} (ID: {roundInfo.id}) • Status: <strong>{roundInfo.status}</strong></div>
                <div>🎯 Match: {roundInfo.match_id} • Component Key: {componentKey} • User Matches: {userMatchIds.join(', ')}</div>
                <div>⏰ Created: {new Date(roundInfo.created_at).toLocaleTimeString()}</div>
            </div>

            <Battlefield
                roundId={roundInfo.id}
                userId={userId}
                key={`battlefield-${componentKey}-${roundInfo.id}`}
            />

            <Timer
                gameId={roundInfo.id}
                key={`timer-${componentKey}-${roundInfo.id}`}
            />

            <ChooseMove
                gameRoundNumber={roundInfo.round_number}
                userId={userId}
                matchId={roundInfo.match_id}
                key={`choosemove-${componentKey}-${roundInfo.id}`}
            />

            <button
                onClick={async () => {
                    console.log('🔄 Manual refresh triggered');
                    const latest = await database.games.findLatestGameRoundForUser(userInfo!.solana_address);
                    console.log('📋 Manual fetch result:', latest);
                    if (latest && latest.id !== roundInfo?.id) {
                        console.log('✅ Different round found manually');
                        setComponentKey(prev => prev + 1);
                        await fetchRoundInfo();
                    }
                }}
                style={{ margin: '10px', padding: '5px 10px' }}
            >
                Manual Refresh
            </button>
        </div>
    );
}