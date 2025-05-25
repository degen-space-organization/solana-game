import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Send, MessageCircle, Users, Edit3, Check, X, Globe } from 'lucide-react';
import { Box, Button, Flex, VStack, Text, Badge, Card, Heading, HStack } from "@chakra-ui/react";


// Mock data for testing
const MOCK_USERS = [
  { id: 1, nickname: "SolanaGamer", solana_address: "8Kq2GVcjFJHXzgXgz8Vc2sPBJ9Nh1mK5rL3nQ7wT4sA2" },
  { id: 2, nickname: null, solana_address: "9Lr3HWdkGKIYzgYh9Wd3tqQCK0Oi2nL6sM4oR8xU5tB3" },
  { id: 3, nickname: "BlockchainBoss", solana_address: "7Mn4IXekHLJZzgZi0Xe4urRDL1Pj3oM7tN5pS9yV6uC4" },
  { id: 4, nickname: null, solana_address: "6Kp5JYflIMLAzg0j1Yf5vsSDM2Qk4pN8uO6qT0zW7vD5" },
  { id: 5, nickname: "DefiDragon", solana_address: "5Jo6KZgmJNMBzg1k2Zg6wtTEN3Rl5qO9vP7rU1A8wE6" }
];

const GLOBAL_MOCK_MESSAGES = [
  {
    id: 1,
    lobby_id: null, // Global chat
    user_id: 2,
    message: "Anyone up for some high stakes games tonight?",
    created_at: new Date(Date.now() - 2400000).toISOString(), // 40 min ago
    users: MOCK_USERS[1]
  },
  {
    id: 2,
    lobby_id: null,
    user_id: 3,
    message: "Just won my first tournament! 🏆",
    created_at: new Date(Date.now() - 2100000).toISOString(), // 35 min ago
    users: MOCK_USERS[2]
  },
  {
    id: 3,
    lobby_id: null,
    user_id: 5,
    message: "Welcome to the community! GL everyone 🎮",
    created_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    users: MOCK_USERS[4]
  }
];

const LOBBY_MOCK_MESSAGES = [
  {
    id: 10,
    lobby_id: 1,
    user_id: 2,
    message: "Hey everyone! Ready for this match?",
    created_at: new Date(Date.now() - 1500000).toISOString(), // 25 min ago
    users: MOCK_USERS[1]
  },
  {
    id: 11,
    lobby_id: 1,
    user_id: 3,
    message: "Let's gooo! I've been practicing 🔥",
    created_at: new Date(Date.now() - 1200000).toISOString(), // 20 min ago
    users: MOCK_USERS[2]
  },
  {
    id: 12,
    lobby_id: 1,
    user_id: 1,
    message: "Same here! This is going to be epic 🎮",
    created_at: new Date(Date.now() - 900000).toISOString(), // 15 min ago
    users: MOCK_USERS[0]
  }
];

// Initialize Supabase client
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey);


