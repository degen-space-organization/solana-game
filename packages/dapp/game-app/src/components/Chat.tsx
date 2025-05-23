import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Send, MessageCircle, Users, Edit3, Check, X, Globe } from 'lucide-react';

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
      <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            {getDisplayName(currentUser)}
          </p>
          <p className="text-xs text-gray-500">
            {currentUser.solana_address.slice(0, 8)}...{currentUser.solana_address.slice(-8)}
          </p>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="Edit nickname"
        >
          <Edit3 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="p-2 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Enter nickname (optional)"
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          maxLength={50}
          disabled={isLoading}
        />
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50 transition-colors"
          title="Save"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Leave empty to use wallet address
      </p>
    </div>
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
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <MessageCircle className="mx-auto h-8 w-8 text-gray-400 animate-pulse" />
          <p className="mt-2 text-sm text-gray-500">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-96 bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center space-x-2">
          {chatType === 'global' ? (
            <Globe className="h-5 w-5 text-green-600" />
          ) : (
            <MessageCircle className="h-5 w-5 text-blue-600" />
          )}
          <h3 className="font-medium text-gray-900">
            {chatType === 'global' ? 'Global Chat' : `Lobby ${lobbyId} Chat`}
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-500">
            {useMockData ? 'Mock Mode' : (isConnected ? 'Connected' : 'Disconnected')}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <Users className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm">
              {chatType === 'global' 
                ? 'Welcome! Start chatting with the community!' 
                : 'No messages yet. Start the conversation!'
              }
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.user_id === currentUser.id;
            const displayName = getDisplayName(message.users);
            
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                    isOwnMessage
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {!isOwnMessage && (
                    <p className="text-xs font-medium text-gray-600 mb-1">
                      {displayName}
                    </p>
                  )}
                  <p className="text-sm break-words">{message.message}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message ${chatType === 'global' ? 'everyone' : 'lobby'}...`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={500}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          🎮 Gaming Chat Platform
        </h1>
        
        {/* User Profile Section */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Your Profile</h3>
          <NicknameEditor
            currentUser={currentUser}
            onSave={handleNicknameUpdate}
            useMockData={useMockData}
          />
        </div>

        {/* Mock Data Toggle */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={useMockData}
              onChange={(e) => setUseMockData(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-blue-800">
              Use Mock Data (disable to connect to real Supabase)
            </span>
          </label>
        </div>
        
        {/* Chat Type Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Chat:
          </label>
          <div className="flex space-x-4">
            <button
              onClick={() => setSelectedChat({ type: 'global' })}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                selectedChat.type === 'global'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>Global Chat</span>
            </button>
            <button
              onClick={() => setSelectedChat({ type: 'lobby', lobbyId: 1 })}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                selectedChat.type === 'lobby'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              <span>Lobby Chat</span>
            </button>
          </div>
        </div>

        {/* Chat Component */}
        <RealtimeChat
          chatType={selectedChat.type}
          lobbyId={selectedChat.lobbyId}
          currentUser={currentUser}
          onUserUpdate={handleUserUpdate}
          useMockData={useMockData}
        />
      </div>




    </div>
  );
};

export default ChatExample;