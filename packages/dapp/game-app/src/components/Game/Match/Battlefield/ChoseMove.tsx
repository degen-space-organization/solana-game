import { useState, useEffect } from 'react';
import { Box, Button, VStack, HStack, Image, Text, Card, Grid, Badge } from '@chakra-ui/react';
import { Zap, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/supabase';
import apiUrl from '@/api/config';

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
    const [isInitialized, setIsInitialized] = useState<boolean>(false);

    // Check if user has already submitted a move for this round
    useEffect(() => {
        const checkExistingMove = async () => {
            try {
                // Get the current round data
                const { data: roundData, error } = await supabase
                    .from('game_rounds')
                    .select('*')
                    .eq('match_id', matchId)
                    .eq('round_number', gameRoundNumber)
                    .single();

                if (error) {
                    console.error('Error fetching round data:', error);
                    setIsInitialized(true);
                    return;
                }

                if (roundData) {
                    // Get match participants to determine if this user is player 1 or 2
                    const { data: participants, error: participantsError } = await supabase
                        .from('match_participants')
                        .select('user_id, position')
                        .eq('match_id', matchId);

                    if (participantsError) {
                        console.error('Error fetching participants:', participantsError);
                        setIsInitialized(true);
                        return;
                    }

                    // Find user's position
                    const userParticipant = participants?.find(p => p.user_id === userId);
                    if (!userParticipant) {
                        console.error('User not found in match participants');
                        setIsInitialized(true);
                        return;
                    }

                    // Check if user has already submitted a move
                    let userMove: MoveOption | null = null;
                    if (userParticipant.position === 1 && roundData.player1_move) {
                        userMove = roundData.player1_move as MoveOption;
                    } else if (userParticipant.position === 2 && roundData.player2_move) {
                        userMove = roundData.player2_move as MoveOption;
                    }

                    // If user has already submitted a move, set the state
                    if (userMove) {
                        const moveObj = moveOptions.find(m => m.name === userMove);
                        setSelectedMove(userMove);
                        setDefiniteMove(moveObj || null);
                        setIsSubmitted(true);
                    }
                }
            } catch (error) {
                console.error('Error checking existing move:', error);
            } finally {
                setIsInitialized(true);
            }
        };

        if (userId && matchId && gameRoundNumber) {
            checkExistingMove();
        }
    }, [userId, matchId, gameRoundNumber]);

    const handleSelectMove = (move: MoveOption) => {
        if (!isSubmitted && !loading && isInitialized) {
            setSelectedMove(move);
        }
    };

    const handleSubmitMove = async () => {
        if (selectedMove && !isSubmitted) {
            setLoading(true);
            try {
                const response = await fetch(`${apiUrl}/game/submit-move`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        match_id: matchId,
                        user_id: userId,
                        round_number: gameRoundNumber,
                        player_move: selectedMove,
                    }),
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    // Check if the error is because move was already submitted
                    if (data.error && data.error.includes('already made a move')) {
                        // Move was already submitted, update state accordingly
                        setIsSubmitted(true);
                        setDefiniteMove(moveOptions.find(m => m.name === selectedMove) || null);
                    } else {
                        throw new Error(data.error || 'Failed to submit move');
                    }
                } else {
                    // Success
                    setIsSubmitted(true);
                    setDefiniteMove(moveOptions.find(m => m.name === selectedMove) || null);
                }
            } catch (e) {
                console.error('Failed to submit move:', e);
                // Reset loading state on error so user can retry
                setLoading(false);
            } finally {
                if (loading) setLoading(false);
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
            cursor: isInitialized ? 'pointer' : 'default',
            transform: 'none',
            _hover: isInitialized ? {
                bg: 'primary.subtle',
                borderColor: 'primary.emphasis',
                transform: 'scale(1.02)',
                shadow: '12px 12px 0px rgba(0,0,0,0.8)',
            } : {}
        };
    };

    // Show loading state while checking existing move
    if (!isInitialized) {
        return (
            <Card.Root
                border={'none'}
                maxW={{ base: "100%", md: "600px" }}
                mx="auto"
                overflow="hidden"
            >
                <Card.Body p={{ base: "4", md: "6" }}>
                    <VStack gap="6" align="center" justify="center" minH="200px">
                        <Clock size={32} color="var(--chakra-colors-primary-emphasis)" />
                        <Text fontSize="lg" fontWeight="bold" color="fg.muted">
                            Loading round data...
                        </Text>
                    </VStack>
                </Card.Body>
            </Card.Root>
        );
    }

    return (
        <Card.Root
            border={'none'}
            maxW={{ base: "100%", md: "600px" }}
            mx="auto"
            overflow="hidden"
        >
            <Card.Body p={{ base: "4", md: "6" }}>
                <VStack gap="6" align="stretch">
                    {/* Header - Show round info */}
                    <Box textAlign="center">
                        <Text fontSize="lg" fontWeight="black" color="fg.default" textTransform="uppercase">
                            Round {gameRoundNumber}
                        </Text>
                        {isSubmitted && (
                            <Text fontSize="sm" color="primary.emphasis" fontWeight="bold" mt={1}>
                                Move Locked In
                            </Text>
                        )}
                    </Box>

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
                                    Your {definiteMove?.name.toUpperCase()} has been locked in. Good luck!
                                </Text>
                            </VStack>
                        </Box>
                    )}
                </VStack>
            </Card.Body>
        </Card.Root>
    );
}