import { Connection } from "@solana/web3.js";


const solanaRPC = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";

// devnet
export const solConnection = new Connection(solanaRPC, "confirmed");

// export const solConnection = new Connection(
//     "https://api.devnet.solana.com",
//     "confirmed"
// );