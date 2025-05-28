import {
    Box, Button, HStack, Text, Input, Avatar, VStack
} from '@chakra-ui/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { toaster } from '../ui/toaster';
import { supabase } from '@/supabase';
import { solConnection as connection } from '@/web3';

const shortenAddress = (address: string) =>
    `${address.slice(0, 4)}...${address.slice(-4)}`;

// Supabase


// const connection = new Connection('https://api.devnet.solana.com');
// const connection = new Connection('https://api.mainnet-beta.solana.com');

export const ConnectWalletButton = () => {
    const { publicKey, disconnect, connected, wallet } = useWallet();
    const { setVisible } = useWalletModal();
    const [balance, setBalance] = useState<number | null>(null);
    const [nickname, setNickname] = useState('');
    const [editing, setEditing] = useState(false);
    // const toaster.create = Toaster();

    useEffect(() => {
        const fetchUserData = async () => {
            if (publicKey) {
                const address = publicKey.toBase58();

                // Fetch balance
                try {
                    const bal = await connection.getBalance(publicKey);
                    setBalance(bal / LAMPORTS_PER_SOL);
                } catch (e) {
                    console.error("Balance fetch error", e);
                }

                // Fetch or create user
                const { data: user, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('solana_address', address)

                console.log("User data:", user, "Error:", error);

                if (user && user.length > 0) {
                    let nickname = user[0].nickname;
                    if (!nickname) {
                        // If nickname is empty, set to 'anon'
                        nickname = 'anon';
                    } else {
                        // If nickname is not empty, ensure it is trimmed
                        nickname = nickname.trim();
                    }
                    setNickname(nickname);
                } else if (!error) {
                    const { data, error: insertError } = await supabase
                        .from('users')
                        .insert([{ solana_address: address, nickname: 'anon' }])
                        .select()
                        .single();

                    if (!insertError) {
                        setNickname(data.nickname || 'anon');
                        toaster.create({ title: "User created", type: "success" });
                    } else {
                        toaster.create({ title: "User creation failed", type: "error" });
                    }
                }
            }
        };

        fetchUserData();
    }, [publicKey]);

    const handleClick = () => {
        if (connected) disconnect();
        else setVisible(true);
    };

    const handleNicknameSave = async () => {
        if (!publicKey) return;
        const address = publicKey.toBase58();

        const { error } = await supabase
            .from('users')
            .update({ nickname })
            .eq('solana_address', address);

        if (error) {
            toaster.create({ title: "Failed to update nickname", type: "error" });
        } else {
            toaster.create({ title: "Nickname updated 🎉", type: "success" });
            setEditing(false);
        }
    };

    return (
        <Box
            p={4}
            border="4px solid black"
            // rounded="2xl"
            bg="purple.200"
            shadow="lg"
            boxShadow={"0 4px 6px rgba(0, 0, 0, 0.1)"}
            fontFamily="monospace"
            maxW="300px"
        >
            <VStack padding={3}>
                <Button
                    onClick={handleClick}
                    w="full"
                    bg="black"
                    color="white"
                    _hover={{ bg: "purple.500" }}
                    fontSize="sm"
                >
                    {connected ? '❌ Disconnect' : '🔑 Connect Wallet'}
                </Button>

                {connected && publicKey && (
                    <HStack padding={2} align="center">

                        <Avatar.Root size={'xs'} key={'xs'} border="2px solid black">
                            <Avatar.Fallback name={wallet?.adapter.name || "Segun Adebayo"} />
                            <Avatar.Image src={wallet?.adapter.icon || "https://bit.ly/sage-adebayo"} />
                        </Avatar.Root>

                        <Box textAlign="left">
                            <Text fontSize="sm">
                                📫 {shortenAddress(publicKey.toBase58())}
                            </Text>
                            <Text fontSize="sm">
                                💰 {balance !== null ? `${balance.toFixed(2)} ◎` : '...'}
                            </Text>
                        </Box>
                    </HStack>
                )}

                {connected && (
                    <Box w="full" textAlign="center">
                        {editing ? (
                            <HStack>
                                <Input
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    size="sm"
                                    border="2px solid black"
                                    bg="white"
                                />
                                <Button
                                    onClick={handleNicknameSave}
                                    size="sm"
                                    bg="black"
                                    color="white"
                                    _hover={{ bg: "purple.600" }}
                                >
                                    💾
                                </Button>
                            </HStack>
                        ) : (
                            <Button
                                size="sm"
                                onClick={() => setEditing(true)}
                                bg="purple.300"
                                border="2px solid black"
                                _hover={{ bg: "purple.400" }}
                            >
                                ✏️ Nickname: {nickname || "anon"}
                            </Button>
                        )}
                    </Box>
                )}
            </VStack>
        </Box>
    );
};