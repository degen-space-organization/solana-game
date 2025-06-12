


import { PublicKey } from "@solana/web3.js";


const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS || '4c4DtUhVVGqgasuXenfJADUqyiD5NPMGUVBdNLVPFtDE'; // Default to a known vault address if not set in environment variables

export const GAME_VAULT_ADDRESS = new PublicKey(VAULT_ADDRESS); // Replace with your actual vault address
