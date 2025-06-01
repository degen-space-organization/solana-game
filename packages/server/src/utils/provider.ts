/**
 * @file provider.ts
 * 
 * Provider utility functions and objects
 */
import { Cluster, Connection, clusterApiUrl } from "@solana/web3.js";



const cluster = process.env.SOLANA_NODE_ENV === 'devnet' ? 'devnet' : 'mainnet-beta';
// const SOLANA_NETWORK: Cluster = "mainnet-beta"; // Change to "devnet" or "testnet" as needed
// const SOLANA_NETWORK: Cluster = "devnet"; // Change to "devnet" or "testnet" as needed
const SOLANA_NETWORK: Cluster = cluster; // Change to "devnet" or "testnet" as needed

export const gSolanaProvider = new Connection(clusterApiUrl(SOLANA_NETWORK), "confirmed");

