import { useState, useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/supabase';
import { games, type GameData } from '@/supabase/Database/game';
import Round from "./Battlefield/Round";
import MatchResult from "./MatchResult/MatchResult";

export default function Match() {
    const { publicKey } = useWallet();
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [loading, setLoading] = useState(true);
    const [matchStatus, setMatchStatus] = useState<string | null>(null);
    const [winnerId, setWinnerId] = useState<number | null>(null);

    const fetchCurrentMatch = async () => {
        if (!publicKey) {
            console.log("No wallet connected. Cannot fetch current game.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            console.log("🔍 Fetching current match for wallet:", publicKey.toBase58());
            
            // Fetch the current active game for the connected wallet
            const data = await games.getCurrentGameByWallet(publicKey.toBase58());
            
            if (data) {
                console.log("✅ Found active match:", data.match.id, "Status:", data.match.status);
                setGameData(data);
                setMatchStatus(data.match.status);
                setWinnerId(data.match.winner_id);
            } else {
                console.log("❌ No active match found");
                setGameData(null);
                setMatchStatus(null);
                setWinnerId(null);
            }
        } catch (error) {
            console.error("❌ Failed to fetch current game data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch on component mount
    useEffect(() => {
        fetchCurrentMatch();
    }, [publicKey]);

    // Set up real-time subscription for match updates
    useEffect(() => {
        if (!gameData?.match?.id) {
            console.log("⏭️ No match ID available for subscription");
            return;
        }

        const matchId = gameData.match.id;
        console.log("🔔 Setting up real-time subscription for match:", matchId);

        const channel = supabase
            .channel(`match-status-${matchId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'matches',
                    filter: `id=eq.${matchId}`,
                },
                (payload) => {
                    console.log("🔄 Match status update received:", payload.new);
                    const updatedMatch = payload.new;
                    
                    // Update local state with new status and winner
                    setMatchStatus(updatedMatch.status);
                    setWinnerId(updatedMatch.winner_id);
                    
                    // Update gameData to keep it in sync
                    setGameData(prevData => {
                        if (!prevData) return null;
                        return {
                            ...prevData,
                            match: {
                                ...prevData.match,
                                status: updatedMatch.status,
                                winner_id: updatedMatch.winner_id,
                                completed_at: updatedMatch.completed_at,
                            }
                        };
                    });
                }
            )
            .subscribe((status) => {
                console.log("📡 Subscription status:", status);
            });

        // Cleanup subscription on unmount or when match changes
        return () => {
            console.log("🧹 Cleaning up match subscription for:", matchId);
            supabase.removeChannel(channel);
        };
    }, [gameData?.match?.id]);

    // Loading state
    if (loading) {
        return (
            <Box p="8" textAlign="center">
                <h2>Loading Match Information...</h2>
                <p>Attempting to find your active game.</p>
            </Box>
        );
    }

    // No wallet connected
    if (!publicKey) {
        return (
            <Box p="8" textAlign="center">
                <h2>Wallet Not Connected</h2>
                <p>Please connect your Solana wallet to view your current match information.</p>
            </Box>
        );
    }

    // No active match found
    if (!gameData) {
        return (
            <Box p="8" textAlign="center">
                <h2>No Active Match Found</h2>
                <p>It seems you are not currently in an active game. Join a new match to start playing!</p>
            </Box>
        );
    }

    // Debug info
    console.log("🎮 Rendering Match component with status:", matchStatus);

    return (
        <Box border="none" shadow="none">
            {/* Debug status display */}
            <Box mb="4" p="2" bg="gray.100" borderRadius="md" fontSize="sm" color="gray.600">
                Match #{gameData.match.id} • Status: <strong>{matchStatus}</strong>
                {winnerId && ` • Winner ID: ${winnerId}`}
            </Box>

            {/* Render appropriate component based on match status */}
            {matchStatus === 'in_progress' && (
                <Round />
            )}
            
            {(matchStatus === 'showing_results') && (
                <MatchResult 
                    gameData={gameData}
                    winnerId={winnerId}
                />
            )}

            {/* Fallback for unexpected status */}
            {!['in_progress', 'showing_results', 'completed'].includes(matchStatus || '') && (
                <Box p="8" textAlign="center">
                    <h3>Unexpected Match Status</h3>
                    <p>Status: {matchStatus}</p>
                    <p>Please wait or refresh the page.</p>
                </Box>
            )}
        </Box>
    );
}