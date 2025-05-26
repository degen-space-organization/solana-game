import path from "path";
import { config } from "dotenv";
import { Database } from "./types";
import { createClient } from "@supabase/supabase-js";


/**
 * In this module the supabase SDK client is configured
 * 
 * https://supabase.com/docs/reference/javascript/introduction
*/
config({path: `${path.join(__dirname, "../../.env")}`});


const supabaseUrl: string = process.env.SUPABASE_URL || "default_url";
const supabaseAnonKey: string = process.env.SUPABASE_ANON_KEY || "default_key";


/** Check if they exist */
if (!supabaseUrl || !supabaseAnonKey) throw new Error('No Supabase keys provided!')


/** Export the client */
export const dbClient = createClient<Database>(supabaseUrl, supabaseAnonKey);


