// src/components/Layout/ChatSidebar.tsx
import React from 'react';
import {
  Box,
  HStack,
  Heading,
  IconButton,
  Drawer,
} from "@chakra-ui/react";
import { MessageCircle, X } from 'lucide-react';

import GlobalChatWrapper from '../Chat/GlobalChat';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  onClose,
  isMobile
}) => {
  const chatContent = (
    <Box
      h="100%"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {isMobile && (
        <Box
          p={4}
          borderBottom="4px solid"
          borderColor="border.default"
          bg="bg.subtle"
          flexShrink={0}
        >
          <HStack justify="space-between" align="center">
            <HStack>
              <MessageCircle size={24} color="#118AB2" />
              <Heading
                size="md"
                fontWeight="black"
                color="fg.default"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Chat
              </Heading>
            </HStack>
            <IconButton
              onClick={onClose}
              bg="error"
              color="fg.inverted"
              _hover={{ 
                bg: "red.600",
                transform: "translate(-1px, -1px)",
                shadow: "brutalist.md",
              }}
              _active={{ 
                bg: "red.700",
                transform: "translate(0px, 0px)",
                shadow: "brutalist.sm",
              }}
              border="2px solid"
              borderColor="border.default"
              borderRadius="none"
              shadow="brutalist.sm"
              size="sm"
            >
              <X size={20} />
            </IconButton>
          </HStack>
        </Box>
      )}

      {/* Chat Content - Takes remaining space */}
      <Box flex="1" overflow="hidden" minH="0">
        <GlobalChatWrapper />
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer.Root
        open={isOpen}
        onOpenChange={(details) => !details.open && onClose()}
        size="lg"
        placement="start"
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
            w="350px"
            display="flex"
            flexDirection="column"
            overflow="hidden"
          >
            {chatContent}
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    );
  }

  // Desktop: Always visible sidebar
  return (
    <Box
      bg="bg.default"
      borderColor="border.default"
      borderRadius="none"
      shadow="brutalist.lg"
      h="100%"
      display="flex"
      flexDirection="column"
      overflow="hidden"
      position="relative"
    >
      {chatContent}
    </Box>
  );
};

export default ChatSidebar;