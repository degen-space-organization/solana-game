import React from 'react';
import {
  Box,
  Text,
  VStack,
  Image,
} from '@chakra-ui/react';

type Move = 'rock' | 'paper' | 'scissors';

interface MoveDisplayProps {
  move: Move | null;
  playerName: string;
  isWinner?: boolean;
  showMove?: boolean; // For hiding moves until both players have moved
}

const MoveDisplay: React.FC<MoveDisplayProps> = ({
  move,
  playerName,
  isWinner = false,
  showMove = true,
}) => {
  const getMoveEmoji = (move: Move | null): string => {
    if (!move || !showMove) return '❓';
    switch (move) {
      case 'rock': return '🗿';
      case 'paper': return '📄';
      case 'scissors': return '✂️';
      default: return '❓';
    }
  };

  const getMoveGif = (move: Move | null): string => {
    if (!move || !showMove) 
      return '/gifs/waiting.gif'; 
    
    switch (move) {
      case 'rock': 
        return '/gifs/rock.gif';
      case 'paper': 
        return '/gifs/paper.gif';
      case 'scissors': 
        return '/gifs/scissors.gif';
      default: 
        return '/gifs/waiting.gif';
    }
  };

  const getMoveColor = (): string => {
    if (isWinner) 
        return '#06D6A0'; // Green for winner
    if (!showMove || !move) 
      return '#6B7280'; // Gray for hidden/no move
    return '#FF6B35'; // Orange for regular move
  };

  const getBorderColor = (): string => {
    if (isWinner) 
      return '#06D6A0';
    return '#000000';
  };

  return (
    <VStack
      gap="3"
      align="center"
      p="4"
      border="4px solid"
      borderColor={getBorderColor()}
      borderRadius="0"
      bg="white"
      shadow="6px 6px 0px rgba(0,0,0,0.8)"
      transform={isWinner ? "rotate(1deg)" : "rotate(-1deg)"}
      _hover={{
        transform: isWinner ? "rotate(0deg) scale(1.05)" : "rotate(0deg) scale(1.03)",
        shadow: "8px 8px 0px rgba(0,0,0,0.8)",
      }}
      transition="all 0.2s ease"
      minW="140px"
      position="relative"
    >
      {isWinner && (
        <Box
          position="absolute"
          top="-8px"
          right="-8px"
          bg="#06D6A0"
          color="white"
          borderRadius="50%"
          w="8"
          h="8"
          display="flex"
          alignItems="center"
          justifyContent="center"
          border="2px solid"
          borderColor="gray.900"
          fontSize="lg"
          fontWeight="black"
          zIndex="1"
        >
          👑
        </Box>
      )}
      
      <Text
        fontSize="xs"
        fontWeight="black"
        color="gray.700"
        textTransform="uppercase"
        letterSpacing="wider"
        textAlign="center"
      >
        {playerName}
      </Text>
      
      {/* GIF Display */}
      <Box
        w="20"
        h="20"
        bg="gray.100"
        border="3px solid"
        borderColor="gray.900"
        borderRadius="0"
        display="flex"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
        position="relative"
      >
        <Image
          src={getMoveGif(move)}
          alt={move || 'waiting'}
          w="full"
          h="full"
          objectFit="cover"
          fallback={
            <Text fontSize="3xl" lineHeight="1">
              {getMoveEmoji(move)}
            </Text>
          }
        />
      </Box>
      
      {/* Move Label */}
      <Box
        bg={getMoveColor()}
        color="white"
        px="3"
        py="1"
        border="2px solid"
        borderColor="gray.900"
        borderRadius="0"
        shadow="2px 2px 0px rgba(0,0,0,0.8)"
      >
        <Text
          fontSize="sm"
          fontWeight="black"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          {showMove && move ? move : '???'}
        </Text>
      </Box>
    </VStack>
  );
};

export default MoveDisplay;