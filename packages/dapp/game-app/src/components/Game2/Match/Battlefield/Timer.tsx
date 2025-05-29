import { useEffect, useState, useRef } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { database } from "@/supabase/Database";


export default function Timer({
    gameId
} : {
    gameId: number
}) {
    const [remaining, setRemaining] = useState<number>(20);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        async function fetchStartTime() {
            try {
                const gameData = await database.games.getGameRoundById(gameId);
                if (!gameData || !gameData.created_at) {
                    setRemaining(0);
                    setLoading(false);
                    return;
                }
                const startTime = new Date(gameData.created_at as string).getTime();
                const now = Date.now();
                const elapsed = Math.floor((now - startTime) / 1000);
                const left = Math.max(20 - elapsed, 0);
                if (isMounted) setRemaining(left);
                setLoading(false);
                if (intervalRef.current) clearInterval(intervalRef.current);
                intervalRef.current = setInterval(() => {
                    const now2 = Date.now();
                    const elapsed2 = Math.floor((now2 - startTime) / 1000);
                    const left2 = Math.max(20 - elapsed2, 0);
                    if (isMounted) setRemaining(left2);
                    if (left2 <= 0 && intervalRef.current) {
                        clearInterval(intervalRef.current);
                    }
                }, 1000);
            } catch (error) {
                console.error("Error fetching game time:", error);
                setRemaining(0);
                setLoading(false);
            }
        }
        fetchStartTime();
        return () => {
            isMounted = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [gameId]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    // Neobrutalism style
    return (
        <Box
            border="4px solid #222"
            borderRadius="0"
            bg="#F3E8FF"
            boxShadow="8px 8px 0px rgba(0,0,0,0.8)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            width="96px"
            height="96px"
            margin="0 auto"
        >
            <Text fontSize="2xl" fontWeight="900" color="#7B2CBF" letterSpacing="2px" fontFamily="monospace">
                {loading ? '...' : formatTime(remaining)}
            </Text>
        </Box>
    );
}