// Types
interface ChatMessage {
  id: number;
  lobby_id?: number | null;
  user_id: number;
  message: string;
  created_at: string;
  users?: {
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
  chatType: 'global' | 'lobby';
  lobbyId?: number; // Only required for lobby chat
  currentUser: User;
  onUserUpdate?: (updatedUser: User) => void;
  useMockData?: boolean;
}

// Utility function to display name
const getDisplayName = (user: { nickname: string | null; solana_address: string } | null): string => {
  if (!user) return 'Unknown User';
  return user.nickname || `${user.solana_address.slice(0, 4)}...${user.solana_address.slice(-4)}`;
};

// Nickname Editor Component
const NicknameEditor: React.FC<{
  currentUser: User;
  onSave: (newNickname: string | null) => void;
  useMockData: boolean;
}> = ({ currentUser, onSave, useMockData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(currentUser.nickname || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);

    if (useMockData || !supabase) {
      // Mock save
      setTimeout(() => {
        onSave(nickname.trim() || null);
        setIsEditing(false);
        setIsLoading(false);
      }, 500);
      return;
    }

    // Real save to Supabase
    try {
      const { error } = await supabase
        .from('users')
        .update({ nickname: nickname.trim() || null })
        .eq('id', currentUser.id);

      if (error) {
        console.error('Error updating nickname:', error);
        alert('Failed to update nickname');
      } else {
        onSave(nickname.trim() || null);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Database error:', error);
      alert('Failed to update nickname');
    }

    setIsLoading(false);
  };

  const handleCancel = () => {
    setNickname(currentUser.nickname || '');
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <Box
        bg="white"
        border="3px solid"
        borderColor="gray.900"
        p="3"
        mb="4"
        position="relative"
      >
        <Flex justify="space-between" align="center">
          <VStack align="flex-start">
            <Text fontSize="md" fontWeight="bold" color="gray.900">
              {getDisplayName(currentUser)}
            </Text>
            <Text fontSize="xs" color="gray.600">
              {currentUser.solana_address.slice(0, 8)}...{currentUser.solana_address.slice(-8)}
            </Text>
          </VStack>
          <Button
            onClick={() => setIsEditing(true)}
            variant="ghost"
            p="1"
            bg="transparent"
            _hover={{ bg: "gray.100" }}
            _active={{ bg: "gray.200" }}
            borderRadius="0"
          >
            <Edit3 size={16} color="gray.600" />
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Box
      bg="white"
      border="3px solid"
      borderColor="gray.900"
      p="3"
      mb="4"
      position="relative"
    >
      <VStack align="stretch" spacing="2">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Enter nickname (optional)"
          className="px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={50}
          disabled={isLoading}
        />
        <HStack justify="flex-end" spacing="2">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            bg="#06D6A0"
            color="white"
            fontWeight="black"
            fontSize="sm"
            px="4"
            py="2"
            borderRadius="0"
            border="2px solid"
            borderColor="gray.900"
            shadow="3px 3px 0px rgba(0,0,0,0.8)"
            _hover={!isLoading ? {
              bg: "#04C28D",
              transform: "translate(-1px, -1px)",
              shadow: "4px 4px 0px rgba(0,0,0,0.8)",
            } : {}}
            _active={!isLoading ? {
              transform: "translate(0px, 0px)",
              shadow: "1px 1px 0px rgba(0,0,0,0.8)",
            } : {}}
            transition="all 0.1s ease"
          >
            <Check size={16} />
            <Text ml="1">Save</Text>
          </Button>
          <Button
            onClick={handleCancel}
            disabled={isLoading}
            bg="#DC143C"
            color="white"
            fontWeight="black"
            fontSize="sm"
            px="4"
            py="2"
            borderRadius="0"
            border="2px solid"
            borderColor="gray.900"
            shadow="3px 3px 0px rgba(0,0,0,0.8)"
            _hover={!isLoading ? {
              bg: "#B01030",
              transform: "translate(-1px, -1px)",
              shadow: "4px 4px 0px rgba(0,0,0,0.8)",
            } : {}}
            _active={!isLoading ? {
              transform: "translate(0px, 0px)",
              shadow: "1px 1px 0px rgba(0,0,0,0.8)",
            } : {}}
            transition="all 0.1s ease"
          >
            <X size={16} />
            <Text ml="1">Cancel</Text>
          </Button>
        </HStack>
        <Text fontSize="xs" color="gray.500" mt="1">
          Leave empty to use wallet address
        </Text>
      </VStack>
    </Box>
  );
};

// Main Chat Component
const RealtimeChat: React.FC<ChatProps> = ({
  chatType,
  lobbyId,
  currentUser,
  onUserUpdate,
  useMockData = true
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [mockMessageId, setMockMessageId] = useState(100);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Validation
  if (chatType === 'lobby' && !lobbyId) {
    throw new Error('lobbyId is required for lobby chat');
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);

      if (useMockData || !supabase) {
        // Load mock data
        const mockMessages = chatType === 'global'
          ? GLOBAL_MOCK_MESSAGES
          : LOBBY_MOCK_MESSAGES.filter(msg => msg.lobby_id === lobbyId);

        setMessages(mockMessages);
        setIsConnected(true);

        setTimeout(() => setIsLoading(false), 500);
        return;
      }

      // Real Supabase data fetching
      try {
        const query = supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: true });

        // Filter by chat type
        const { data: messagesData, error: messagesError } = chatType === 'global'
          ? await query.is('lobby_id', null)
          : await query.eq('lobby_id', lobbyId);

        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
          setIsLoading(false);
          return;
        }

        // Get user data for those messages
        if (messagesData && messagesData.length > 0) {
          const userIds = [...new Set(messagesData.map(msg => msg.user_id))];
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, nickname, solana_address')
            .in('id', userIds);

          if (usersError) {
            console.error('Error fetching users:', usersError);
          }

          const messagesWithUsers = messagesData.map(message => ({
            ...message,
            users: usersData?.find(user => user.id === message.user_id) || null
          }));

          setMessages(messagesWithUsers);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error('Database connection error:', error);
      }

      setIsLoading(false);
    };

