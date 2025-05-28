// packages/dapp/game-app/src/components/Spectate/MatchInfo.tsx
import React from 'react';
import {
  Box,
  Card,
  Text,
  Heading,
  HStack,
  VStack,
  Flex,
  Badge,
  Avatar,
} from '@chakra-ui/react';
import { Trophy, Clock, Coins, Users } from 'lucide-react';
import type { GameData } from '@/supabase/Database/game';

interface MatchInfoProps {
  matchData: GameData;
  player1Score: number;
  player2Score: number;
}

const MatchInfo: React.FC<MatchInfoProps> = ({
  matchData,
  player1Score,
  player2Score,
}) => {
  const { match, participants, tournament } = matchData;
  
  const player1 = participants.find(p => p.position === 1);
  const player2 = participants.find(p => p.position === 2);
  
  const getDisplayName = (user: any): string => {
    return user?.nickname || `${user?.solana_address?.slice(0, 4)}...${user?.solana_address?.slice(-4)}` || 'Unknown';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'waiting': return '#FF6B35';
      case 'in_progress': return '#06D6A0';
      case 'completed': return '#7B2CBF';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'waiting': return 'WAITING TO START';
      case 'in_progress': return 'IN PROGRESS';
      case 'completed': return 'COMPLETED';
      default: return status.toUpperCase();
    }
  };

  const formatSolAmount = (lamports: string): string => {
    return (parseInt(lamports) / 1e9).toFixed(2);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card.Root
      borderWidth="4px"
      borderStyle="solid"
      borderColor="gray.900"
      bg="white"
      shadow="8px 8px 0px rgba(0,0,0,0.8)"
      borderRadius="0"
      p="6"
      mb="6"
      transform="rotate(0.5deg)"
      _hover={{
        transform: "rotate(0deg) scale(1.01)",
        shadow: "12px 12px 0px rgba(0,0,0,0.8)",
      }}
      transition="all 0.2s ease"
    >
      <Card.Body p="0">
        <VStack gap="6" align="stretch">
          {/* Header */}
          <HStack justify="space-between" align="center">
            <HStack gap="3" align="center">
              <Trophy size={28} color="#7B2CBF" />
              <Heading 
                size="lg" 
                fontWeight="black" 
                color="gray.900" 
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Match #{match.id}
              </Heading>
            </HStack>
            
            <Badge
              bg={getStatusColor(match.status || 'waiting')}
              color="white"
              fontSize="sm"
              fontWeight="black"
              px="3"
              py="1"
              borderRadius="0"
              border="2px solid"
              borderColor="gray.900"
              shadow="2px 2px 0px rgba(0,0,0,0.8)"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              {getStatusText(match.status || 'waiting')}
            </Badge>
          </HStack>

          {/* Tournament Info */}
          {tournament && (
            <Box
              bg="purple.50"
              border="3px solid"
              borderColor="purple.500"
              borderRadius="0"
              p="4"
              shadow="3px 3px 0px rgba(123,44,191,0.3)"
            >
              <HStack gap="2" align="center">
                <Users size={20} color="#7B2CBF" />
                <Text color="purple.700" fontWeight="bold">
                  Tournament: {tournament.name}
                </Text>
              </HStack>
            </Box>
          )}

          {/* Players vs Players */}
          <Box
            bg="gray.50"
            border="3px solid"
            borderColor="gray.900"
            borderRadius="0"
            p="6"
            shadow="4px 4px 0px rgba(0,0,0,0.8)"
          >
            <Flex align="center" justify="space-between">
              {/* Player 1 */}
              <VStack gap="3" align="center" flex="1">
                <Avatar.Root size="lg" border="3px solid black">
                  <Avatar.Fallback 
                    bg="#FF6B35" 
                    color="white" 
                    fontSize="lg" 
                    fontWeight="black"
                  >
                    {getDisplayName(player1?.users).charAt(0).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                
                <VStack gap="1" align="center">
                  <Text 
                    fontSize="lg" 
                    fontWeight="black" 
                    color="gray.900"
                    textAlign="center"
                  >
                    {getDisplayName(player1?.users)}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {player1?.users?.matches_won || 0}W - {player1?.users?.matches_lost || 0}L
                  </Text>
                </VStack>
              </VStack>

              {/* VS and Score */}
              <VStack gap="2" align="center" px="6">
                <Box
                  bg="#118AB2"
                  color="white"
                  px="4"
                  py="2"
                  border="3px solid"
                  borderColor="gray.900"
                  borderRadius="0"
                  shadow="3px 3px 0px rgba(0,0,0,0.8)"
                  transform="rotate(-2deg)"
                >
                  <Text 
                    fontSize="xl" 
                    fontWeight="black" 
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    VS
                  </Text>
                </Box>
                
                <HStack gap="2" align="center">
                  <Box
                    bg={player1Score > player2Score ? "#06D6A0" : "#FF6B35"}
                    color="white"
                    w="12"
                    h="12"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    border="3px solid"
                    borderColor="gray.900"
                    borderRadius="0"
                    shadow="3px 3px 0px rgba(0,0,0,0.8)"
                  >
                    <Text fontSize="xl" fontWeight="black">
                      {player1Score}
                    </Text>
                  </Box>
                  
                  <Text fontSize="lg" fontWeight="black" color="gray.700">
                    -
                  </Text>
                  
                  <Box
                    bg={player2Score > player1Score ? "#06D6A0" : "#FF6B35"}
                    color="white"
                    w="12"
                    h="12"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    border="3px solid"
                    borderColor="gray.900"
                    borderRadius="0"
                    shadow="3px 3px 0px rgba(0,0,0,0.8)"
                  >
                    <Text fontSize="xl" fontWeight="black">
                      {player2Score}
                    </Text>
                  </Box>
                </HStack>
              </VStack>

              {/* Player 2 */}
              <VStack gap="3" align="center" flex="1">
                <Avatar.Root size="lg" border="3px solid black">
                  <Avatar.Fallback 
                    bg="#06D6A0" 
                    color="white" 
                    fontSize="lg" 
                    fontWeight="black"
                  >
                    {getDisplayName(player2?.users).charAt(0).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                
                <VStack gap="1" align="center">
                  <Text 
                    fontSize="lg" 
                    fontWeight="black" 
                    color="gray.900"
                    textAlign="center"
                  >
                    {getDisplayName(player2?.users)}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {player2?.users?.matches_won || 0}W - {player2?.users?.matches_lost || 0}L
                  </Text>
                </VStack>
              </VStack>
            </Flex>
          </Box>

          {/* Match Details */}
          <HStack gap="4" wrap="wrap">
            <HStack gap="2" align="center">
              <Coins size={20} color="#7B2CBF" />
              <Text fontSize="sm" fontWeight="bold" color="gray.700">
                Stake: {formatSolAmount(match.stake_amount)} ◎
              </Text>
            </HStack>
            
            <HStack gap="2" align="center">
              <Trophy size={20} color="#06D6A0" />
              <Text fontSize="sm" fontWeight="bold" color="gray.700">
                Prize: {formatSolAmount(match.total_prize_pool)} ◎
              </Text>
            </HStack>
            
            {match.started_at && (
              <HStack gap="2" align="center">
                <Clock size={20} color="#FF6B35" />
                <Text fontSize="sm" fontWeight="bold" color="gray.700">
                  Started: {formatDate(match.started_at)}
                </Text>
              </HStack>
            )}
          </HStack>

          {/* Winner Display */}
          {match.status === 'completed' && match.winner_id && (
            <Box
              bg="#06D6A0"
              color="white"
              p="4"
              border="3px solid"
              borderColor="gray.900"
              borderRadius="0"
              shadow="4px 4px 0px rgba(0,0,0,0.8)"
              textAlign="center"
              transform="rotate(-1deg)"
            >
              <Text fontSize="xl" fontWeight="black" textTransform="uppercase" letterSpacing="wider">
                🏆 Winner: {getDisplayName(
                  participants.find(p => p.user_id === match.winner_id)?.users
                )} 🏆
              </Text>
            </Box>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

export default MatchInfo;