


/**
 * @class VaultCalculator
 * 
 * To not lose money, we need a calculator that will 
 * allow us to safely transform values and calculate in 
 * the fees and gas buffers
 * 
 */
export default class VaultCalculator {
    constructor() { }


    // #region Fee, Gas Buffer and Payout Calculations
    /**
     * This method will calculate the deposit fee 
     * that will then be recorded in the database as non-eligible
     * for the player in case he wants to withdraw
     */
    static async calculateDepositFee() {
        // TODO
    };

    /**
     * This method will return a safe amount of solana
     * that is available for withdrawal when a player wants
     * to withdraw from the game before it starts 
     * 
     * The amount available will reflect the buffer for gas fees
     * that we deduct from the original amount he deposited when he 
     * joined the game
     */
    static async calculateWithdrawAmount() {
        // TODO
    }

    /**
     * This method will calculate the payout amount
     * that the player will receive (this )
     */
    static async calculatePayoutAmount() {
        // TODO
    }

    /**
     * Since our tournaments hold prizes for the first 3 places,
     * we need to calculate the payout amount for each of the 
     * winners based on the total prize pool and the prize distribution
     */
    static async calculatePayoutAmountTournament() {
        //
    }
    // #endregion Fee and Gas Buffer Calculations


    private static deductGasFees() {
        //
    };

    private static deductProviderFees() {
        //
    };


    
}