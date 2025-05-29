

import { database } from '@/supabase/Database';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';


import Timer from './Timer';
import ChooseMove from './ChoseMove';
import Battlefield from './Battlefield';
import RoundInformation from './RoundInformation';



export default function Round() {


    const { publicKey } = useWallet();
    const [userId, setUserId] = useState<number | null>(null);
    const [roundId, setRoundId] = useState<number | null>(null);
    const [matchId, setMatchId] = useState<number | null>(null);
    const [roundNumber, setRoundNumber] = useState<number | null>(null);

    useEffect(() => {
        fetchRoundInfo().then(result => {
            if (result) {
                setRoundId(result.roundInfo!.id);
                setRoundNumber(result.roundInfo!.round_number);
                setMatchId(result.roundInfo!.match_id);
                setUserId(result.userId?.id || null);
            } else {
                console.log("No round information found.");
            }
        });
    }, [publicKey]);


    async function fetchRoundInfo() {
        try {
            const roundInfo = await database.games.findLatestGameRoundForUser(publicKey!.toString());
            const userId = await database.users.getByWallet(publicKey!.toString());
            console.log("Fetched round information:", roundInfo);
            console.log("Fetched user ID:", userId);
            return {userId, roundInfo};
        } catch (error) {
            console.error("Error fetching round information:", error);
        }
    }


    return (
        <div className="round-info">
            <RoundInformation gameId={roundId!} />
            
            <Battlefield
                roundId={roundId!}
                userId={userId!}
            />

            <Timer gameId={roundId!} />

            <ChooseMove
                gameRoundNumber={roundNumber!}
                userId={userId!}
                matchId={matchId!}
            />
            {/* Add more detailed round information here */}
        </div>
    );
}