


import React, { useState, useEffect } from "react";
import { Button } from "@chakra-ui/react";

import { database } from "@/supabase/Database";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/supabase";

// Components
import Game from "./Game";
import NotInGame from "./NotInGame";


// supabase channel to listen to match updates
// listen to match_participants deletions and insertions to see
// if our user with his id is added to the game or not
// const matchChannel = supabase
//     .channel("match_updates")
//     .on(
//         "postgres_changes",
//         { event: "INSERT", schema: "public", table: "match_participants" },
//         (payload) => {
//             console.log("Match participant added:", payload);
//             // handle the event when a match participant is added
//         }
//     )
//     .on(
//         "postgres_changes",
//         { event: "DELETE", schema: "public", table: "match_participants" },
//         (payload) => {
//             console.log("Match participant removed:", payload);
//             // handle the event when a match participant is removed
//         }
//     )
//     .subscribe((status) => {
//         if (status === "SUBSCRIBED") {
//             console.log("Subscribed to match updates channel");
//         } else {
//             console.error("Failed to subscribe to match updates channel");
//         }
//     }
// );



/**
 * @function GamePage
 * 
 * This Component represents the Game "Page"
 * It will contain the game itself and will work with the game features
 * in the context of the application
 * - rendering the game UI accordingly
 * - fetching the general user data & game participation (not handling the game / round logic)
 * - hiding / showing the UI based on the application state
 * 
 * * the actual game & game logic will be implemented
 * * in its child components, that will again be standalone
 * 
 * @returns JSX.Element representing the Game Page
 */
export default function GamePage() {

    // #region State Management
    const { publicKey } = useWallet();
    const [loading, setLoading] = useState(false);
    const [isParticipant, setIsParticipant] = useState(false);
    // #endregion State Management


    useEffect(() => {
        if (publicKey) fetchUserParticipation();
    }, [publicKey]);


    // #region fetches
    async function fetchUserParticipation() {
        try {
            setLoading(true);
            const participation = await database.games.isInTournamentOrMatch(publicKey!.toBase58())
            setIsParticipant(participation);
        } catch (error) {
            console.error("Error fetching user participation:", error);
        } finally {
            setLoading(false);
        }
    }
    // #endregion fetches


    // #region Handlers
    // #endregion Handlers


    return (
        <div className="game-container">
            <h1>Game Component</h1>
            <p>This is the game component where you can implement your game logic.</p>

            {loading ? (<p>Loading...</p>) : isParticipant ? (
                <Game />
            ) : (
                <NotInGame />
            )}

            <Button
                colorScheme="blue"
                onClick={fetchUserParticipation}
                // isLoading={loading}
                loading={loading}
                loadingText="Checking Participation"
            >Check Participation</Button>

        </div>
    );
}