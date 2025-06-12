import {
    FEES_PERCENT,
    GAS_BUFFER,
    FEES_WALLET_ADDRESS,
    TOURNAMENT_PRIZE_SHARE,
    ADMIN_KEYPAIR,
} from './constants';

import {
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';

import { gSolanaProvider as connection } from './provider';

export default class AdminWallet {
    constructor() { }

    static async processWithdrawal(walletAddress: string, amount: number): Promise<string | null> {
        const netAmount = AdminWallet._calculateNetAmount(amount);
        await this._collectFeesToAdminWallet(amount);
        return this._sendSolToUser(walletAddress, netAmount);
    }

    static async processPayoutDuel(walletAddress: string, amount: number): Promise<string | null> {
        const netAmount = AdminWallet._calculateNetAmount(amount);
        await this._collectFeesToAdminWallet(amount);
        return this._sendSolToUser(walletAddress, netAmount);
    }

    static async processRefund(walletAddress: string, amount: number): Promise<string | null> {
        const netAmount = AdminWallet._calculateNetAmount(amount);
        return this._sendSolToUser(walletAddress, netAmount);
    }

    /**
     * Processes a payout for a tournament where we have only one winner.
     */
    static async processPayoutTournamentSingle(walletAddress: string, amount: number): Promise<string | null> {
        const netAmount = AdminWallet._calculateNetAmount(amount);
        await this._collectFeesToAdminWallet(amount);
        return this._sendSolToUser(walletAddress, netAmount);
    };

    static async processPayoutTournament(wallets: string[], totalAmount: number): Promise<string | null> {
        const results: string[] = [];

        for (let i = 0; i < wallets.length && i < TOURNAMENT_PRIZE_SHARE.length; i++) {
            const share = TOURNAMENT_PRIZE_SHARE[i];
            const payoutAmount = totalAmount * share;
            const netAmount = AdminWallet._calculateNetAmount(payoutAmount);
            await this._collectFeesToAdminWallet(payoutAmount);
            const tx = await this._sendSolToUser(wallets[i], netAmount);
            if (!tx) return null;
            results.push(tx);
        }

        return results.length > 0 ? results.join(',') : null;
    };

    static async processLobbyDeletion(wallets: string[], amount: number): Promise<string | null> {
        // const perPlayer = amount / wallets.length;
        const netAmount = AdminWallet._calculateNetAmount(amount);

        for (const wallet of wallets) {
            await this._collectFeesToAdminWallet(amount);
            const tx = await this._sendSolToUser(wallet, netAmount);
            if (!tx) return null;
        }

        return 'LobbyDeletionSuccess';
    }

    /**
 * Processes lobby closure refunds - returns full stake amounts without fees
 * @param participants Array of participant info with wallet addresses and amounts
 * @returns Object with success status and transaction hashes
 */
    static async processLobbyClosureRefunds(
        participants: Array<{
            user_id: number;
            solana_address: string;
            stake_amount_sol: number;
        }>
    ): Promise<{
        success: boolean;
        refund_transactions: Array<{
            user_id: number;
            tx_hash: string | null;
            amount_sol: number;
        }>;
        failed_refunds: Array<{
            user_id: number;
            error: string;
        }>;
    }> {
        const refund_transactions: Array<{
            user_id: number;
            tx_hash: string | null;
            amount_sol: number;
        }> = [];

        const failed_refunds: Array<{
            user_id: number;
            error: string;
        }> = [];

        console.log(`Processing refunds for ${participants.length} participants`);

        for (const participant of participants) {
            try {
                console.log(`Processing refund for user ${participant.user_id}: ${participant.stake_amount_sol} SOL`);

                // Send full refund without fees (this is a refund, not a payout)
                const tx_hash = await this._sendSolToUser(
                    participant.solana_address,
                    participant.stake_amount_sol
                );

                if (tx_hash) {
                    refund_transactions.push({
                        user_id: participant.user_id,
                        tx_hash,
                        amount_sol: participant.stake_amount_sol
                    });
                    console.log(`✅ Refund successful for user ${participant.user_id}: ${tx_hash}`);
                } else {
                    failed_refunds.push({
                        user_id: participant.user_id,
                        error: 'Failed to send blockchain transaction'
                    });
                    console.error(`❌ Refund failed for user ${participant.user_id}: transaction failed`);
                }
            } catch (error) {
                failed_refunds.push({
                    user_id: participant.user_id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                console.error(`❌ Refund failed for user ${participant.user_id}:`, error);
            }

            // Add small delay between transactions to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const success = failed_refunds.length === 0;
        console.log(`Refund processing complete. Success: ${success}, Successful: ${refund_transactions.length}, Failed: ${failed_refunds.length}`);

        return {
            success,
            refund_transactions,
            failed_refunds
        };
    }

    private static _calculateNetAmount(amount: number): number {
        const fee = (amount * FEES_PERCENT) / 100;
        const net = amount - fee - GAS_BUFFER;
        return +net.toFixed(6); // up to 6 decimal places
    }

    private static async _sendSolToUser(walletAddress: string, amount: number): Promise<string | null> {
        try {
            const recipient = new PublicKey(walletAddress);
            const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: ADMIN_KEYPAIR.publicKey,
                    toPubkey: recipient,
                    lamports,
                })
            );

            const signature = await sendAndConfirmTransaction(connection, transaction, [ADMIN_KEYPAIR]);
            console.log(`Sent ${amount} SOL to ${walletAddress}: ${signature}`);
            return signature;
        } catch (error) {
            console.error('Error sending SOL to user:', error);
            return null;
        }
    }

    private static async _collectFeesToAdminWallet(amount: number): Promise<string | null> {
        try {
            const feeAmount = (amount * FEES_PERCENT) / 100;
            const lamports = Math.floor(feeAmount * LAMPORTS_PER_SOL);
            const recipient = new PublicKey(FEES_WALLET_ADDRESS);

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: ADMIN_KEYPAIR.publicKey,
                    toPubkey: recipient,
                    lamports,
                })
            );

            const signature = await sendAndConfirmTransaction(connection, transaction, [ADMIN_KEYPAIR]);
            console.log(`Sent fee ${feeAmount} SOL to admin: ${signature}`);
            return signature;
        } catch (error) {
            console.error('Error collecting fees:', error);
            return null;
        }
    }
}