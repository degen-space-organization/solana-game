import { Connection } from "@solana/web3.js";


// devnet
export const solConnection = new Connection(
    "https://necessary-multi-surf.solana-devnet.quiknode.pro/f1d444b11ed4a066c4a87c1f25fb539c6b6acb38/",
    "confirmed"
);

// export const solConnection = new Connection(
//     "https://api.devnet.solana.com",
//     "confirmed"
// );