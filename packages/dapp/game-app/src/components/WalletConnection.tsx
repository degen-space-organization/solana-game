import React, { useState, useEffect } from 'react';
import { Wallet, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { Connection, PublicKey as SolanaPublicKey } from '@solana/web3.js';

// TypeScript interfaces for Phantom wallet
interface PhantomWalletEvents {
  connect(publicKey: PublicKey): void;
  disconnect(): void;
  accountChanged(publicKey: PublicKey | null): void;
}

interface PhantomWallet {
  isPhantom: boolean;
  publicKey: PublicKey | null;
  isConnected: boolean;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  on<T extends keyof PhantomWalletEvents>(
    event: T,
    handler: PhantomWalletEvents[T]
  ): void;
  removeAllListeners(event: keyof PhantomWalletEvents): void;
}

interface PublicKey {
  toString(): string;
}

// Extend window object to include solana
declare global {
  interface Window {
    solana?: PhantomWallet;
  }
}

// RPC Response types
interface SolanaRPCResponse {
  jsonrpc: string;
  id: number;
  result?: {
    value: number;
  };
  error?: {
    code: number;
    message: string;
  };
}

const SolanaWeb3App: React.FC = () => {
  const [wallet, setWallet] = useState<PhantomWallet | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);

  // Check if Phantom wallet is installed
  const getProvider = (): PhantomWallet | null => {
    if ('solana' in window) {
      const provider = window.solana;
      if (provider?.isPhantom) {
        return provider;
      }
    }
    return null;
  };

  // Connect to Phantom wallet
  const connectWallet = async (): Promise<void> => {
    const provider = getProvider();
    if (!provider) {
      alert('Phantom wallet not found! Please install Phantom wallet.');
      return;
    }

    try {
      setLoading(true);
      const response = await provider.connect();
      const pubKeyString = response.publicKey.toString();
      
      setWallet(provider);
      setPublicKey(pubKeyString);
      setConnected(true);
      
      // Clear any previous explicit disconnect flag since user is connecting again
      localStorage.removeItem('walletExplicitlyDisconnected');
      
      await getBalance(pubKeyString);
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async (): Promise<void> => {
    if (wallet) {
      try {
        await wallet.disconnect();
        setWallet(null);
        setConnected(false);
        setPublicKey(null);
        setBalance(null);
        
        // Mark that user explicitly disconnected to prevent auto-reconnection
        localStorage.setItem('walletExplicitlyDisconnected', 'true');
      } catch (error) {
        console.error('Disconnect failed:', error);
      }
    }
  };

  // Get SOL balance
  const getBalance = async (pubKey: string): Promise<void> => {
  try {
    const response = await fetch(`http://localhost:3001/get-balance/${pubKey}`);
    const data = await response.json();
    console.log(data.balance)
    setBalance(data.balance.toFixed(4));
    
  } catch (error) {
    console.error('Error fetching balance from backend:', error);
  }
};

  // Refresh balance
  const refreshBalance = async (): Promise<void> => {
    if (publicKey) {
      setLoading(true);
      await getBalance(publicKey);
      setLoading(false);
    }
  };

  // Copy public key to clipboard
  const copyPublicKey = async (): Promise<void> => {
    if (publicKey) {
      try {
        await navigator.clipboard.writeText(publicKey);
        alert('Public key copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  // Check if wallet is already connected on load
  useEffect(() => {
    const initializeWallet = async () => {
      const provider = getProvider();
      if (!provider) {
        setInitializing(false);
        return;
      }

      // Check if user explicitly disconnected - if so, don't auto-reconnect
      const explicitlyDisconnected = localStorage.getItem('walletExplicitlyDisconnected');
      if (explicitlyDisconnected === 'true') {
        setInitializing(false);
        return;
      }

      try {
        // Try to connect silently using the wallet's built-in persistence
        // This respects the user's previous connection choice stored by Phantom
        const response = await provider.connect({ onlyIfTrusted: true });
        
        if (response.publicKey) {
          const pubKeyString = response.publicKey.toString();
          setWallet(provider);
          setPublicKey(pubKeyString);
          setConnected(true);
          await getBalance(pubKeyString);
        }
      } catch (error) {
        // User hasn't connected before or revoked permission
        // This is normal, no action needed
        console.log('No trusted connection available');
      } finally {
        setInitializing(false);
      }
    };

    initializeWallet();

    // Listen for wallet connection changes
    const provider = getProvider();
    if (provider) {
      const handleConnect = (publicKey: PublicKey): void => {
        // Only auto-set if user didn't explicitly disconnect
        const explicitlyDisconnected = localStorage.getItem('walletExplicitlyDisconnected');
        if (explicitlyDisconnected !== 'true') {
          setWallet(provider);
          setPublicKey(publicKey.toString());
          setConnected(true);
          getBalance(publicKey.toString());
        }
      };

      const handleDisconnect = (): void => {
        setWallet(null);
        setConnected(false);
        setPublicKey(null);
        setBalance(null);
      };

      provider.on('connect', handleConnect);
      provider.on('disconnect', handleDisconnect);

      // Cleanup event listeners
      return () => {
        provider.removeAllListeners('connect');
        provider.removeAllListeners('disconnect');
      };
    }
  }, []);

  // Format public key for display
  const formatPublicKey = (key: string | null): string => {
    if (!key) return '';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Solana Web3 DApp
          </h1>
          <p className="text-xl text-gray-300">
            Connect your Phantom wallet to interact with the Solana blockchain
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          {initializing ? (
            /* Loading State */
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="w-12 h-12 text-white animate-spin" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Initializing...</h2>
              <p className="text-gray-300">
                Checking for existing wallet connection
              </p>
            </div>
          ) : !connected ? (
            /* Connection Card */
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Wallet className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h2>
              <p className="text-gray-300 mb-8">
                Connect your Phantom wallet to start using this decentralized application
              </p>
              <button
                onClick={connectWallet}
                disabled={loading}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 mx-auto"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    Connect Phantom Wallet
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Wallet Dashboard */
            <div className="space-y-6">
              {/* Wallet Info Card */}
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Wallet Connected</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={refreshBalance}
                      disabled={loading}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 text-white ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={disconnectWallet}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Public Key */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Public Key
                  </label>
                  <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg">
                    <span className="text-white font-mono text-sm flex-1">
                      {formatPublicKey(publicKey)}
                    </span>
                    <button
                      onClick={copyPublicKey}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4 text-gray-300" />
                    </button>
                    <a
                      href={`https://solscan.io/account/${publicKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-300" />
                    </a>
                  </div>
                </div>

                {/* Balance */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    SOL Balance
                  </label>
                  <div className="p-3 bg-black/20 rounded-lg">
                    <span className="text-2xl font-bold text-white">
                      {balance !== null ? `${balance} SOL` : 'Loading...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Card */}
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
                
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-400">
          <p className="text-sm mt-2">Make sure you have Phantom wallet installed</p>
        </div>
      </div>
    </div>
  );
};

export default SolanaWeb3App;