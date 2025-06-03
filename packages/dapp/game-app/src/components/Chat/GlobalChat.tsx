// @ts-nocheck
// src/components/Chat/GlobalChat.tsx
import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/supabase';
import RealtimeChat from './BaseRealtimeChat';
import { Spinner, VStack, Text, Box, Button } from '@chakra-ui/react';

// Match your database schema
interface User {
  id: number;
  nickname: string | null;
  solana_address: string;
}

const GlobalChatWrapper: React.FC = () => {
  const { publicKey } = useWallet();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (!publicKey) {
        setUser(null);
        setLoading(false);
        return;
      }

      const address = publicKey.toBase58();

      const { data, error } = await supabase
        .from('users')
        .select('id, nickname, solana_address')
        .eq('solana_address', address);

      if (error) {
        console.error('Error fetching user:', error);
        setUser(null);
      } else {
        setUser(data[0] || null);
      }

      setLoading(false);
    };

    fetchUser();
  }, [publicKey]);


  const handleManualRefresh = async () => {
    // manually obtain the public key and refetch the user
    // const { publicKey } = useWallet();
    if (!publicKey) {
      setUser(null);
      return;
    }
    const address = publicKey.toBase58();
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, nickname, solana_address')
      .eq('solana_address', address);
    if (error) {
      console.error('Error fetching user on manual refresh:', error);
      setUser(null);
    }
    else {
      setUser(data[0] || null);
    }
    setLoading(false);
  };


  if (loading) {
    return (
      <Box
        h="100%"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="bg.subtle"
        border="4px solid"
        borderColor="border.default"
        borderRadius="none"
        overflow="hidden"
      >
        <VStack spacing={4} p={6}>
          <Spinner
            size="lg"
            color="primary.solid"
          />
          <Text
            fontWeight="bold"
            color="fg.muted"
            textAlign="center"
            fontSize="sm"
            textTransform="uppercase"
          >
            Checking user identity...
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box h="100%" overflow="hidden">
      {user ? (
        <RealtimeChat
          chatType="global"
          currentUser={user}
        />
      ) : (
        <>
          <Box
            h="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            bg="bg.subtle"
            border="4px solid"
            borderColor="border.default"
            borderRadius="none"
            overflow="hidden"
          >
            <VStack spacing={4} p={6}>
              <Text
                fontWeight="bold"
                color="fg.default"
                textAlign="center"
                fontSize="xl"
                textTransform="uppercase"
              >🔒 CONNECT WALLET</Text>
              <Text
                fontWeight="bold"
                color="fg.muted"
                textAlign="center"
                fontSize="sm"
                textTransform="uppercase"
              >
                Please connect your wallet to join the global chat.
              </Text>
              <Button
                onClick={handleManualRefresh}
                colorScheme={"violet"}

              >
                Refresh Chat
              </Button>
            </VStack>
          </Box>
        </>
      )}
    </Box>
  );
};

export default GlobalChatWrapper;