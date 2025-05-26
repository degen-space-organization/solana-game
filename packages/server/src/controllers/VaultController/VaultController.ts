
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


// Imports



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



    static async validateDeposit() {
        //
    };


    



};