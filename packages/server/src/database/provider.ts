import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";


config({
    path: `${path.join(__dirname, "../../.env")}`
});

/**
 * In this module the supabase SDK client is configured
 * 
 * https://supabase.com/docs/reference/javascript/introduction
 */

const supabaseUrl: string = process.env.SUPABASE_URL || "default_url";
const supabaseAnonKey: string = process.env.SUPABASE_KEY || "default_key";

/** Check if they exist */
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('No Supabase keys provided!')
}

/** Export the client */
// export const dbClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
export const dbClient = createClient(supabaseUrl, supabaseAnonKey);