    loadMessages();
  }, [chatType, lobbyId, useMockData]);

  // Real-time subscription
  useEffect(() => {
    if (useMockData || !supabase) return;

    const filter = chatType === 'global'
      ? 'lobby_id=is.null'
      : `lobby_id=eq.${lobbyId}`;

    const channel = supabase
      .channel(`chat-${chatType}-${lobbyId || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: filter
        },
        async (payload) => {
          const { data: userData } = await supabase
            .from('users')
            .select('id, nickname, solana_address')
            .eq('id', payload.new.user_id)
            .single();

          const newMessage = {
            ...payload.new,
            users: userData
          } as ChatMessage;

          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatType, lobbyId, useMockData]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    if (useMockData || !supabase) {
      // Mock message sending
      const mockMessage: ChatMessage = {
        id: mockMessageId,
        lobby_id: chatType === 'lobby' ? lobbyId : null,
        user_id: currentUser.id,
        message: newMessage.trim(),
        created_at: new Date().toISOString(),
        users: currentUser
      };

      setMessages(prev => [...prev, mockMessage]);
      setMockMessageId(prev => prev + 1);
      setNewMessage('');

      // Simulate responses (lower chance for global chat)
      const responseChance = chatType === 'global' ? 0.3 : 0.7;
      if (Math.random() < responseChance) {
        setTimeout(() => {
          const availableUsers = MOCK_USERS.filter(u => u.id !== currentUser.id);
          const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];

          const responses = chatType === 'global'
            ? [
                "Welcome to the platform!",
                "Good luck in your games!",
                "Nice to meet you!",
                "Hope you enjoy playing here!",
                "GL HF! 🎮"
              ]
            : [
                "Nice move!",
                "Good point!",
                "I agree 👍",
                "Let's see what happens next",
                "This is getting interesting!",
                "GL HF everyone!",
                "💪💪💪"
              ];

          const responseMessage: ChatMessage = {
            id: mockMessageId + 1,
            lobby_id: chatType === 'lobby' ? lobbyId : null,
            user_id: randomUser.id,
            message: responses[Math.floor(Math.random() * responses.length)],
            created_at: new Date().toISOString(),
            users: randomUser
          };

          setMessages(prev => [...prev, responseMessage]);
          setMockMessageId(prev => prev + 2);
        }, 1000 + Math.random() * 3000);
      }
      return;
    }

    // Real message sending
    const messageData = {
      lobby_id: chatType === 'lobby' ? lobbyId : null,
      user_id: currentUser.id,
      message: newMessage.trim()
    };

    const { error } = await supabase
      .from('chat_messages')
      .insert([messageData]);

    if (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } else {
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Card.Root
        width="100%"
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="gray.50"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        transition="all 0.2s ease"
        position="relative"
        height="96"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <VStack>
          <MessageCircle size={32} color="gray.400" />
          <Text mt="2" fontSize="sm" color="gray.500">Loading chat...</Text>
        </VStack>
      </Card.Root>
    );
  }

  return (
    <Card.Root
      width="100%"
      borderWidth="4px"
      borderStyle="solid"
      borderColor="gray.900"
      bg="white"
      shadow="8px 8px 0px rgba(0,0,0,0.8)"
      borderRadius="0"
      transition="all 0.2s ease"
      position="relative"
      height="96"
      display="flex"
      flexDirection="column"
    >
      <Card.Body p="0" flex="1" display="flex" flexDirection="column">
        {/* Header */}
        <Flex
          justify="space-between"
          align="center"
          p="3"
          borderBottom="4px solid"
          borderColor="gray.900"
          bg="gray.100"
          borderTopRadius="0"
        >
          <HStack spacing="2">
            {chatType === 'global' ? (
              <Globe size={20} color="#06D6A0" />
            ) : (
              <MessageCircle size={20} color="#118AB2" />
            )}
            <Text fontSize="md" fontWeight="black" color="gray.900" textTransform="uppercase" letterSpacing="tight">
              {chatType === 'global' ? 'Global Chat' : `Lobby ${lobbyId} Chat`}
            </Text>
          </HStack>
          <HStack spacing="2">
            <Box
              h="3"
              w="3"
              borderRadius="full"
              bg={isConnected ? '#06D6A0' : '#DC143C'}
              border="2px solid"
              borderColor="gray.900"
            />
            <Text fontSize="xs" fontWeight="bold" color="gray.700">
              {useMockData ? 'Mock Mode' : (isConnected ? 'CONNECTED' : 'DISCONNECTED')}
            </Text>
          </HStack>
        </Flex>

        {/* Messages */}
        <Box flex="1" overflowY="auto" p="3" className="space-y-3">
          {messages.length === 0 ? (
            <VStack justify="center" align="center" height="100%" color="gray.500">
              <Users size={32} color="gray.300" />
              <Text mt="2" fontSize="sm" textAlign="center">
                {chatType === 'global'
                  ? 'Welcome! Start chatting with the community!'
                  : 'No messages yet. Start the conversation!'
                }
              </Text>
            </VStack>
          ) : (
            messages.map((message) => {
              const isOwnMessage = message.user_id === currentUser.id;
              // @ts-ignore
              const displayName = getDisplayName(message.users);

              return (
                <Flex
                  key={message.id}
                  justify={isOwnMessage ? 'flex-end' : 'flex-start'}
                >
                  <Box
                    maxWidth="80%"
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
                      <Text fontSize="xs" fontWeight="black" color="gray.700" mb="1" textTransform="uppercase">
                        {displayName}
                      </Text>
                    )}
                    <Text fontSize="sm" wordBreak="break-word">{message.message}</Text>
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
            })
          )}
          <div ref={messagesEndRef} />
        </Box>
      </Card.Body>

      {/* Message Input */}
      <Card.Footer p="3" borderTop="4px solid" borderColor="gray.900" bg="gray.100">
        <HStack width="100%" spacing="2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message ${chatType === 'global' ? 'everyone' : 'lobby'}...`}
            className="flex-1 px-3 py-2 border-4 border-gray-900 bg-white text-gray-900 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            maxLength={500}
          />
          <Button
            type="button"
            onClick={sendMessage}
            disabled={!newMessage.trim()}
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
            _hover={!newMessage.trim() ? {} : {
              bg: "#E55A2B",
              transform: "translate(-2px, -2px)",
              shadow: "6px 6px 0px rgba(0,0,0,0.8)",
            }}
            _active={!newMessage.trim() ? {} : {
              transform: "translate(0px, 0px)",
              shadow: "2px 2px 0px rgba(0,0,0,0.8)",
            }}
            transition="all 0.1s ease"
          >
            <Send size={20} />
          </Button>
        </HStack>
      </Card.Footer>
    </Card.Root>
  );
};

