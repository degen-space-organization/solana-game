

import Match from "./Match/Match";
import Payout from "./Payout/Payout";
import GameInfo from "./GameInfo/GameInfo";
import WaitingTournament from "./WaitingTournament/WaitingTournament";


/**
 * @function Game
 * 
 * @description Repesents the Game itself.
 * Handles the game logic and fetches information about the relevant game
 * 
 * Its rendering is handled one layer above
 * It decides wether to render the game UI or the winner etc.
 * 
 * 
 * @returns JSX.Element representing the Game Component
 */
export default function Game() {

    // handle display game
    // handle display winner
    // subscribe to realtime in order to track the game information
    // do not worry about the round or the match being played, we only 
    // care about the game itself

    // 1. On realtime update that the game is finished and awaiting for payout
    // display the payout screen, otherwise display the Game stuff

    // only time when the game component will re-render children components
    // is when the game status changes from "in progress" to "finished" and awaiting payout
    // that will trigger the replacement of Match with Payout component


    return (
        <div className="game-container">
            <h1>Game Component</h1>
            <p>This is the game component where you can implement your game logic.</p>
            {/* Add your game UI and logic here */}

            <GameInfo />

            {/* Based on the Game status render one of the following */}
            <Match />
            <Payout />
            <WaitingTournament />

            {/* 
                If the game is in progress, display the match and battlefield
                If the game is finished, display the payout component
                If the game is waiting for players, display the waiting component
            */}
            
        </div>
    );
}