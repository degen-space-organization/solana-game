


export interface ISolPrice {
    sol: number;
    usd: number;
    readable: string;
}


export default class SolanaPrice { 


    static async convertSolToUsd(solAmount: number): Promise<ISolPrice | null> {
        return null;
    };

    static async fetchSolPrice(): Promise<ISolPrice | null> {
        return null;
    };


};