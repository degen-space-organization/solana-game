/**
 * Supabase db transactions for lobbies
 * 
 * @module lobbies
 * 
 * part of the bigger supabase db transactions scope
 */

import type { PendingLobby, ActiveLobbyDetails } from "../../types/lobby";
import { supabase } from "..";
import { LAMPORTS_PER_SOL } from '@solana/web3.js'; // Import LAMPORTS_PER_SOL


export const lobbies = {

    /**
     * Fetches all lobbies from the database
     * @returns {Promise<PendingLobby[]>} - Returns a list of pending lobbies
     */
    async getAll(): Promise<PendingLobby[]> {

        const {data, error} = await supabase.from('lobbies').select(`*`)

        if (error) {
            console.error("Error fetching pending lobbies:", error);
            return [];
        }

        if (data && data.length > 0) {
            return data.map((lobby: any) => ({
                ...lobby,
                stake_amount_sol: parseFloat(lobby.stake_amount) / 1e9, // Convert lamports to SOL
                total_prize_pool_sol: parseFloat(lobby.stake_amount) * lobby.current_players / 1e9, // Total prize pool in SOL
                is_tournament: !!lobby.tournament_id,
                time_since_created: new Date(lobby.created_at).toLocaleString(), // Format as needed
            })) as PendingLobby[];
        } else {
            console.warn("No pending lobbies found.");
            return [];
        };
    },

    /**
     * Fetches lobbies that a specific user has joined.
     * @param userId The ID of the user whose joined lobbies are to be fetched.
     * @returns {Promise<PendingLobby[]>} - Returns a list of lobbies the user has joined.
     */
    async getJoined(userId: number): Promise<PendingLobby[]> {
        // Fetch lobbies the user has participated in
        const { data: participantData, error: participantError } = await supabase
            .from('lobby_participants')
            .select(`
                lobby_id,
                lobbies (
                    *,
                    created_by_user:users!lobbies_created_by_fkey(id, nickname, solana_address, matches_won, matches_lost)
                )
            `)
            .eq('user_id', userId);

        if (participantError) {
            console.error("Error fetching joined lobby participants:", participantError);
            return [];
        }

        if (participantData && participantData.length > 0) {
            const joinedLobbies = participantData
                .map((p: any) => p.lobbies) // Extract the nested lobby object
                .filter(Boolean) as any[]; // Filter out any null lobbies if they exist

            return joinedLobbies.map((lobby: any) => ({
                ...lobby,
                stake_amount_sol: parseFloat(lobby.stake_amount) / 1e9,
                total_prize_pool_sol: (parseFloat(lobby.stake_amount) * lobby.max_players!) / 1e9,
                is_tournament: !!lobby.tournament_id,
                time_since_created: new Date(lobby.created_at).toLocaleString(),
            })) as PendingLobby[];
        } else {
            console.warn(`No lobbies found for user ID ${userId}.`);
            return [];
        }
    },

    async getById(lobbyId: number): Promise<PendingLobby | null> {
        const { data, error } = await supabase
            .from('lobbies')
            .select(`
                *,
                created_by_user:users!lobbies_created_by_fkey(id, nickname, solana_address, matches_won, matches_lost)
            `)
            .eq('id', lobbyId)
            .single(); // Use .single() to expect one result

        if (error) {
            console.error(`Error fetching lobby with ID ${lobbyId}:`, error);
            return null;
        }

        if (data) {
            return {
                ...data,
                stake_amount_sol: parseFloat(data.stake_amount) / 1e9,
                total_prize_pool_sol: (parseFloat(data.stake_amount) * data.max_players!) / 1e9,
                is_tournament: !!data.tournament_id,
                time_since_created: new Date(data.created_at!).toLocaleString(),
            } as PendingLobby;
        } else {
            console.warn(`Lobby with ID ${lobbyId} not found.`);
            return null;
        }
    },

}