import { Connection } from "@solana/web3.js";



export const solConnection = new Connection(
    "https://dimensional-black-snowflake.solana-mainnet.quiknode.pro/ecd1017c3cd740f6646e4734249fd9ec97e7ac60/",
    "confirmed"
);

// export const solConnection = new Connection(
//     "https://api.devnet.solana.com",
//     "confirmed"
// );