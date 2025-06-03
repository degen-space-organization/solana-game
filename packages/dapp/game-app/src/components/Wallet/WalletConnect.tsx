// src/components/Wallet/WalletConnect.tsx
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Input,
  Avatar,
  IconButton,
} from '@chakra-ui/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Edit2, Power } from 'lucide-react';

import { toaster } from '../ui/toaster';
import { supabase } from '@/supabase';
import { solConnection as connection } from '@/web3';

const shortenAddress = (address: string) =>
  `${address.slice(0, 4)}...${address.slice(-4)}`;

export const ConnectWalletButton = () => {
  const { publicKey, disconnect, connected, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [balance, setBalance] = useState<number | null>(null);
  const [nickname, setNickname] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (publicKey) {
        setLoading(true);
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
          .eq('solana_address', address);

        if (user && user.length > 0) {
          setNickname(user[0].nickname || '');
        } else if (!error) {
          const { data, error: insertError } = await supabase
            .from('users')
            .insert([{ solana_address: address, nickname: null }])
            .select()
            .single();

          if (!insertError) {
            setNickname(data.nickname || '');
            toaster.create({
              title: "Welcome!",
              type: "success",
              duration: 2000
            });
          }
        }
        setLoading(false);
      } else {
        setBalance(null);
        setNickname('');
        setLoading(false);
      }
    };

    fetchUserData();
  }, [publicKey]);

  const handleConnect = () => {
    setVisible(true);
  };

  const handleDisconnect = () => {
    disconnect();
    setNickname('');
    setBalance(null);
    setEditing(false);
  };

  const handleNicknameSave = async () => {
    if (!publicKey) return;
    const address = publicKey.toBase58();

    const { error } = await supabase
      .from('users')
      .update({ nickname: nickname || null })
      .eq('solana_address', address);

    if (error) {
      toaster.create({
        title: "Failed to update nickname",
        type: "error",
        duration: 3000
      });
    } else {
      toaster.create({
        title: "Nickname updated!",
        type: "success",
        duration: 2000
      });
      setEditing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNicknameSave();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  // Not connected state - simple button
  if (!connected) {
    return (
      <Button
        onClick={handleConnect}
        bg="violet.500"
        color="fg.default"
        fontWeight="bold"
        fontSize="sm"
        px={6}
        py={3}
        borderRadius="sm"
        border="2px solid"
        borderColor="border.default"
        shadow="brutalist.md"
        _hover={{
          bg: "primary.muted",
          transform: "translate(-1px, -1px)",
          shadow: "brutalist.lg",
        }}
        _active={{
          transform: "translate(0px, 0px)",
          shadow: "brutalist.sm",
        }}
        transition="all 0.1s ease"
      >
        Connect Wallet
      </Button>
    );
  }

  // Connected state - compact layout
  return (
    <Box
      bg="primary.solid"
      border="2px solid"
      borderColor="border.default"
      borderRadius="sm"
      shadow="brutalist.md"
      p={2}
      minW="280px"
      maxW="320px"
    >
      {/* Top row: Avatar + Address + Balance + Disconnect */}
      <HStack justify="space-between" align="center" alignContent="stretch">
        <HStack padding={0} flex="1">
          <Avatar.Root size="sm" borderRadius="sm">
            <Avatar.Fallback
              bg="primary.muted"
              color="fg.default"
              fontWeight="bold"
              fontSize="xs"
            >
              {wallet?.adapter.name?.slice(0, 2) || "W"}
            </Avatar.Fallback>
            <Avatar.Image src={wallet?.adapter.icon || ""} />
          </Avatar.Root>

          <VStack align="start" flex="1">
            <Text fontSize="sm" fontWeight="bold" color="fg.default">
              {publicKey ? shortenAddress(publicKey.toBase58()) : ''}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {balance !== null ? `${balance.toFixed(3)} SOL` : `${loading && 'Loading...'}`}
            </Text>
          </VStack>

          {editing ? (
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyPress={handleKeyPress}
              onBlur={handleNicknameSave}
              placeholder="Enter nickname"
              size="sm"
              fontSize="xs"
              bg="bg.default"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="sm"
              flex="1"
              mr={2}
              autoFocus
            />
          ) : (
            <Text
              fontSize="xs"
              color="fg.muted"
              flex="1"
            // noOfLines={1}
            >
              {nickname || 'No nick set'}
            </Text>
          )}
        </HStack>

        <HStack>

          <IconButton
            onClick={() => setEditing(!editing)}
            size="sm"
            bg={editing ? "success" : "bg.subtle"}
            color="fg.default"
            borderRadius="sm"
            border="1px solid"
            borderColor="border.subtle"
            shadow="brutalist.sm"
            _hover={{
              bg: editing ? "success" : "bg.muted",
              transform: "translate(-1px, -1px)",
              shadow: "brutalist.md",
            }}
            _active={{
              transform: "translate(0px, 0px)",
              shadow: "brutalist.sm",
            }}
          >
            <Edit2 size={12} />
          </IconButton>

          <IconButton
            onClick={handleDisconnect}
            size="sm"
            bg="error"
            color="fg.inverted"
            borderRadius="sm"
            border="2px solid"
            borderColor="border.default"
            shadow="brutalist.sm"
            _hover={{
              transform: "translate(-1px, -1px)",
              shadow: "brutalist.md",
            }}
            _active={{
              transform: "translate(0px, 0px)",
              shadow: "brutalist.sm",
            }}
          >
            <Power size={14} />
          </IconButton>
        </HStack>
      </HStack>
    </Box>
  );
};