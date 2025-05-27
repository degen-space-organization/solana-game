// 

// sending the TX to the contract
// e
// for our solana game 
import { Transaction, SystemProgram, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';


export async function createStakeTransfer(
    connection: any,
    payer: any,
    stakeAmount: number,
    recipient: string
): Promise<string> {
    try {
        // Convert stake amount to lamports
        const lamports = stakeAmount * 1e9; // 1 SOL = 1e9 lamports

        // Create a transaction to transfer SOL
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: payer.publicKey,
                toPubkey: new PublicKey(recipient),
                lamports,
            })
        );

        // Sign and send the transaction
        const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);

        console.log("Stake transfer successful with signature:", signature);
        return signature;
    } catch (error) {
        console.error("Error creating stake transfer:", error);
        throw error;
    }
}