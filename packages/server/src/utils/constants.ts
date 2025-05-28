

import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from 'dotenv';


config({
    path: '../../.env',
})


export const FEES_PERCENT = 0.5; // %
export const GAS_BUFFER = 0.0005; // in SOL
export const TOURNAMENT_PRIZE_SHARE = [0.7, 0.3]; // First and second place only

// wallet address
// 42KWcJjJpqAsHBHw3Z8KPywqdz3TSRcAx1xfu9y569QY
const adminKeypair = process.env.ADMIN_PRIVATE_KEY || '';

export const FEES_WALLET_ADDRESS = process.env.FEES_WALLET_ADDRESS || '48wcCEj1hdV5UGwr3PmhqvU3ix1eN5rMqEsBxT4XKRfc';

export const ADMIN_KEYPAIR = Keypair.fromSecretKey(bs58.decode(adminKeypair));
export const ADMIN_PUBLIC_KEY = ADMIN_KEYPAIR.publicKey;

export const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://dimensional-black-snowflake.solana-mainnet.quiknode.pro/ecd1017c3cd740f6646e4734249fd9ec97e7ac60/';
