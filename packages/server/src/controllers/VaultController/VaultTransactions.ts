// fetchTransactionDetails.ts
import fs from 'fs';
import path from 'path';

import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionSignature,
    sendAndConfirmTransaction,
    ParsedTransactionWithMeta,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';

import { gSolanaProvider } from '../../utils/provider';



/**
 * We are keeping the creds of admin keypair in a separate file
 */
const ADMIN_KEYPAIR_PATH = process.env.ADMIN_KEYPAIR_PATH || './admin-wallet.json';

/**
 * @returns Keypair of the admin wallet
 */
function loadAdminKeypair(): Keypair {
    const secret = JSON.parse(fs.readFileSync(path.resolve(ADMIN_KEYPAIR_PATH), 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(secret));
}




export default class VaultTransactions {
    private static connection: Connection = gSolanaProvider;
    private static adminWallet: Keypair = loadAdminKeypair();

    /**
     * Obtain transaction details from Solana blockchain
     */
    static async fetchTransactionDetails(txHashOrSignature: TransactionSignature): Promise<ParsedTransactionWithMeta | null> {
        try {
            const transaction = await this.connection.getParsedTransaction(txHashOrSignature, {
                commitment: 'confirmed',
            });

            if (!transaction) {
                console.warn(`Transaction ${txHashOrSignature} not found.`);
                return null;
            }

            return transaction;

        } catch (error) {
            console.error("Error fetching transaction details:", error);
            throw new Error("Failed to fetch transaction details");
        }
    }

    /**
     * Send SOL to a target wallet
     * 
     * @param recipientAddress Target wallet address
     * @param amountInSol Amount in SOL (not lamports)
     * @returns Transaction signature
     */
    static async sendTransaction(recipientAddress: string, amountInSol: number): Promise<TransactionSignature> {
        try {
            const recipientPubkey = new PublicKey(recipientAddress);
            const lamports = Math.floor(amountInSol * LAMPORTS_PER_SOL);

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: this.adminWallet.publicKey,
                    toPubkey: recipientPubkey,
                    lamports,
                })
            );

            const signature = await sendAndConfirmTransaction(
                this.connection,
                transaction,
                [this.adminWallet]
            );

            console.log("Transfer successful. Signature:", signature);
            return signature;

        } catch (error) {
            console.error("Error sending transaction:", error);
            throw new Error("Failed to send transaction");
        }
    }


}

