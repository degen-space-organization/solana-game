import { useState } from 'react';
import { Box, Button, Flex, Image, Text } from '@chakra-ui/react';

type MoveOption = 'rock' | 'paper' | 'scissors';
interface Move {
    name: MoveOption
    icon: string;
}

// Example GIFs (replace with your actual GIF URLs or imports)
const moveOptions: Move[] = [
    { name: 'rock', icon: '/gifs/rock.gif' },
    { name: 'paper', icon: '/gifs/paper.gif' },
    { name: 'scissors', icon: '/gifs/scissors.gif' },
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

    const handleSelectMove = (move: MoveOption) => {
        if (!isSubmitted && !loading) {
            setSelectedMove(move);
        }
    };

    const handleSubmitMove = async () => {
        if (selectedMove) {
            setLoading(true);
            try {
                // Replace with your actual API endpoint and payload
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
            } finally {
                setLoading(false);
            }
        } else {
            console.error('No move selected');
        }
    };

    const getOptionStyle = (move: Move) => {
        const isSelected = selectedMove === move.name;
        const isDefinite = definiteMove?.name === move.name;
        const isGreyed = isSubmitted && !isDefinite;
        return {
            border: '4px solid #222',
            borderRadius: '0',
            background: isSelected || isDefinite ? '#06D6A0' : '#F3E8FF',
            boxShadow: '8px 8px 0px rgba(0,0,0,0.8)',
            opacity: isGreyed ? 0.4 : 1,
            cursor: isSubmitted ? 'default' : 'pointer',
            m: 4,
            w: '96px',
            h: '96px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.1s',
            outline: isSelected ? '4px solid #FF6B35' : 'none',
        };
    };

    return (
        <Flex direction="column" align="center" gap={8}>
            <Flex direction="row" justify="center" mb={8}>
                {moveOptions.map((move) => (
                    <Box
                        key={move.name}
                        {...getOptionStyle(move)}
                        onClick={() => handleSelectMove(move.name)}
                    >
                        <Image
                            src={move.icon}
                            alt={move.name}
                            w="64px"
                            h="64px"
                            pointerEvents="none"
                        />
                    </Box>
                ))}
            </Flex>
            <Button
                onClick={handleSubmitMove}
                disabled={!selectedMove || isSubmitted || loading}
                fontWeight="bold"
                fontSize="20px"
                px={8}
                py={4}
                borderRadius="0"
                border="4px solid #222"
                boxShadow="8px 8px 0px rgba(0,0,0,0.8)"
                bg={!selectedMove || isSubmitted || loading ? '#ccc' : '#FF6B35'}
                color="white"
                cursor={!selectedMove || isSubmitted || loading ? 'not-allowed' : 'pointer'}
                letterSpacing="2px"
                textTransform="uppercase"
                transition="all 0.1s"
                _hover={(!isSubmitted && !loading && selectedMove) ? { bg: '#E55A2B' } : {}}
            >
                {isSubmitted ? 'Move Submitted!' : loading ? 'Submitting...' : 'Submit Move'}
            </Button>
            {isSubmitted && (
                <Text mt={4} color="#7B2CBF" fontWeight="bold" fontSize="lg">
                    Waiting for opponent...
                </Text>
            )}
        </Flex>
    );
}