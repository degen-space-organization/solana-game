
import type { User } from "@/types/lobby";
import { supabase } from "..";



export const users = {

    /**
     * Fetches all users from the database
     * @returns {Promise<User[]>} - Returns a list of users
     */
    async getAll(): Promise<User[]> {
        const { data, error } = await supabase.from('users').select('*');

        if (error) {
            console.error("Error fetching users:", error);
            return [];
        }

        if (data && data.length > 0) {
            return data as User[];
        } else {
            console.warn("No users found.");
            return [];
        }
    },


    /**
     * Fetches a user by their wallet address
     * @returns {Promise<User | null>} - Returns a user object or null if not found
     */
    async getByWallet(walletAddress: string): Promise<User | null> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('solana_address', walletAddress)
            .single();

        if (error) {
            console.error("Error fetching user by wallet address:", error);
            return null;
        }

        if (data) {
            return data as User;
        } else {
            console.warn(`User with wallet address ${walletAddress} not found.`);
            return null;
        }
    },
    

    async updateNickname(walletAddress:string, nickname: string) : Promise<User | null> {
        const { data, error } = await supabase
            .from('users')
            .update({ nickname: nickname, updated_at: new Date().toISOString() })
            .eq('solana_address', walletAddress)
            .select('*')
            .single();

        if (error) {
            console.error("Error updating nickname:", error);
            return null;
        }
        if (data) {
            return data as User;
        } else {
            console.warn(`User with wallet address ${walletAddress} not found for nickname update.`);
            return null;
        }
    },

    async createUser(walletAddress: string): Promise<User | null> {
        const { data, error } = await supabase
            .from('users')
            .insert({
                solana_address: walletAddress,
                nickname: null, // Initialize nickname as null or a default value
            })
            .select('*')
            .single();
        if (error) {
            console.error("Error creating user:", error);
            return null;
        }
        if (data) {
            return data as User;
        } else {
            console.warn(`User with wallet address ${walletAddress} already exists.`);
            return null;
        }
    },



    // async upsertUser (solanaAddress: string) {
    //     try {
    //     const { data, error } = await supabase
    //     .from('users')
    //     .upsert(
    //         {
    //         solana_address: solanaAddress,
    //         nickname: null, // Initialize nickname as null or a default value
    //         created_at: new Date().toISOString(),
    //         updated_at: new Date().toISOString(),
    //         },
    //         // { onConflict: 'solana_address' } // Conflict on solana_address to update existing or insert new
    //         { onConflict: 'handle' } // Conflict on solana_address to update existing or insert new
    //     )
    //     .select(); // Use select() to get the inserted/updated row

    //     if (error) {
    //     throw error;
    //     }
    //     console.log('User upserted successfully:', data);
    //     return data;
    // } catch (error) {
    //     console.error('Error upserting user:', error);
    //     return null;
    // }
    // }
}

