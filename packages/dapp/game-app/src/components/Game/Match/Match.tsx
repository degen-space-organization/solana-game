import React, { useState, useEffect } from 'react';
import MatchInfo, { type MatchParticipant } from "./MatchInfo/MatchInfo";
import Round from "./Battlefield/Round";
import MatchResult from "./MatchResult/MatchResult";
import { games, type GameData } from '@/supabase/Database/game'; // Import games and GameData utilities
import { useWallet } from '@solana/wallet-adapter-react'; // Import useWallet hook

export default function Match() {
    const { publicKey } = useWallet(); // Get the connected wallet's publicKey
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCurrentMatch = async () => {
            setLoading(true);
            setGameData(null); // Clear previous game data

            if (!publicKey) {
                console.log("No wallet connected. Cannot fetch current game.");
                setLoading(false);
                return; // Exit if no wallet is connected
            }

            try {
                // Fetch the current active game for the connected wallet
                const data = await games.getCurrentGameByWallet(publicKey.toBase58());
                setGameData(data);
            } catch (error) {
                console.error("Failed to fetch current game data:", error);
                // Optionally show an error message to the user
            } finally {
                setLoading(false);
            }
        };

        fetchCurrentMatch();
    }, [publicKey]); // Re-run this effect when the connected wallet (publicKey) changes

    if (loading) {
        return (
            <div className="match-info">
                <h2>Loading Match Information...</h2>
                <p>Attempting to find your active game.</p>
                {/* You can add a spinner or loading animation here */}
            </div>
        );
    }

    if (!publicKey) {
        return (
            <div className="match-info">
                <h2>Wallet Not Connected</h2>
                <p>Please connect your Solana wallet to view your current match information.</p>
            </div>
        );
    }

    if (!gameData) {
        return (
            <div className="match-info">
                <h2>No Active Match Found</h2>
                <p>It seems you are not currently in an active game. Join a new match to start playing!</p>
            </div>
        );
    }

    // Destructure the necessary data from gameData for MatchInfo
    const matchId = gameData.match.id;
    const participants = gameData.participants;
    const status = gameData.match.status;

    return (
        <div className="match-info">
            <h2>Match Information</h2>
            <p>This section will display information about the match, such as match name, participating players, scores, and current status.</p>

            <MatchInfo
                matchId={matchId}
                // participants={participants as MatchParticipant[]} 
                // @ts-ignore
                participants={participants}
                // @ts-ignore
                status={status}
            />

            {/* Conditionally render Round or MatchResult based on the match status */}
            {status === 'in_progress' && <Round />}
            {status === 'completed' && <MatchResult />}
        </div>
    );
}