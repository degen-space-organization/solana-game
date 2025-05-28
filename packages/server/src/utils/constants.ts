

import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();



export const FEES_PERCENT = 0.5; // %
export const GAS_BUFFER = 0.0005; // in SOL
export const TOURNAMENT_PRIZE_SHARE = [0.7, 0.3]; // First and second place only

const adminKeypair = process.env.ADMIN_PRIVATE_KEY || '2R6N9pex2Hn9jnDjSiULcPLQjWKxfMPvbA9YcqKCumUzkF1rLXjcpCpR4hQ6og2oUgdrVxxZhWhzMVCo4mVeuDeS';

export const FEES_WALLET_ADDRESS = process.env.FEES_WALLET_ADDRESS || 'Dm3VWYaGtdCsmQsTkXrJRDCSFL3SghbVan7tD69ygGXN';

export const ADMIN_KEYPAIR = Keypair.fromSecretKey(bs58.decode(adminKeypair));
export const ADMIN_PUBLIC_KEY = ADMIN_KEYPAIR.publicKey;

export const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
