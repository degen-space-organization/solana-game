
/**
 * @file VaultController.ts
 * 
 * Vault Controller acts as a mediator between the database and on-chain
 * transactions. It handles the logic for: depositing and withdarawing,
 * - depositing
 * - withdrawing
 * - paying out winners
 * 
 * It will make sure to process transactions safely and securely,
 * 
 * * @note Vault is something abstract, we designed it 
 * * that way to be able to reuse it
 * *
 * * Vault should be abstract enough to support underlying 
 * *vault to be contract, wallet or something else.
 */

import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { dbClient } from "../../database/provider";
import { gSolanaProvider } from "../../utils/provider";


const adminWallet = '48wcCEj1hdV5UGwr3PmhqvU3ix1eN5rMqEsBxT4XKRfc'


/**
 * @class ### VaultController
 * 
 * This class handles all the vault related operations
 * 
 * @important Big emphasis is on the security and prevention of double spending,
 * draining etc.
 * 
 */
export default class VaultController {

    constructor() { }


    static async requestWithdrawal() {
        //
    };



    static async validateDeposit(txHash: string, userId: number, amount: number, lobbyId: number): Promise<boolean> {
        try {
            // fetch the user first
            const user = await dbClient.from('users').select('*').eq('id', userId).single();
            if (!user) {
                console.error('User not found for ID:', userId);
                return false;
            }
            const lobby = await dbClient.from('lobbies').select('*').eq('id', lobbyId).single();
            if (!lobby) {
                console.error('Lobby not found for ID:', lobbyId);
                return false;
            }

            // obtain the deposit amount from the transaction hash
            const depositAmount = await this._obtainDepositAmount(txHash, user.data?.solana_address!, adminWallet);
            if (depositAmount !== amount / 1e9) {
                console.error(`Deposit amount mismatch: expected ${amount / 1e9} SOL, got ${depositAmount} SOL`);
                return false;
            }

            // insert the deposit record into the database
            const depositRecord = await dbClient.from('stake_transactions').insert([{
                user_id: userId,
                lobby_id: lobbyId, // Assuming lobby_id is not applicable here
                match_id: null, // Assuming match_id is not applicable here
                transaction_hash: txHash,
                transaction_type: 'stake',
                amount: (Math.floor(Number(depositAmount) * LAMPORTS_PER_SOL)).toString(),
                status: 'confirmed',
            }]).select().single();

            if (!depositRecord) {
                console.error('Failed to insert deposit record into database');
                return false;
            }

            // update the players in the lobby participating
            const updateLobbyParticipant = await dbClient.from('lobby_participants')
                .update({
                    is_ready: true,
                    has_staked: true,
                    stake_transaction_hash: txHash
                })
                .eq('user_id', userId)
                .eq('lobby_id', lobbyId)
            console.log(updateLobbyParticipant)

            if (!updateLobbyParticipant) {
                console.error('Failed to update lobby participant status');
                console.log('Update result:', updateLobbyParticipant);
                return false;
            }

            return true;

        } catch (error) {
            console.error('Error validating deposit:', error);
            return false;
        }

    };

    static async validateDepositLobbyCreation(txHash: string, userId: number, lobbyId: number): Promise<boolean> {
        try {
            // fetch the user first
            const user = await dbClient.from('users').select('*').eq('id', userId).single();
            if (!user) {
                console.error('User not found for ID:', userId);
                return false;
            }

            // fetch the lobby
            const lobby = await dbClient.from('lobbies').select('*').eq('id', lobbyId).single();
            if (!lobby) {
                console.error('Lobby not found for ID:', lobbyId);
                return false;
            }
            console.log('retard')


            // obtain the deposit amount from the transaction hash
            const depositAmount = await this._obtainDepositAmount(txHash, user.data?.solana_address!, adminWallet);
            const expectedAmountInLamports: string = lobby.data?.stake_amount!
            const stakeInLamports = parseInt(expectedAmountInLamports, 10);
            if (depositAmount !== stakeInLamports / 1e9) {
                console.error(`Deposit amount mismatch: expected ${stakeInLamports / 1e9} SOL, got ${depositAmount} SOL`);
                return false;
            }
            console.log('retard')

            // insert the deposit record into the database
            const depositRecord = await dbClient.from('stake_transactions').insert([{
                user_id: userId,
                lobby_id: lobbyId,
                match_id: null, // Assuming match_id is not applicable here
                transaction_hash: txHash,
                transaction_type: 'stake',
                amount: (Math.floor(Number(depositAmount) * LAMPORTS_PER_SOL)).toString(),
                status: 'confirmed',

            }]).select().single();
            console.log(depositRecord)
            if (!depositRecord) {
                console.error('Failed to insert deposit record into database');
                return false;
            }

            // update the players in the lobby participating
            const updateLobbyParticipant = await dbClient.from('lobby_participants')
                .update({
                    is_ready: true,
                    has_staked: true,
                    stake_transaction_hash: txHash
                })
                .eq('user_id', userId)
                .eq('lobby_id', lobbyId)
            console.log(updateLobbyParticipant)

            if (!updateLobbyParticipant) {
                console.error('Failed to update lobby participant status');
                console.log('Update result:', updateLobbyParticipant);
                return false;
            }
            console.log('retard')

            return true;


        } catch (error) {
            console.error('Error validating deposit for lobby creation:', error);
            return false;
        }

    };



    private static async _obtainDepositAmount(txHash: string, expectedFrom: string, expectedTo: string): Promise<number> {
        const tx = await gSolanaProvider.getParsedTransaction(txHash, { maxSupportedTransactionVersion: 0 });

        if (!tx) {
            console.error('Transaction not found');
            return 0;
        }

        const instructions = tx.transaction.message.instructions;

        for (const ix of instructions) {
            if ('parsed' in ix && ix.program === 'system' && ix.parsed?.type === 'transfer') {
                const info = ix.parsed.info;
                if (info.source === expectedFrom && info.destination === expectedTo) {
                    const lamports = parseInt(info.lamports, 10);
                    const sol = lamports / 1e9;
                    return sol;
                }
            }
        }

        console.warn('No matching transfer found in transaction');
        return 0;
    }



};