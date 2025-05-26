// components/Chat/RealtimeChat.tsx - FIXED VERSION
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  VStack,
  HStack,
  Text,
  Badge,
  Input,
  Spinner,
  IconButton,
} from '@chakra-ui/react';
import { Send, MessageCircle, Users, Globe, Trophy, Gamepad2, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '../../supabase/index';

// Types
interface ChatMessage {
  id: number;
  match_id: number | null;
  lobby_id: number | null;
  tournament_id: number | null;
  user_id: number;
  message: string;
  created_at: string;
  users?: {
    id: number;
    nickname: string | null;
    solana_address: string;
  } | null;
}

interface User {
  id: number;
  nickname: string | null;
  solana_address: string;
}

interface ChatProps {
  chatType: 'global' | 'lobby' | 'match' | 'tournament';
  contextId?: number; // lobby_id, match_id, or tournament_id (not needed for global)
  currentUser: User | null; // Must be authenticated user from database
  title?: string; // Custom title for the chat
}

// Chat Component
const RealtimeChat: React.FC<ChatProps> = ({
  chatType,
  contextId,
  currentUser,
  title
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Validation
  if (chatType !== 'global' && !contextId) {
    throw new Error(`contextId is required for ${chatType} chat`);
  }

  if (!currentUser) {
    return (
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="red.50"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        p="6"
        textAlign="center"
      >
        <Card.Body>
          <Text fontSize="lg" fontWeight="black" color="red.600" mb="2">
            🔒 AUTHENTICATION REQUIRED
          </Text>
          <Text color="red.500">
            Connect your wallet to access chat
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  // Utility functions
  const getDisplayName = (user: ChatMessage['users']): string => {
    if (!user) return 'Unknown User';
    return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
    return date.toLocaleDateString();
  };

  const getChatIcon = () => {
    switch (chatType) {
      case 'global': return <Globe size={20} color="#06D6A0" />;
      case 'lobby': return <Users size={20} color="#118AB2" />;
      case 'match': return <Gamepad2 size={20} color="#FF6B35" />;
      case 'tournament': return <Trophy size={20} color="#7B2CBF" />;
      default: return <MessageCircle size={20} color="#6B7280" />;
    }
  };

  const getChatTitle = (): string => {
    if (title) return title;
    switch (chatType) {
      case 'global': return 'Global Chat';
      case 'lobby': return `Lobby #${contextId} Chat`;
      case 'match': return `Match #${contextId} Chat`;
      case 'tournament': return `Tournament #${contextId} Chat`;
      default: return 'Chat';
    }
  };

  // Check if message belongs to current chat context
  const isMessageForCurrentChat = (message: any): boolean => {
    if (chatType === 'global') {
      return !message.match_id && !message.lobby_id && !message.tournament_id;
    } else if (chatType === 'lobby') {
      return message.lobby_id === contextId;
    } else if (chatType === 'match') {
      return message.match_id === contextId;
    } else if (chatType === 'tournament') {
      return message.tournament_id === contextId;
    }
    return false;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('chat_messages')
          .select(`
            *,
            users (
              id,
              nickname,
              solana_address
            )
          `)
          .order('created_at', { ascending: true });

        // Apply filters based on chat type
        if (chatType === 'global') {
          query = query
            .is('match_id', null)
            .is('lobby_id', null)
            .is('tournament_id', null);
        } else if (chatType === 'lobby') {
          query = query.eq('lobby_id', contextId!);
        } else if (chatType === 'match') {
          query = query.eq('match_id', contextId!);
        } else if (chatType === 'tournament') {
          query = query.eq('tournament_id', contextId!);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw fetchError;
        }

        setMessages(
          (data || []).filter((msg: any) => !!msg.created_at)
            .map((msg: any) => ({
              ...msg,
              created_at: msg.created_at ?? new Date().toISOString()
            }))
        );
      } catch (err) {
        console.error('Error loading messages:', err);
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [chatType, contextId]);

  // 🔥 FIXED: Realtime subscription
  useEffect(() => {
    if (loading) return;

    console.log(`Setting up realtime for ${chatType} chat`, { contextId });
    setConnectionStatus('connecting');

    // 🔥 KEY FIX: Subscribe to ALL chat messages and filter client-side
    // This avoids issues with complex server-side filters
    const channel = supabase
      .channel(`chat-${chatType}-${contextId || 'global'}-${Date.now()}`) // Add timestamp to ensure unique channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
          // 🔥 REMOVED: filter - we'll filter client-side instead
        },
        async (payload) => {
          console.log('Received realtime message:', payload.new);
          
          // 🔥 KEY FIX: Filter client-side
          if (!isMessageForCurrentChat(payload.new)) {
            console.log('Message not for current chat, ignoring');
            return;
          }

          try {
            // Fetch user data for the new message
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('id, nickname, solana_address')
              .eq('id', payload.new.user_id)
              .single();

            if (userError) {
              console.error('Error fetching user data:', userError);
              return;
            }

            const newMessage: ChatMessage = {
              ...payload.new as any,
              users: userData
            };

            console.log('Adding new message to chat:', newMessage);

            // 🔥 FIXED: Prevent duplicate messages
            setMessages(prev => {
              const messageExists = prev.some(msg => msg.id === newMessage.id);
              if (messageExists) {
                console.log('Message already exists, skipping');
                return prev;
              }
              return [...prev, newMessage];
            });
          } catch (err) {
            console.error('Error processing new message:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'connecting');
      });

    // 🔥 ADDED: Better cleanup
    return () => {
      console.log('Cleaning up realtime subscription');
      channel.unsubscribe();
    };
  }, [chatType, contextId, loading]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 🔥 ENHANCED: Send message with better error handling
  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || sending) return;

    console.log('Sending message:', {
      message: newMessage,
      chatType,
      contextId,
      currentUser: currentUser.id
    });

    setSending(true);
    setError(null); // Clear any previous errors

    try {
      const messageData: any = {
        user_id: currentUser.id,
        message: newMessage.trim(),
        match_id: null,
        lobby_id: null,
        tournament_id: null
      };

      // Set the appropriate context
      if (chatType === 'lobby') {
        messageData.lobby_id = contextId;
      } else if (chatType === 'match') {
        messageData.match_id = contextId;
      } else if (chatType === 'tournament') {
        messageData.tournament_id = contextId;
      }

      console.log('Inserting message data:', messageData);

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([messageData])
        .select(); // 🔥 ADDED: Select to get the inserted message

      if (error) {
        throw error;
      }

      console.log('Message sent successfully:', data);
      setNewMessage('');
      
      // 🔥 OPTIONAL: Optimistically add message (realtime should handle this, but good fallback)
      // Note: Comment this out if you see duplicate messages, realtime should handle it
      /*
      if (data && data[0]) {
        const optimisticMessage: ChatMessage = {
          ...data[0],
          users: currentUser
        };
        setMessages(prev => [...prev, optimisticMessage]);
      }
      */

    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card.Root
      borderWidth="4px"
      borderStyle="solid"
      borderColor="gray.900"
      bg="white"
      shadow="8px 8px 0px rgba(0,0,0,0.8)"
      borderRadius="0"
      h="100%"
      display="flex"
      flexDirection="column"
    >
      {/* Header */}
      <Card.Header
        p="4"
        borderBottom="4px solid"
        borderColor="gray.900"
        bg="gray.100"
      >
        <HStack justify="space-between">
          <HStack>
            {getChatIcon()}
            <Text fontSize="lg" fontWeight="black" color="gray.900" textTransform="uppercase">
              {getChatTitle()}
            </Text>
          </HStack>
          <HStack>
            {/* 🔥 ADDED: Connection status indicator */}
            <HStack padding="1">
              {connectionStatus === 'connected' ? (
                <Wifi size={16} color="#06D6A0" />
              ) : (
                <WifiOff size={16} color="#DC143C" />
              )}
              <Text fontSize="xs" color={connectionStatus === 'connected' ? 'green.600' : 'red.600'}>
                {connectionStatus.toUpperCase()}
              </Text>
            </HStack>
            <Badge
              bg={chatType === 'global' ? '#06D6A0' : '#118AB2'}
              color="white"
              fontSize="xs"
              fontWeight="black"
              px="2"
              py="1"
              borderRadius="0"
              textTransform="uppercase"
            >
              Live
            </Badge>
          </HStack>
        </HStack>
      </Card.Header>

      {/* Messages Area */}
      <Card.Body p="0" flex="1" display="flex" flexDirection="column" overflow="hidden">
        {loading ? (
          <VStack justify="center" flex="1" p="8">
            <Spinner size="lg" color="blue.500" />
            <Text fontSize="sm" color="gray.600">Loading messages...</Text>
          </VStack>
        ) : error ? (
          <VStack justify="center" flex="1" p="8">
            <Text fontSize="sm" color="red.500" textAlign="center">{error}</Text>
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                window.location.reload();
              }}
              bg="red.500"
              color="white"
              fontWeight="bold"
              borderRadius="0"
              border="2px solid"
              borderColor="gray.900"
            >
              Retry
            </Button>
          </VStack>
        ) : (
          <Box flex="1" overflowY="auto" p="4">
            {messages.length === 0 ? (
              <VStack justify="center" align="center" h="200px" color="gray.500">
                <MessageCircle size={32} color="#9CA3AF" />
                <Text fontSize="sm" textAlign="center">
                  {chatType === 'global' 
                    ? 'Welcome! Start the global conversation!' 
                    : 'No messages yet. Be the first to chat!'
                  }
                </Text>
              </VStack>
            ) : (
              <VStack align="stretch" padding="3">
                {messages.map((message) => {
                  const isOwnMessage = message.user_id === currentUser.id;
                  const displayName = getDisplayName(message.users);

                  return (
                    <Flex
                      key={message.id}
                      justify={isOwnMessage ? 'flex-end' : 'flex-start'}
                    >
                      <Box
                        maxW="70%"
                        px="3"
                        py="2"
                        borderRadius="0"
                        border="2px solid"
                        borderColor="gray.900"
                        bg={isOwnMessage ? '#118AB2' : 'gray.100'}
                        color={isOwnMessage ? 'white' : 'gray.900'}
                        shadow="3px 3px 0px rgba(0,0,0,0.8)"
                      >
                        {!isOwnMessage && (
                          <Text
                            fontSize="xs"
                            fontWeight="black"
                            color={isOwnMessage ? 'blue.100' : 'gray.600'}
                            mb="1"
                            textTransform="uppercase"
                          >
                            {displayName}
                          </Text>
                        )}
                        <Text fontSize="sm" wordBreak="break-word" lineHeight="1.4">
                          {message.message}
                        </Text>
                        <Text
                          fontSize="xs"
                          mt="1"
                          color={isOwnMessage ? 'blue.100' : 'gray.500'}
                          textAlign={isOwnMessage ? 'right' : 'left'}
                        >
                          {formatTime(message.created_at)}
                        </Text>
                      </Box>
                    </Flex>
                  );
                })}
                <div ref={messagesEndRef} />
              </VStack>
            )}
          </Box>
        )}
      </Card.Body>

      {/* Message Input */}
      <Card.Footer p="4" borderTop="4px solid" borderColor="gray.900" bg="gray.100">
        <HStack width="100%" padding="2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message ${getChatTitle().toLowerCase()}...`}
            borderWidth="3px"
            borderColor="gray.900"
            borderRadius="0"
            bg="white"
            color="gray.900"
            _focus={{
              borderColor: "#118AB2",
              boxShadow: "none"
            }}
            _placeholder={{ color: "gray.500" }}
            maxLength={500}
            disabled={sending}
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            bg="#FF6B35"
            color="white"
            fontWeight="black"
            fontSize="lg"
            px="4"
            py="2"
            borderRadius="0"
            border="3px solid"
            borderColor="gray.900"
            shadow="4px 4px 0px rgba(0,0,0,0.8)"
            _hover={!newMessage.trim() || sending ? {} : {
              bg: "#E55A2B",
              transform: "translate(-2px, -2px)",
              shadow: "6px 6px 0px rgba(0,0,0,0.8)",
            }}
            _active={!newMessage.trim() || sending ? {} : {
              transform: "translate(0px, 0px)",
              shadow: "2px 2px 0px rgba(0,0,0,0.8)",
            }}
            transition="all 0.1s ease"
            minW="60px"
          >
            {sending ? <Spinner size="sm" /> : <Send size={20} />}
          </Button>
        </HStack>
      </Card.Footer>
    </Card.Root>
  );
};

export default RealtimeChat;