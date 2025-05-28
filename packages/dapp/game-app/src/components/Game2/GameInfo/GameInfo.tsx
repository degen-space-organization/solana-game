

// import 
import OneOnOneInfo from "./OneOnOneInfo";
import TournamentInfo from "./TournamentInfo";




/**
 * @function GameInfo
 * 
 * @description Shows the information about the game
 * the game can be either a tournament or a one v one
 * 
 * It renders the infromation in realtime and updates it accordingly
 * its a "readonly" component
 * 
 * 
 * @returns  JSX.Element representing the GameInfo Component
 */
export default function GameInfo() {


    // fetch the game information from the backend and determine wether to display
    // the tournament or the one v one game information component

    // subscribes to realtime changes
    // when receiving the payload on updates or other, reset state 
    // and re-render the child components - they are just dumb components


    return (
        <div className="game-info">
            <h2>Game Information</h2>
            <p>This section will display information about the game, such as rules, current status, and player statistics.</p>
            {/* Add more detailed game information here */}

            {/* if the game in question is tournament, display the tournament info */}
            {/* if the game in question is one on one, display the one on one info */}
            <OneOnOneInfo />
            <TournamentInfo />
        </div>
    );
}