import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Input,
  HStack,
  VStack,
  Text,
  Heading,
  Spinner,
} from '@chakra-ui/react';
import { Search, Eye } from 'lucide-react';

interface MatchSearchProps {
  onMatchSearch: (matchId: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const MatchSearch: React.FC<MatchSearchProps> = ({
  onMatchSearch,
  isLoading,
  error,
}) => {
  const [matchId, setMatchId] = useState<string>('');

  const handleSearch = async () => {
    const id = parseInt(matchId);
    if (isNaN(id) || id <= 0) {
      return;
    }
    await onMatchSearch(id);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
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
      p="6"
      mb="6"
      transform="rotate(-0.5deg)"
      _hover={{
        transform: "rotate(0deg) scale(1.02)",
        shadow: "12px 12px 0px rgba(0,0,0,0.8)",
      }}
      transition="all 0.2s ease"
    >
      <Card.Body p="0">
        <VStack gap="4" align="stretch">
          <HStack gap="2" align="center">
            <Eye size={28} color="#FF6B35" />
            <Heading 
              size="lg" 
              fontWeight="black" 
              color="gray.900" 
              textTransform="uppercase"
              letterSpacing="wider"
            >
              🔍 Spectate Match
            </Heading>
          </HStack>
          
          <Text color="gray.600" fontSize="md">
            Enter a Match ID to watch the game unfold round by round
          </Text>

          <HStack gap="3">
            <Box flex="1">
              <Input
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter Match ID (e.g. 123)"
                borderWidth="3px"
                borderColor="gray.900"
                borderRadius="0"
                bg="white"
                color="gray.900"
                fontSize="lg"
                fontWeight="medium"
                px="4"
                py="3"
                _focus={{
                  borderColor: "#FF6B35",
                  boxShadow: "none",
                  transform: "translate(-1px, -1px)",
                  shadow: "3px 3px 0px rgba(0,0,0,0.8)",
                }}
                _placeholder={{ color: "gray.500" }}
                disabled={isLoading}
              />
            </Box>
            
            <Button
              onClick={handleSearch}
              disabled={!matchId.trim() || isLoading}
              bg="#FF6B35"
              color="white"
              fontWeight="black"
              fontSize="lg"
              px="6"
              py="3"
              borderRadius="0"
              border="3px solid"
              borderColor="gray.900"
              shadow="4px 4px 0px rgba(0,0,0,0.8)"
              _hover={!matchId.trim() || isLoading ? {} : {
                bg: "#E55A2B",
                transform: "translate(-2px, -2px)",
                shadow: "6px 6px 0px rgba(0,0,0,0.8)",
              }}
              _active={!matchId.trim() || isLoading ? {} : {
                transform: "translate(0px, 0px)",
                shadow: "2px 2px 0px rgba(0,0,0,0.8)",
              }}
              transition="all 0.1s ease"
              textTransform="uppercase"
              letterSpacing="wider"
              minW="120px"
            >
              {isLoading ? <Spinner size="sm" /> : (
                <HStack>
                  <Search size={20} />
                  <Text>Search</Text>
                </HStack>
              )}
            </Button>
          </HStack>

          {error && (
            <Box
              bg="red.50"
              border="3px solid"
              borderColor="red.500"
              borderRadius="0"
              p="4"
              shadow="3px 3px 0px rgba(220,38,38,0.3)"
            >
              <Text color="red.700" fontWeight="bold" fontSize="sm">
                ❌ {error}
              </Text>
            </Box>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

export default MatchSearch;