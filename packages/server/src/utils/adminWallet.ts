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
    constructor() {}

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