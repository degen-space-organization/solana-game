import type { FC, ReactNode } from 'react';
import React, { useMemo } from 'react';

import { WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

import { ConnectionProvider } from '@solana/wallet-adapter-react';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';


// Required for wallet modal styles
import '@solana/wallet-adapter-react-ui/styles.css';

const solanaEnv = import.meta.env.VITE_SOLANA_ENV || 'devnet';

export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // Choose network: 'devnet', 'testnet', or 'mainnet-beta'
    const network = solanaEnv === 'mainnet-beta'
        ? WalletAdapterNetwork.Mainnet
        : solanaEnv === 'testnet'
        ? WalletAdapterNetwork.Testnet
        : WalletAdapterNetwork.Devnet;
    // const network = WalletAdapterNetwork.Devnet;
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    // Configure the wallets you want to support (Phantom, Solflare, etc.)
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            // add more adapters here if desired
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint} >
            <WalletProvider wallets={wallets} autoConnect >
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};