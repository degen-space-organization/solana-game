/**
 * Supabase db transactions for tournaments
 * 
 * @module tournaments
 * 
 * part of the bigger supabase db transactions scope
 */

import type { PendingTournament } from "../../types/tournament";
import type { User } from "../../types/index";

import { supabase } from "..";
// Extended types for tournament usage


export const tournaments = {

    /**
     * Fetches all tournaments from the database
     * @returns {Promise<PendingTournament[]>} - Returns a list of tournaments
     */
    async getAll(): Promise<PendingTournament[]> {
        const { data, error } = await supabase
            .from('tournaments')
            .select(`*`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching tournaments:", error);
            return [];
        }

        if (data && data.length > 0) {
            return data.map((tournament: any) => ({
                ...tournament,
                prize_pool_sol: parseFloat(tournament.prize_pool || '0') / 1e9, // Convert lamports to SOL
                entry_fee_sol: parseFloat(tournament.prize_pool || '0') / (tournament.max_players * 1e9), // Calculate entry fee
                time_since_created: new Date(tournament.created_at).toLocaleString(),
                can_start: tournament.current_players === tournament.max_players,
                slots_remaining: tournament.max_players - tournament.current_players,
            })) as PendingTournament[];
        } else {
            console.warn("No tournaments found.");
            return [];
        }
    },

    /**
     * Fetches all participants of a specific tournament
     * @param tournamentId The ID of the tournament to fetch participants for
     * 
     * @returns {Promise<User[]>} - Returns a list of users who participated in the tournament
     */
    async getAllTournamentParticipants(tournamentId: number | null): Promise<User[]> {
        if (!tournamentId) {
            console.warn("No tournament ID provided.");
            return [];
        }
        const { data, error } = await supabase
            .from('tournament_participants')
            .select(`
                *,
                users (
                    id,
                    nickname,
                    solana_address,
                    matches_won,
                    matches_lost
                )
            `)
            .eq('tournament_id', tournamentId)
            .order('joined_at', { ascending: true });
        if (error) {
            console.error("Error fetching tournament participants:", error);
            return [];
        }
        if (data && data.length > 0) {
            return data.map((participant: any) => ({
                ...participant.users, // Extract user details
                joined_at: participant.joined_at, // Include joined_at timestamp
            })) as User[];
        } else {
            console.warn(`No participants found for tournament ID ${tournamentId}.`);
            return [];
        }
    },

    /**
     * Fetches tournaments that a specific user has joined.
     * @param userId The ID of the user whose joined tournaments are to be fetched.
     * @returns {Promise<PendingTournament[]>} - Returns a list of tournaments the user has joined.
     */
    async getJoined(userId: number): Promise<PendingTournament[]> {
        const { data: participantData, error: participantError } = await supabase
            .from('tournament_participants')
            .select(`
                tournament_id,
                tournaments (
                    *,
                    created_by_user:users!tournaments_created_by_fkey(id, nickname, solana_address, matches_won, matches_lost)
                )
            `)
            .eq('user_id', userId);

        if (participantError) {
            console.error("Error fetching joined tournament participants:", participantError);
            return [];
        }

        if (participantData && participantData.length > 0) {
            const joinedTournaments = participantData
                .map((p: any) => p.tournaments) // Extract the nested tournament object
                .filter(Boolean) as any[]; // Filter out any null tournaments if they exist

            return joinedTournaments.map((tournament: any) => ({
                ...tournament,
                prize_pool_sol: parseFloat(tournament.prize_pool || '0') / 1e9,
                entry_fee_sol: parseFloat(tournament.prize_pool || '0') / (tournament.max_players * 1e9),
                time_since_created: new Date(tournament.created_at).toLocaleString(),
                can_start: tournament.current_players === tournament.max_players,
                slots_remaining: tournament.max_players - tournament.current_players,
            })) as PendingTournament[];
        } else {
            console.warn(`No tournaments found for user ID ${userId}.`);
            return [];
        }
    },

    /**
     * Fetches a tournament by ID with detailed information
     * @param tournamentId The ID of the tournament to fetch
     * @returns {Promise<PendingTournament | null>} - Returns the tournament details or null if not found
     */
    // async getById(tournamentId: number): Promise<PendingTournament | null> {
    //     const { data, error } = await supabase
    //         .from('tournaments')
    //         .select(`
    //             *,
    //             created_by_user:users!tournaments_created_by_fkey(id, nickname, solana_address, matches_won, matches_lost)
    //         `)
    //         .eq('id', tournamentId)
    //         .single(); // Use .single() to expect one result

    //     if (error) {
    //         console.error(`Error fetching tournament with ID ${tournamentId}:`, error);
    //         return null;
    //     }

    //     if (data) {
    //         return {
    //             ...data,
    //             prize_pool_sol: parseFloat(data.prize_pool || '0') / 1e9,
    //             entry_fee_sol: parseFloat(data.prize_pool || '0') / (data.max_players! * 1e9),
    //             time_since_created: new Date(data.created_at!).toLocaleString(),
    //             can_start: data.current_players === data.max_players,
    //             slots_remaining: data.max_players! - data.current_players!,
    //         } as PendingTournament;
    //     } else {
    //         console.warn(`Tournament with ID ${tournamentId} not found.`);
    //         return null;
    //     }
    // },

    /**
     * Fetches tournament participants by tournament ID
     * @param tournamentId The ID of the tournament to fetch participants for
     * @returns {Promise<any[]>} - Returns the tournament participants with user details
     */
    async getParticipants(tournamentId: number): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('tournament_participants')
                .select(`
                    *,
                    users (
                        id,
                        nickname,
                        solana_address,
                        matches_won,
                        matches_lost
                    )
                `)
                .eq('tournament_id', tournamentId)
                .order('joined_at', { ascending: true });

            if (error) {
                console.error("Error fetching tournament participants:", error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error("Error in getParticipants:", err);
            return [];
        }
    },

    /**
     * Fetches tournaments by status
     * @param status The status of tournaments to fetch ('waiting', 'in_progress', 'completed', 'cancelled')
     * @returns {Promise<PendingTournament[]>} - Returns a list of tournaments with the specified status
     */
    async getByStatus(status: 'waiting' | 'in_progress' | 'completed' | 'cancelled'): Promise<PendingTournament[]> {
        const { data, error } = await supabase
            .from('tournaments')
            .select(`*`)
            .eq('status', status)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(`Error fetching tournaments with status ${status}:`, error);
            return [];
        }

        if (data && data.length > 0) {
            return data.map((tournament: any) => ({
                ...tournament,
                prize_pool_sol: parseFloat(tournament.prize_pool || '0') / 1e9,
                entry_fee_sol: parseFloat(tournament.prize_pool || '0') / (tournament.max_players * 1e9),
                time_since_created: new Date(tournament.created_at).toLocaleString(),
                can_start: tournament.current_players === tournament.max_players,
                slots_remaining: tournament.max_players - tournament.current_players,
            })) as PendingTournament[];
        } else {
            console.warn(`No tournaments found with status ${status}.`);
            return [];
        }
    },

    /**
     * Fetches active tournaments (waiting or in_progress)
     * @returns {Promise<PendingTournament[]>} - Returns a list of active tournaments
     */
    async getActive(): Promise<PendingTournament[]> {
        const { data, error } = await supabase
            .from('tournaments')
            .select(`*`)
            .in('status', ['waiting', 'in_progress'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching active tournaments:", error);
            return [];
        }

        if (data && data.length > 0) {
            return data.map((tournament: any) => ({
                ...tournament,
                prize_pool_sol: parseFloat(tournament.prize_pool || '0') / 1e9,
                entry_fee_sol: parseFloat(tournament.prize_pool || '0') / (tournament.max_players * 1e9),
                time_since_created: new Date(tournament.created_at).toLocaleString(),
                can_start: tournament.current_players === tournament.max_players,
                slots_remaining: tournament.max_players - tournament.current_players,
            })) as PendingTournament[];
        } else {
            console.warn("No active tournaments found.");
            return [];
        }
    },

    /**
     * Fetches tournaments created by a specific user
     * @param userId The ID of the user who created the tournaments
     * @returns {Promise<PendingTournament[]>} - Returns a list of tournaments created by the user
     */
    async getCreatedBy(userId: number): Promise<PendingTournament[]> {
        const { data, error } = await supabase
            .from('tournaments')
            .select(`
                *,
                created_by_user:users!tournaments_created_by_fkey(id, nickname, solana_address, matches_won, matches_lost)
            `)
            .eq('created_by', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(`Error fetching tournaments created by user ${userId}:`, error);
            return [];
        }

        if (data && data.length > 0) {
            return data.map((tournament: any) => ({
                ...tournament,
                prize_pool_sol: parseFloat(tournament.prize_pool || '0') / 1e9,
                entry_fee_sol: parseFloat(tournament.prize_pool || '0') / (tournament.max_players * 1e9),
                time_since_created: new Date(tournament.created_at).toLocaleString(),
                can_start: tournament.current_players === tournament.max_players,
                slots_remaining: tournament.max_players - tournament.current_players,
            })) as PendingTournament[];
        } else {
            console.warn(`No tournaments found created by user ${userId}.`);
            return [];
        }
    },

    /**
     * Fetches tournament standings/leaderboard with final positions
     * @param tournamentId The ID of the tournament to fetch standings for
     * @returns {Promise<any[]>} - Returns tournament participants ordered by final position
     */
    async getStandings(tournamentId: number): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('tournament_participants')
                .select(`
                    *,
                    users (
                        id,
                        nickname,
                        solana_address,
                        matches_won,
                        matches_lost
                    )
                `)
                .eq('tournament_id', tournamentId)
                .order('final_position', { ascending: true  })
                .order('eliminated_at', { ascending: false });

            if (error) {
                console.error("Error fetching tournament standings:", error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error("Error in getStandings:", err);
            return [];
        }
    },

    /**
     * Get tournament bracket information (matches for this tournament)
     * @param tournamentId The ID of the tournament
     * @returns {Promise<any[]>} - Returns matches for this tournament
     */
    async getBracket(tournamentId: number): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('matches')
                .select(`
                    *,
                    match_participants (
                        user_id,
                        position,
                        users (
                            id,
                            nickname,
                            solana_address
                        )
                    )
                `)
                .eq('tournament_id', tournamentId)
                .order('tournament_round', { ascending: true })
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Error fetching tournament bracket:", error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error("Error in getBracket:", err);
            return [];
        }
    },

}