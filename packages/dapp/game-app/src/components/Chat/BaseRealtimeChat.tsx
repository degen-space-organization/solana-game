// src/components/Chat/BaseRealtimeChat.tsx
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
  // All hooks must be declared at the top level, always in the same order
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Validation - moved after hooks
  const isValidContext = chatType === 'global' || contextId !== undefined;
  
  if (!isValidContext) {
    console.error(`contextId is required for ${chatType} chat`);
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
      case 'global': return 'Chat';
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
    if (!isValidContext) return;

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
          .order('created_at', { ascending: false }) // Get newest first
          .limit(100); // Limit to 100 messages

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

        // Reverse to show oldest first, but limited to 100
        setMessages(
          (data || [])
            .filter((msg: any) => !!msg.created_at)
            .reverse() // Show oldest first for proper chat order
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
  }, [chatType, contextId, isValidContext]);

  // Realtime subscription
  useEffect(() => {
    if (loading || !isValidContext) return;

    console.log(`Setting up realtime for ${chatType} chat`, { contextId });
    setConnectionStatus('connecting');

    const channel = supabase
      .channel(`chat-${chatType}-${contextId || 'global'}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        async (payload) => {
          console.log('Received realtime message:', payload.new);
          
          if (!isMessageForCurrentChat(payload.new)) {
            console.log('Message not for current chat, ignoring');
            return;
          }

          try {
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

    return () => {
      console.log('Cleaning up realtime subscription');
      channel.unsubscribe();
    };
  }, [chatType, contextId, loading, isValidContext]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || sending) return;

    console.log('Sending message:', {
      message: newMessage,
      chatType,
      contextId,
      currentUser: currentUser.id
    });

    setSending(true);
    setError(null);

    try {
      const messageData: any = {
        user_id: currentUser.id,
        message: newMessage.trim(),
        match_id: null,
        lobby_id: null,
        tournament_id: null
      };

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
        .select();

      if (error) {
        throw error;
      }

      console.log('Message sent successfully:', data);
      setNewMessage('');

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

  // Conditional rendering after all hooks
  if (!currentUser) {
    return (
      <Card.Root

        borderRadius="none"
        p={6}
        textAlign="center"
      >
        <Card.Header>
          <Text fontSize="lg" fontWeight="black" color="primary.contrast" mb={2}>
            CHAT
          </Text>
        </Card.Header>
        <Card.Body>
          <Text fontSize="lg" fontWeight="black" color="primary.contrast" mb={2}>
            🔒 CONNECT WALLET
          </Text>
          <Text color="primary.contrast">
            Connect your wallet to access chat
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  if (!isValidContext) {
    return (
      <Card.Root
        borderWidth="4px"
        borderStyle="solid"
        borderColor="border.default"
        bg="brutalist.red"
        shadow="brutalist.xl"
        borderRadius="none"
        p={6}
        textAlign="center"
      >
        <Card.Body>
          <Text fontSize="lg" fontWeight="black" color="primary.contrast" mb={2}>
            ⚠️ INVALID CONTEXT
          </Text>
          <Text color="primary.contrast">
            {`contextId is required for ${chatType} chat`}
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root
      // borderWidth="2px"
      borderStyle="solid"
      borderColor="border.default"
      bg="bg.default"
      shadow="brutalist.xl"
      borderRadius="none"
      height={"100%"}
      // h="100%"
      display="flex"
      flexDirection="column"
      alignItems={'space-between'}
      overflow="hidden"
    >
      {/* Header */}
      <Card.Header
        p={4}
        borderBottom="4px solid"
        borderColor="border.default"
        bg="bg.subtle"
      >
        <HStack justify="space-between">
          <HStack>
            {getChatIcon()}
            <Text fontSize="lg" fontWeight="black" color="fg.default" textTransform="uppercase">
              {getChatTitle()}
            </Text>
          </HStack>
          <HStack>
            <HStack padding={1}>
              {connectionStatus === 'connected' ? (
                <Wifi size={16} color="#06D6A0" />
              ) : (
                <WifiOff size={16} color="#DC143C" />
              )}
              <Text fontSize="xs" color={connectionStatus === 'connected' ? 'success' : 'error'}>
                {connectionStatus.toUpperCase()}
              </Text>
            </HStack>
            <Badge
              bg={chatType === 'global' ? 'brutalist.green' : 'brutalist.blue'}
              color="primary.contrast"
              fontSize="xs"
              fontWeight="black"
              px={2}
              py={1}
              borderRadius="none"
              border="2px solid"
              borderColor="border.default"
              textTransform="uppercase"
              shadow="brutalist.sm"
            >
              Live
            </Badge>
          </HStack>
        </HStack>
      </Card.Header>

      {/* Messages Area */}
      <Card.Body p={0} 
        flex="1"
        display="flex"
        flexDirection="column"
        overflow="hidden"
        // height={"80%"}
      >
        {loading ? (
          <VStack justify="center" flex="1" p={8}>
            <Spinner size="lg" color="primary.solid" />
            <Text fontSize="sm" color="fg.muted">Loading messages...</Text>
          </VStack>
        ) : error ? (
          <VStack justify="center" flex="1" p={8}>
            <Text fontSize="sm" color="error" textAlign="center">{error}</Text>
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                window.location.reload();
              }}
              bg="brutalist.red"
              color="primary.contrast"
              fontWeight="bold"
              borderRadius="none"
              border="2px solid"
              borderColor="border.default"
              shadow="brutalist.sm"
              _hover={{
                transform: "translate(-1px, -1px)",
                shadow: "brutalist.md",
              }}
            >
              Retry
            </Button>
          </VStack>
        ) : (
          <Box 
            flex="1"
            overflowY="auto"
            p={4}
            minH="0"
            maxH="500px"
            // maxH={'50%'}
          >
            {messages.length === 0 ? (
              <VStack justify="center" align="center" h="200px" color="fg.subtle">
                <MessageCircle size={32} />
                <Text fontSize="sm" textAlign="center">
                  {chatType === 'global' 
                    ? 'Welcome! Start the global conversation!' 
                    : 'No messages yet. Be the first to chat!'
                  }
                </Text>
              </VStack>
            ) : (
              <VStack align="stretch" padding={3}>
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
                        px={3}
                        py={2}
                        borderRadius="none"
                        border="3px solid"
                        borderColor="border.default"
                        bg={isOwnMessage ? 'primary.solid' : 'bg.subtle'}
                        color={isOwnMessage ? 'primary.contrast' : 'fg.default'}
                        shadow="brutalist.md"
                      >
                        {!isOwnMessage && (
                          <Text
                            fontSize="xs"
                            fontWeight="black"
                            color={isOwnMessage ? 'primary.contrast' : 'fg.muted'}
                            mb={1}
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
                          mt={1}
                          color={isOwnMessage ? 'primary.contrast' : 'fg.subtle'}
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
      <Card.Footer p={4} borderTop="4px solid" borderColor="border.default" bg="bg.subtle" minHeight={'10%'}>
        <HStack width="100%" padding={2}>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message ${getChatTitle().toLowerCase()}...`}
            borderWidth="3px"
            borderColor="border.default"
            borderRadius="none"
            bg="bg.default"
            color="fg.default"
            _focus={{
              borderColor: "primary.solid",
              shadow: "brutalist.sm"
            }}
            _placeholder={{ color: "fg.subtle" }}
            maxLength={500}
            disabled={sending}
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            bg="violet.500"
            color="primary.contrast"
            fontWeight="black"
            fontSize="lg"
            px={4}
            py={2}
            borderRadius="none"
            border="3px solid"
            borderColor="border.default"
            shadow="brutalist.md"
            _hover={!newMessage.trim() || sending ? {} : {
              transform: "translate(-2px, -2px)",
              shadow: "brutalist.lg",
            }}
            _active={!newMessage.trim() || sending ? {} : {
              transform: "translate(0px, 0px)",
              shadow: "brutalist.sm",
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