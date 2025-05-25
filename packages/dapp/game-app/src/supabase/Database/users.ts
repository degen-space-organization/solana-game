
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
}

