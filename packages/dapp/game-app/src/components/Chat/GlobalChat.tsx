// components/Chat/GlobalChatWrapper.tsx
import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/supabase';
import RealtimeChat from './BaseRealtimeChat';
import { Spinner, VStack, Text } from '@chakra-ui/react';

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
        .eq('solana_address', address)
        // .single();



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

  if (loading) {
    return (
      <VStack padding={4} p={6}>
        <Spinner color="purple.500" />
        <Text fontWeight="bold" color="gray.600">Checking user identity...</Text>
      </VStack>
    );
  }

  return (
    <RealtimeChat
      chatType="global"
      currentUser={user}
    />
  );
};

export default GlobalChatWrapper;