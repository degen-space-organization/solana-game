/**
 * @file provider.ts
 * 
 * Provider utility functions and objects
 */
import { Cluster, Connection, clusterApiUrl } from "@solana/web3.js";



const SOLANA_NETWORK: Cluster = "devnet";

export const gSolanaProvider = new Connection(clusterApiUrl(SOLANA_NETWORK), "confirmed");

