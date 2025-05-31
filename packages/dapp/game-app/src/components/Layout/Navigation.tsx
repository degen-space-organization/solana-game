// src/components/Layout/Navigation.tsx
import React from 'react';
import {
  Box,
  Container,
  HStack,
  VStack,
  Button,
  Drawer,
  IconButton,
  Heading,
  useBreakpointValue,
} from "@chakra-ui/react";
import { X } from 'lucide-react';
import type { SectionType } from '../../App';

interface NavigationProps {
  activeSection: SectionType;
  onSectionChange: (section: SectionType) => void;
  isMobile: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

const navigationItems: Array<{
  key: SectionType;
  label: string;
  emoji: string;
}> = [
  { key: 'mygame', label: 'Current Game', emoji: '🎮' },
  { key: 'lobbies', label: 'Search games', emoji: '🎯' },
  { key: 'joined_lobbies', label: 'My Lobby', emoji: '🤝' },
  { key: 'spectate', label: 'Spectate Game', emoji: '👁️' },
  { key: 'leaderboard', label: 'Leaderboard', emoji: '👑' },
];

const NavigationButton: React.FC<{
  item: typeof navigationItems[0];
  isActive: boolean;
  onClick: () => void;
  isMobile?: boolean;
}> = ({ item, isActive, onClick, isMobile = false }) => (
  <Button
    onClick={onClick}
    bg={isActive ? "bg.default" : "transparent"}
    color={isActive ? "fg.default" : "fg.default"}
    fontWeight="bold"
    fontSize={isMobile ? "md" : "sm"}
    px={isMobile ? 4 : 6}
    py={isMobile ? 3 : 2}
    borderRadius="sm"
    border="2px solid"
    borderColor={isActive ? "border.default" : "transparent"}
    shadow={isActive ? "brutalist.sm" : "none"}
    _hover={{
      bg: isActive ? "bg.subtle" : "violet.300",
      borderColor: "border.default",
      transform: "translate(-1px, -1px)",
      shadow: "brutalist.sm",
    }}
    _active={{
      transform: "translate(0px, 0px)",
      shadow: "brutalist.sm",
    }}
    transition="all 0.1s ease"
    textTransform="uppercase"
    letterSpacing="wide"
    w={isMobile ? "100%" : "auto"}
  >
    {item.emoji} {item.label}
  </Button>
);

const Navigation: React.FC<NavigationProps> = ({
  activeSection,
  onSectionChange,
  isMobile,
  isOpen,
  onToggle
}) => {
  if (isMobile) {
    return (
      <Drawer.Root
        open={isOpen}
        onOpenChange={(details) => !details.open && onToggle()}
        size="md"
        placement="end"
      >
        <Drawer.Backdrop bg="rgba(0,0,0,0.5)" />
        <Drawer.Positioner>
          <Drawer.Content
            bg="bg.default"
            border="4px solid"
            borderColor="border.default"
            borderRadius="none"
            shadow="brutalist.xl"
            h="100vh"
            w="320px"
          >
            <Drawer.Header
              p={4}
              borderBottom="4px solid"
              borderColor="border.default"
              bg="primary.solid"
              color="primary.contrast"
            >
              <HStack justify="space-between">
                <Heading 
                  size="md" 
                  fontWeight="black" 
                  textTransform="uppercase" 
                  letterSpacing="wider"
                >
                  Navigation
                </Heading>
                <Drawer.CloseTrigger asChild>
                  <IconButton
                    bg="transparent"
                    color="primary.contrast"
                    _hover={{ bg: "primary.muted" }}
                    _active={{ bg: "primary.subtle" }}
                    border="2px solid"
                    borderColor="primary.contrast"
                    borderRadius="none"
                    shadow="brutalist.sm"
                  >
                    <X size={20} />
                  </IconButton>
                </Drawer.CloseTrigger>
              </HStack>
            </Drawer.Header>

            <Drawer.Body p={4}>
              <VStack padding={3} align="stretch">
                {navigationItems.map((item) => (
                  <NavigationButton
                    key={item.key}
                    item={item}
                    isActive={activeSection === item.key}
                    onClick={() => onSectionChange(item.key)}
                    isMobile={true}
                  />
                ))}
              </VStack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    );
  }

  return (
    <Box
      bg="violet.500"
      color="primary.contrast"
      py={4}
      borderBottom="2px solid"
      borderColor="border.default"
      shadow="brutalist.sm"
    >
      <Container maxW="100%">
        <HStack padding={2} justify="center" wrap="wrap">
          {navigationItems.map((item) => (
            <NavigationButton
              key={item.key}
              item={item}
              isActive={activeSection === item.key}
              onClick={() => onSectionChange(item.key)}
              isMobile={false}
            />
          ))}
        </HStack>
      </Container>
    </Box>
  );
};

export default Navigation;