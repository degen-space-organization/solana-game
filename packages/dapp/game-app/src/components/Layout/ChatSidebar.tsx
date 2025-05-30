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
    <>
      {isMobile && (
        <IconButton
          onClick={onClose}
          bg="transparent"
          color="primary.contrast"
          _hover={{ bg: "bg.muted" }}
          _active={{ bg: "bg.subtle" }}
          border="2px solid"
          borderColor="border.subtle"
          borderRadius="none"
          shadow="brutalist.sm"
        >
          <X size={20} />
        </IconButton>
      )}

      {/* Chat Content */}
      <Box flex="1" overflow="hidden">
        <GlobalChatWrapper />
      </Box>
    </>
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
      // border="4px solid"
      borderColor="border.default"
      borderRadius="none"
      shadow="brutalist.lg"
      h="100%"
      display="flex"
      flexDirection="column"
      position="sticky"
      top="0"
    >
      {chatContent}
    </Box>
  );
};

export default ChatSidebar;