// Example usage component
const ChatExample: React.FC = () => {
  const [selectedChat, setSelectedChat] = useState<{
    type: 'global' | 'lobby';
    lobbyId?: number;
  }>({ type: 'global' });

  const [useMockData, setUseMockData] = useState(true);

  // Mock current user - replace with your auth system
  const [currentUser, setCurrentUser] = useState<User>({
    id: 1,
    nickname: null, // Start with no nickname
    solana_address: "8Kq2GVcjFJHXzgXgz8Vc2sPBJ9Nh1mK5rL3nQ7wT4sA2"
  });

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(prev => ({ ...prev, ...updatedUser }));
  };

  const handleNicknameUpdate = (newNickname: string | null) => {
    setCurrentUser(prev => ({ ...prev, nickname: newNickname }));
  };

  return (
    <Box className="max-w-4xl mx-auto p-6 space-y-6">
      <Card.Root
        width="100%"
        borderWidth="4px"
        borderStyle="solid"
        borderColor="gray.900"
        bg="white"
        shadow="8px 8px 0px rgba(0,0,0,0.8)"
        borderRadius="0"
        transform="rotate(-0.5deg)"
        _hover={{
          transform: "rotate(0deg) scale(1.00)", // Slightly less hover transform for the container
          shadow: "12px 12px 0px rgba(0,0,0,0.8)",
        }}
        transition="all 0.2s ease"
        position="relative"
      >
        <Card.Body p="6">
          <Heading size="lg" fontWeight="black" color="gray.900" mb="4" textTransform="uppercase" letterSpacing="tight">
            🎮 Gaming Chat Platform
          </Heading>

          {/* User Profile Section */}
          <Box mb="6">
            <Text fontSize="md" fontWeight="bold" color="gray.700" mb="3">Your Profile</Text>
            <NicknameEditor
              currentUser={currentUser}
              onSave={handleNicknameUpdate}
              useMockData={useMockData}
            />
          </Box>

          {/* Mock Data Toggle */}
          <Box
            mb="4"
            p="3"
            bg="yellow.100"
            border="3px solid"
            borderColor="yellow.600"
            borderRadius="0"
            shadow="4px 4px 0px rgba(0,0,0,0.8)"
          >
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={useMockData}
                onChange={(e) => setUseMockData(e.target.checked)}
                className="form-checkbox h-5 w-5 text-yellow-600 border-gray-900 rounded-none"
              />
              <Text fontSize="sm" fontWeight="bold" color="yellow.800">
                Use Mock Data (disable to connect to real Supabase)
              </Text>
            </label>
          </Box>

          {/* Chat Type Selector */}
          <Box mb="6">
            <Text fontSize="sm" fontWeight="bold" color="gray.700" mb="2">
              Select Chat:
            </Text>
            <HStack spacing="4">
              <Button
                onClick={() => setSelectedChat({ type: 'global' })}
                bg={selectedChat.type === 'global' ? '#06D6A0' : 'gray.100'}
                color={selectedChat.type === 'global' ? 'white' : 'gray.700'}
                fontWeight="black"
                fontSize="md"
                px="4"
                py="2"
                borderRadius="0"
                border="3px solid"
                borderColor="gray.900"
                shadow="4px 4px 0px rgba(0,0,0,0.8)"
                _hover={{
                  bg: selectedChat.type === 'global' ? '#04C28D' : 'gray.200',
                  transform: "translate(-2px, -2px)",
                  shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "2px 2px 0px rgba(0,0,0,0.8)",
                }}
                transition="all 0.1s ease"
              >
                <Globe size={18} />
                <Text ml="2">Global Chat</Text>
              </Button>
              <Button
                onClick={() => setSelectedChat({ type: 'lobby', lobbyId: 1 })}
                bg={selectedChat.type === 'lobby' ? '#118AB2' : 'gray.100'}
                color={selectedChat.type === 'lobby' ? 'white' : 'gray.700'}
                fontWeight="black"
                fontSize="md"
                px="4"
                py="2"
                borderRadius="0"
                border="3px solid"
                borderColor="gray.900"
                shadow="4px 4px 0px rgba(0,0,0,0.8)"
                _hover={{
                  bg: selectedChat.type === 'lobby' ? '#0E7FA1' : 'gray.200',
                  transform: "translate(-2px, -2px)",
                  shadow: "6px 6px 0px rgba(0,0,0,0.8)",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "2px 2px 0px rgba(0,0,0,0.8)",
                }}
                transition="all 0.1s ease"
              >
                <MessageCircle size={18} />
                <Text ml="2">Lobby Chat</Text>
              </Button>
            </HStack>
          </Box>

          {/* Chat Component */}
          <RealtimeChat
            chatType={selectedChat.type}
            lobbyId={selectedChat.lobbyId}
            currentUser={currentUser}
            onUserUpdate={handleUserUpdate}
            useMockData={useMockData}
          />
        </Card.Body>
      </Card.Root>
    </Box>
  );
};

export default ChatExample;