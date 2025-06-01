import { useEffect, useState, useRef } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { database } from "@/supabase/Database";

export default function Timer({
    gameId
}: {
    gameId: number
}) {
    const [remaining, setRemaining] = useState<number>(30);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        async function fetchStartTime() {
            try {
                const gameData = await database.games.getGameRoundById(gameId);
                if (!gameData || !gameData.created_at) {
                    if (isMounted) {
                        setRemaining(0);
                        setLoading(false);
                    }
                    return;
                }

                // Get server time in UTC and current time in UTC
                // const serverTimeUTC = new Date(gameData.created_at as string).getTime();
                const rawTimestamp = gameData.created_at as string;
                const utcTimestamp = rawTimestamp.endsWith('Z') ? rawTimestamp : rawTimestamp + 'Z';
                const serverTimeUTC = new Date(utcTimestamp).getTime();
                const currentTimeUTC = Date.now();
                const elapsedSeconds = Math.floor((currentTimeUTC - serverTimeUTC) / 1000);
                const remainingSeconds = Math.max(30 - elapsedSeconds, 0);


                if (isMounted) {
                    setRemaining(remainingSeconds);
                    setLoading(false);
                }

                // Clear any existing interval
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }

                // Start countdown if there's time remaining
                if (remainingSeconds > 0) {
                    intervalRef.current = setInterval(() => {
                        const now = Date.now();
                        const newElapsed = Math.floor((now - serverTimeUTC) / 1000);
                        const newRemaining = Math.max(30 - newElapsed, 0);

                        if (isMounted) {
                            setRemaining(newRemaining);
                        }

                        if (newRemaining <= 0 && intervalRef.current) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                        }
                    }, 1000);
                }

            } catch (error) {
                console.error("Timer error:", error);
                if (isMounted) {
                    setRemaining(0);
                    setLoading(false);
                }
            }
        }

        fetchStartTime();

        return () => {
            isMounted = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [gameId]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimerStyles = () => {
        if (loading) {
            return {
                bg: 'bg.muted',
                color: 'fg.muted',
                borderColor: 'border.subtle'
            };
        }

        if (remaining <= 5) {
            return {
                bg: 'red.50',
                color: 'error',
                borderColor: 'error'
            };
        }

        if (remaining <= 10) {
            return {
                bg: 'orange.50',
                color: 'brutalist.orange',
                borderColor: 'brutalist.orange'
            };
        }

        return {
            bg: 'primary.subtle',
            color: 'primary.emphasis',
            borderColor: 'primary.emphasis'
        };
    };

    const styles = getTimerStyles();
    const shouldPulse = remaining <= 5 && remaining > 0 && !loading;

    return (
        <Box
            p="4"
            textAlign="center"
            minW={{ base: "100px", md: "120px" }}
            maxW={{ base: "120px", md: "140px" }}
            mx="auto"
            animation={shouldPulse ? "pulse 1s infinite" : "none"}
        >
            <Text
                fontSize={{ base: "xl", md: "2xl" }}
                fontWeight="black"
                color={styles.color}
                fontFamily="mono"
                letterSpacing="1px"
                lineHeight="1"
            >
                {loading ? "--:--" : formatTime(remaining)}
            </Text>

            <Text
                fontSize="xs"
                fontWeight="bold"
                color={styles.color}
                textTransform="uppercase"
                letterSpacing="wider"
                mt="1"
                opacity="0.8"
            >
                {loading
                    ? 'Loading'
                    : remaining <= 0
                        ? 'Time Up!'
                        : remaining <= 5
                            ? 'Hurry!'
                            : 'Timer'
                }
            </Text>
        </Box>
    );
}