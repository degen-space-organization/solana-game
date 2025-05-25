/**
 * Supabase db transactions for lobbies
 * 
 * @module lobbies
 * 
 * part of the bigger supabase db transactions scope
 */

import type { PendingLobby } from "@/types/lobby";
import { supabase } from "..";


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


}