import React, { useState, useEffect } from 'react';
import { Wallet, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { Box, Button, Flex, VStack, Text, Card, Heading, HStack } from "@chakra-ui/react";


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
    <Box className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Box className="container mx-auto px-4 py-8">
        {/* Header */}
        <Box className="text-center mb-12">
          <Heading as="h1" size="2xl" fontWeight="black" color="white" mb="4"
            bgGradient="linear(to-r, purple.400, pink.400)" bgClip="text"
            textShadow="4px 4px 0px rgba(0,0,0,0.4)"
          >
            Solana Web3 DApp
          </Heading>
          <Text fontSize="xl" color="gray.300">
            Connect your Phantom wallet to interact with the Solana blockchain
          </Text>
        </Box>

        {/* Main Content */}
        <Box maxWidth="2xl" mx="auto">
          {initializing ? (
            /* Loading State */
            <Card.Root
              borderWidth="4px"
              borderStyle="solid"
              borderColor="gray.900"
              bg="white"
              shadow="8px 8px 0px rgba(0,0,0,0.8)"
              borderRadius="0"
              transform="rotate(-0.5deg)"
              transition="all 0.2s ease"
              position="relative"
              p="8"
              textAlign="center"
              display="flex"
              flexDirection="column"
              alignItems="center"
            >
              <Box
                w="24"
                h="24"
                bgGradient="linear(to-br, purple.500, pink.500)"
                borderRadius="0"
                border="4px solid"
                borderColor="gray.900"
                display="flex"
                alignItems="center"
                justifyContent="center"
                mx="auto"
                mb="6"
                shadow="4px 4px 0px rgba(0,0,0,0.8)"
              >
                <RefreshCw size={48} color="white" className="animate-spin" />
              </Box>
              <Heading size="lg" fontWeight="black" color="gray.900" mb="4">Initializing...</Heading>
              <Text color="gray.600">
                Checking for existing wallet connection
              </Text>
            </Card.Root>
          ) : !connected ? (
            /* Connection Card */
            <Card.Root
              borderWidth="4px"
              borderStyle="solid"
              borderColor="gray.900"
              bg="white"
              shadow="8px 8px 0px rgba(0,0,0,0.8)"
              borderRadius="0"
              transform="rotate(-0.5deg)"
              _hover={{
                transform: "rotate(0deg) scale(1.02)",
                shadow: "12px 12px 0px rgba(0,0,0,0.8)",
              }}
              transition="all 0.2s ease"
              position="relative"
              p="8"
              textAlign="center"
              display="flex"
              flexDirection="column"
              alignItems="center"
            >
              <Box
                w="24"
                h="24"
                bgGradient="linear(to-br, purple.500, pink.500)"
                borderRadius="0"
                border="4px solid"
                borderColor="gray.900"
                display="flex"
                alignItems="center"
                justifyContent="center"
                mx="auto"
                mb="6"
                shadow="4px 4px 0px rgba(0,0,0,0.8)"
              >
                <Wallet size={48} color="white" />
              </Box>
              <Heading size="lg" fontWeight="black" color="gray.900" mb="4">Connect Your Wallet</Heading>
              <Text color="gray.600" mb="8">
                Connect your Phantom wallet to start using this decentralized application
              </Text>
              <Button
                onClick={connectWallet}
                disabled={loading}
                bgGradient="linear(to-r, purple.600, pink.600)"
                color="white"
                fontWeight="black"
                fontSize="xl"
                py="4"
                px="8"
                borderRadius="0"
                border="4px solid"
                borderColor="gray.900"
                shadow="6px 6px 0px rgba(0,0,0,0.8)"
                _hover={!loading ? {
                  bgGradient: "linear(to-r, purple.700, pink.700)",
                  transform: "translate(-3px, -3px)",
                  shadow: "9px 9px 0px rgba(0,0,0,0.8)",
                } : {}}
                _active={!loading ? {
                  transform: "translate(0px, 0px)",
                  shadow: "3px 3px 0px rgba(0,0,0,0.8)",
                } : {}}
                transition="all 0.1s ease"
                display="flex"
                alignItems="center"
                gap="3"
                mx="auto"
              >
                {loading ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet size={20} />
                    Connect Phantom Wallet
                  </>
                )}
              </Button>
            </Card.Root>
          ) : (
            /* Wallet Dashboard */
            <VStack spacing="6">
              {/* Wallet Info Card */}
              <Card.Root
                borderWidth="4px"
                borderStyle="solid"
                borderColor="gray.900"
                bg="white"
                shadow="8px 8px 0px rgba(0,0,0,0.8)"
                borderRadius="0"
                transform="rotate(-0.5deg)"
                _hover={{
                  transform: "rotate(0deg) scale(1.02)",
                  shadow: "12px 12px 0px rgba(0,0,0,0.8)",
                }}
                transition="all 0.2s ease"
                position="relative"
                p="6"
              >
                <Card.Body p="0">
                  <Flex justify="space-between" align="flex-start" mb="6">
                    <Heading size="md" fontWeight="black" color="gray.900">Wallet Connected</Heading>
                    <HStack spacing="2">
                      <Button
                        onClick={refreshBalance}
                        disabled={loading}
                        bg="#118AB2"
                        color="white"
                        fontWeight="black"
                        fontSize="sm"
                        px="3"
                        py="2"
                        borderRadius="0"
                        border="2px solid"
                        borderColor="gray.900"
                        shadow="3px 3px 0px rgba(0,0,0,0.8)"
                        _hover={!loading ? {
                          bg: "#0E7FA1",
                          transform: "translate(-1px, -1px)",
                          shadow: "4px 4px 0px rgba(0,0,0,0.8)",
                        } : {}}
                        _active={!loading ? {
                          transform: "translate(0px, 0px)",
                          shadow: "1px 1px 0px rgba(0,0,0,0.8)",
                        } : {}}
                        transition="all 0.1s ease"
                      >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                      </Button>
                      <Button
                        onClick={disconnectWallet}
                        bg="#DC143C"
                        color="white"
                        fontWeight="black"
                        fontSize="sm"
                        px="3"
                        py="2"
                        borderRadius="0"
                        border="2px solid"
                        borderColor="gray.900"
                        shadow="3px 3px 0px rgba(0,0,0,0.8)"
                        _hover={{
                          bg: "#B01030",
                          transform: "translate(-1px, -1px)",
                          shadow: "4px 4px 0px rgba(0,0,0,0.8)",
                        }}
                        _active={{
                          transform: "translate(0px, 0px)",
                          shadow: "1px 1px 0px rgba(0,0,0,0.8)",
                        }}
                        transition="all 0.1s ease"
                      >
                        Disconnect
                      </Button>
                    </HStack>
                  </Flex>

                  {/* Public Key */}
                  <Box mb="4">
                    <Text fontSize="xs" fontWeight="bold" color="gray.700" mb="2">
                      PUBLIC KEY
                    </Text>
                    <Flex
                      align="center"
                      gap="2"
                      p="3"
                      bg="gray.100"
                      borderRadius="0"
                      border="3px solid"
                      borderColor="gray.900"
                      shadow="3px 3px 0px rgba(0,0,0,0.8)"
                    >
                      <Text color="gray.900" fontFamily="mono" fontSize="sm" flex="1">
                        {formatPublicKey(publicKey)}
                      </Text>
                      <Button
                        onClick={copyPublicKey}
                        bg="transparent"
                        _hover={{ bg: "gray.200" }}
                        _active={{ bg: "gray.300" }}
                        p="1"
                        borderRadius="0"
                        border="2px solid"
                        borderColor="gray.900"
                        shadow="2px 2px 0px rgba(0,0,0,0.8)"
                      >
                        <Copy size={16} color="gray.700" />
                      </Button>
                      <Button
                        as="a"
                        href={`https://solscan.io/account/${publicKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        bg="transparent"
                        _hover={{ bg: "gray.200" }}
                        _active={{ bg: "gray.300" }}
                        p="1"
                        borderRadius="0"
                        border="2px solid"
                        borderColor="gray.900"
                        shadow="2px 2px 0px rgba(0,0,0,0.8)"
                      >
                        <ExternalLink size={16} color="gray.700" />
                      </Button>
                    </Flex>
                  </Box>

                  {/* Balance */}
                  <Box>
                    <Text fontSize="xs" fontWeight="bold" color="gray.700" mb="2">
                      SOL BALANCE
                    </Text>
                    <Box
                      p="3"
                      bg="yellow.100"
                      borderRadius="0"
                      border="3px solid"
                      borderColor="yellow.600"
                      shadow="3px 3px 0px rgba(0,0,0,0.8)"
                    >
                      <Text fontSize="2xl" fontWeight="black" color="yellow.900">
                        {balance !== null ? `${balance} SOL` : 'Loading...'}
                      </Text>
                    </Box>
                  </Box>
                </Card.Body>
              </Card.Root>

              {/* Actions Card - Placeholder, keep as is */}
              <Card.Root
                borderWidth="4px"
                borderStyle="solid"
                borderColor="gray.900"
                bg="white"
                shadow="8px 8px 0px rgba(0,0,0,0.8)"
                borderRadius="0"
                transform="rotate(-0.5deg)"
                _hover={{
                  transform: "rotate(0deg) scale(1.02)",
                  shadow: "12px 12px 0px rgba(0,0,0,0.8)",
                }}
                transition="all 0.2s ease"
                position="relative"
                p="6"
              >
                <Card.Body p="0">
                  {/* Content for actions can go here */}
                  <Heading size="md" fontWeight="black" color="gray.900">Wallet Actions</Heading>
                  <Text color="gray.600" mt="2">
                    Future actions will be displayed here.
                  </Text>
                </Card.Body>
              </Card.Root>
            </VStack>
          )}
        </Box>

        {/* Footer */}
        <Box className="text-center mt-12 text-gray-400">
          <Text fontSize="sm" mt="2" color="gray.500">Make sure you have Phantom wallet installed</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default SolanaWeb3App;