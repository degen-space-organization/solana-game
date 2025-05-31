import { useState } from 'react';
import { Box, Button, VStack, HStack, Image, Text, Card, Grid, Badge } from '@chakra-ui/react';
import { Zap, CheckCircle, Clock } from 'lucide-react';

type MoveOption = 'rock' | 'paper' | 'scissors';
interface Move {
    name: MoveOption;
    icon: string;
    emoji: string;
    description: string;
}

// Move options with emojis as fallbacks
const moveOptions: Move[] = [
    {
        name: 'rock',
        icon: '/gifs/rock.gif',
        emoji: '🗿',
        description: 'Crushes Scissors'
    },
    {
        name: 'paper',
        icon: '/gifs/paper.gif',
        emoji: '📄',
        description: 'Covers Rock'
    },
    {
        name: 'scissors',
        icon: '/gifs/scissors.gif',
        emoji: '✂️',
        description: 'Cuts Paper'
    },
];

export default function ChooseMove({
    userId,
    matchId,
    gameRoundNumber
}: {
    userId: number;
    matchId: number;
    gameRoundNumber: number;
}) {
    const [loading, setLoading] = useState<boolean>(false);
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [selectedMove, setSelectedMove] = useState<MoveOption | null>(null);
    const [definiteMove, setDefiniteMove] = useState<Move | null>(null);
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

    const handleSelectMove = (move: MoveOption) => {
        if (!isSubmitted && !loading) {
            setSelectedMove(move);
        }
    };

    const handleSubmitMove = async () => {
        if (selectedMove) {
            setLoading(true);
            try {
                const response = await fetch('http://localhost:4000/api/v1/game/submit-move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        match_id: matchId,
                        user_id: userId,
                        round_number: gameRoundNumber,
                        player_move: selectedMove,
                    }),
                });
                if (!response.ok) {
                    throw new Error('Failed to submit move');
                }
                setIsSubmitted(true);
                setDefiniteMove(moveOptions.find(m => m.name === selectedMove) || null);
            } catch (e) {
                console.error('Failed to submit move:', e);
                // Reset loading state on error so user can retry
                setLoading(false);
            }
        }
    };

    const handleImageError = (moveName: string) => {
        setImageErrors(prev => ({ ...prev, [moveName]: true }));
    };

    const getMoveCardStyle = (move: Move) => {
        const isSelected = selectedMove === move.name;
        const isDefinite = definiteMove?.name === move.name;
        const isDisabled = isSubmitted && !isDefinite;

        if (isDisabled) {
            return {
                bg: 'bg.muted',
                borderColor: 'border.subtle',
                opacity: 0.5,
                cursor: 'not-allowed',
                transform: 'none',
                _hover: {}
            };
        }

        if (isSelected || isDefinite) {
            return {
                bg: 'brutalist.green',
                borderColor: 'brutalist.green',
                opacity: 1,
                cursor: isSubmitted ? 'default' : 'pointer',
                transform: 'scale(1.05)',
                _hover: {
                    transform: 'scale(1.05)',
                    shadow: '12px 12px 0px rgba(0,0,0,0.8)',
                }
            };
        }

        return {
            bg: 'bg.default',
            borderColor: 'border.default',
            opacity: 1,
            cursor: 'pointer',
            transform: 'none',
            _hover: {
                bg: 'primary.subtle',
                borderColor: 'primary.emphasis',
                transform: 'scale(1.02)',
                shadow: '12px 12px 0px rgba(0,0,0,0.8)',
            }
        };
    };

    return (
        <Card.Root
            border={'none'}
            maxW={{ base: "100%", md: "600px" }}
            mx="auto"
            overflow="hidden"
        >
            <Card.Body p={{ base: "4", md: "6" }}>
                <VStack gap="6" align="stretch">
                    {/* Header */}

                    {/* Move Options */}
                    <Grid
                        templateColumns={{ base: "repeat(3, 1fr)", md: "repeat(3, 1fr)" }}
                        gap={{ base: "3", md: "4" }}
                        w="100%"
                    >
                        {moveOptions.map((move) => {
                            const cardStyle = getMoveCardStyle(move);
                            const isSelected = selectedMove === move.name;
                            const isDefinite = definiteMove?.name === move.name;
                            const hasImageError = imageErrors[move.name];

                            return (
                                <Box
                                    key={move.name}
                                    onClick={() => handleSelectMove(move.name)}
                                    {...cardStyle}
                                    border="2px solid"
                                    borderRadius="0"
                                    // shadow="8px 8px 0px rgba(0,0,0,0.8)"
                                    p={{ base: "3", md: "4" }}
                                    transition="all 0.2s ease"
                                    position="relative"
                                >
                                    <VStack gap="3" align="center">
                                        {/* Image/Emoji Display */}
                                        <Box
                                            w={{ base: "60px", md: "80px" }}
                                            h={{ base: "60px", md: "80px" }}
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="center"
                                            bg="bg.subtle"
                                            border="2px solid"
                                            borderColor="border.subtle"
                                            borderRadius="0"
                                        >
                                            {!hasImageError ? (
                                                <Image
                                                    src={move.icon}
                                                    alt={move.name}
                                                    w="100%"
                                                    h="100%"
                                                    objectFit="cover"
                                                    onError={() => handleImageError(move.name)}
                                                />
                                            ) : (
                                                <Text fontSize={{ base: "2xl", md: "3xl" }}>
                                                    {move.emoji}
                                                </Text>
                                            )}
                                        </Box>

                                        {/* Move Name */}
                                        <VStack gap="1" align="center">
                                            <Text
                                                fontSize={{ base: "sm", md: "md" }}
                                                fontWeight="black"
                                                color={isSelected || isDefinite ? "fg.inverted" : "fg.default"}
                                                textTransform="uppercase"
                                                letterSpacing="wider"
                                                textAlign="center"
                                            >
                                                {move.name}
                                            </Text>
                                        </VStack>

                                        {/* Selection Indicator */}
                                        {(isSelected || isDefinite) && (
                                            <Badge
                                                bg="fg.inverted"
                                                color="brutalist.green"
                                                fontSize="xs"
                                                fontWeight="black"
                                                px="2"
                                                py="1"
                                                borderRadius="0"
                                                border="2px solid"
                                                borderColor="fg.inverted"
                                                textTransform="uppercase"
                                                position="absolute"
                                                top="2"
                                                right="2"
                                            >
                                                {isDefinite ? <CheckCircle size={12} /> : "✓"}
                                            </Badge>
                                        )}
                                    </VStack>
                                </Box>
                            );
                        })}
                    </Grid>

                    {/* Submit Button */}
                    <Box w="100%">
                        <Button
                            onClick={handleSubmitMove}
                            disabled={!selectedMove || isSubmitted || loading}
                            w="100%"
                            size="lg"
                            bg={
                                !selectedMove || isSubmitted || loading
                                    ? 'bg.muted'
                                    : 'primary.emphasis'
                            }
                            color={
                                !selectedMove || isSubmitted || loading
                                    ? 'fg.muted'
                                    : 'fg.inverted'
                            }
                            border="2px solid"
                            borderColor='brutalist.black'
                            borderRadius="2"
                            // shadow="8px 8px 0px rgba(0,0,0,0.8)"
                            fontWeight="black"
                            fontSize={{ base: "md", md: "lg" }}
                            textTransform="uppercase"
                            letterSpacing="wider"
                            cursor={
                                !selectedMove || isSubmitted || loading
                                    ? 'not-allowed'
                                    : 'pointer'
                            }
                            _hover={
                                (!isSubmitted && !loading && selectedMove) ? {
                                    bg: 'primary.muted',
                                    transform: 'translateY(-2px)',
                                    shadow: '8px 10px 0px rgba(0,0,0,0.8)',
                                } : {}
                            }
                            _active={
                                (!isSubmitted && !loading && selectedMove) ? {
                                    transform: 'translateY(0px)',
                                    shadow: '8px 8px 0px rgba(0,0,0,0.8)',
                                } : {}
                            }
                            transition="all 0.1s ease"
                            py="6"
                        >
                            {loading ? (
                                <HStack gap="2">
                                    <Clock size={20} />
                                    <Text>Submitting Move...</Text>
                                </HStack>
                            ) : isSubmitted ? (
                                <HStack gap="2">
                                    <CheckCircle size={20} />
                                    <Text>Move Submitted!</Text>
                                </HStack>
                            ) : selectedMove ? (
                                <Text>Submit {selectedMove.toUpperCase()}</Text>
                            ) : (
                                <Text>Select a Move First</Text>
                            )}
                        </Button>
                    </Box>

                    {/* Status Message */}
                    {isSubmitted && (
                        <Box
                            bg="primary.subtle"
                            border="2px solid"
                            borderColor="primary.emphasis"
                            borderRadius="0"
                            p="4"
                            textAlign="center"
                        >
                            <VStack gap="2">
                                <HStack gap="2" justify="center">
                                    <Clock size={16} color="var(--chakra-colors-primary-emphasis)" />
                                    <Text
                                        fontSize="sm"
                                        fontWeight="bold"
                                        color="primary.emphasis"
                                        textTransform="uppercase"
                                        letterSpacing="wider"
                                    >
                                        Waiting for Opponent
                                    </Text>
                                </HStack>
                                <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                                    Your move has been locked in. Good luck!
                                </Text>
                            </VStack>
                        </Box>
                    )}
                </VStack>
            </Card.Body>
        </Card.Root>
    );
}