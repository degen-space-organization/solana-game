import { supabase } from '../index';

export const upsertUser = async (solanaAddress: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          solana_address: solanaAddress,
          nickname: null, // Initialize nickname as null or a default value
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'solana_address' } // Conflict on solana_address to update existing or insert new
      )
      .select(); // Use select() to get the inserted/updated row

    if (error) {
      throw error;
    }
    console.log('User upserted successfully:', data);
    return data;
  } catch (error) {
    console.error('Error upserting user:', error);
    return null;
  }
};

export const getUserBySolanaAddress = async (solanaAddress: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('solana_address', solanaAddress)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching user by Solana address:', error);
    return null;
  }
};