import { dbClient } from "../../database/provider";
import GameController from "./GameController";



/**
 * Game timer is a class that does something after 20 seconds of the round start.
 * 
 */
export default class GameTimer {

    private roundId: number;
    private timeoutId: NodeJS.Timeout | null = null;

    constructor(roundId: number) {
        this.roundId = roundId;
    };

    /**
     * This function will execute a piece 
     * of code 20 seconds after the round start
     * 
     * Handle all the logic for the round processing in here 
     */
    start() {
        console.log(`Starting timer for round ${this.roundId}`);

        this.timeoutId = setTimeout(async () => {
            console.log(`Timer expired for round ${this.roundId}`);

            // in here i will do all the logic required for timing. Basically this will trigger on every insert
            const {data, error} = await dbClient
                .from('game_rounds')
                .select('*')
                .eq('id', this.roundId)

            if (error) {
                console.error(`Failed to fetch round ${this.roundId}:`, error.message);
                return;
            }
                        
            const matchId = data[0]?.match_id;
            const roundNumber = data[0]?.round_number;
            const roundProcessResult = await GameController.processRound(matchId, roundNumber);

            if (!roundProcessResult.success) {
                console.error(`Failed to update round ${this.roundId}:`, roundProcessResult.errorMessage || "Unknown error");
            } else {
                console.log(`Round ${this.roundId} marked as finished.`);
            }

        }, 20000); // 20 seconds
    }

    cancel() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            console.log(`Timer cancelled for round ${this.roundId}`);
        }
    }


}