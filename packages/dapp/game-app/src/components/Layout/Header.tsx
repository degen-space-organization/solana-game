// src/components/Layout/Header.tsx
import React from 'react';
import {
  Box,
  Container,
  Flex,
  VStack,
  HStack,
  Heading,
  IconButton,
  Badge,
  Image,
  // useBreakpointValue,
} from "@chakra-ui/react";
import { Menu, MessageCircle } from 'lucide-react';
import { Link as ChakraLink } from '@chakra-ui/react';

import XLogo from '../../../public/x-logo.svg'; // Ensure this path is correct

import { ConnectWalletButton } from '../Wallet/WalletConnect';
import type { User } from '../../types/lobby';

type RankType = 'Unranked' | 'Bronze' | 'Silver' | 'Gold' | 'Legendary';

interface HeaderProps {
  currentUser: User | null;
  currentUserRank: RankType;
  isMobile?: boolean;
  onToggleNav?: () => void;
  onToggleChat?: () => void;
}

const getRankColorScheme = (rank: RankType): string => {
  switch (rank) {
    case 'Bronze': return 'orange';
    case 'Silver': return 'gray';
    case 'Gold': return 'yellow';
    case 'Legendary': return 'purple';
    default: return 'blue';
  }
};

const Header: React.FC<HeaderProps> = ({
  currentUser,
  currentUserRank,
  isMobile = false,
  onToggleNav,
  onToggleChat
}) => {
  // const headerLayout = useBreakpointValue({ 
  //   base: 'column', 
  //   md: 'row' 
  // });

  return (
    <Box
      bg="bg.default"
      // borderBottom="4px solid"
      borderColor="border.default"
      shadow="brutalist.md"
      position="sticky"
      top="0"
      zIndex="sticky"
    >
      <Container
        maxW="100%"
        p={4}
      // bg={'violet.300'}
      >
        {isMobile ? (
          <VStack spaceX={4} align="stretch">
            {/* Mobile: Top row with burger menu and chat toggle */}
            <Flex justify="space-between" align="center">
              <IconButton
                onClick={onToggleNav}
                bg="primary.solid"
                color="primary.contrast"
                border="brutalist"
                borderRadius="none"
                shadow="brutalist.sm"
                _hover={{
                  transform: "translate(-2px, -2px)",
                  shadow: "brutalist.md",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "brutalist.sm",
                }}
                transition="all 0.1s ease"
              >
                <Menu size={20} />
              </IconButton>

              <IconButton
                onClick={onToggleChat}
                bg="brutalist.blue"
                color="primary.contrast"
                border="brutalist"
                borderRadius="none"
                shadow="brutalist.sm"
                _hover={{
                  transform: "translate(-2px, -2px)",
                  shadow: "brutalist.md",
                }}
                _active={{
                  transform: "translate(0px, 0px)",
                  shadow: "brutalist.sm",
                }}
                transition="all 0.1s ease"
              >
                <MessageCircle size={20} />
              </IconButton>
            </Flex>

            {/* Mobile: Game title */}
            <Box
              h="60px"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Heading
                size="lg"
                fontWeight="black"
                color="fg.default"
                textTransform="uppercase"
                letterSpacing="tight"
                textAlign="center"
                textShadow="1px 1px 0px rgba(139, 92, 246, 0.3)"
              >
                Rock, Paper, Scissors Game
              </Heading>
            </Box>

            {/* Mobile: Wallet and rank */}
            <Flex justify="center" align="center" gap={3}>
              {currentUser && currentUserRank !== 'Unranked' && (
                <Badge
                  colorScheme={getRankColorScheme(currentUserRank)}
                  variant="solid"
                  px={3}
                  py={1}
                  borderRadius="none"
                  border="2px solid"
                  borderColor="border.default"
                  fontSize="sm"
                  fontWeight="bold"
                  textTransform="uppercase"
                  shadow="brutalist.sm"
                >
                  {currentUserRank}
                </Badge>
              )}
              <ConnectWalletButton />
            </Flex>
          </VStack>
        ) : (
          /* Desktop Layout */
          <Flex justify="space-between" align="center">
            <HStack align="center">

              {/* Left side - Game Title */}
              <Heading
                size="2xl"
                fontWeight="black"
                color="fg.default"
                textTransform="uppercase"
                letterSpacing="tight"
              // textShadow="3px 3px 0px rgba(139, 92, 246, 0.3)"
              >
                Rock, Paper, Scissors Game
              </Heading>

              {/* X (Twitter) neobrutalism box */}

            </HStack>


            {/* Right side - Rank and Wallet */}
            <HStack padding={1}>
              <ChakraLink
                href="https://x.com/PlayRPSGame"
                target="_blank"
                rel="noopener noreferrer"
                bg="black"
                border="3px solid"
                borderColor="border.default"
                borderRadius="md"
                px={3}
                py={2}
                mx={4}
                display="flex"
                alignItems="center"
                justifyContent="center"
                shadow="brutalist.md"
                transition="all 0.1s"
                _hover={{
                  transform: 'translate(-2px, -2px)',
                  shadow: 'brutalist.lg',
                  bg: 'gray.900',
                }}
                _active={{
                  transform: 'translate(0px, 0px)',
                  shadow: 'brutalist.md',
                }}
              >
                <Image
                  src={XLogo}
                  alt="X (Twitter) logo"
                  boxSize="28px"
                  display="block"
                />
              </ChakraLink>
              {/* {currentUser && currentUserRank !== 'Unranked' && (
                <Badge
                  colorScheme={getRankColorScheme(currentUserRank)}
                  variant="solid"
                  px={4}
                  py={2}
                  borderRadius="none"
                  border="3px solid"
                  borderColor="border.default"
                  fontSize="md"
                  fontWeight="bold"
                  textTransform="uppercase"
                  shadow="brutalist.md"
                >
                  {currentUserRank}
                </Badge>
              )} */}
              <ConnectWalletButton />
            </HStack>
          </Flex>
        )}
      </Container>
    </Box>
  );
};

export default Header;