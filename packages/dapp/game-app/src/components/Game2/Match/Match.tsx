

import MatchInfo from "./MatchInfo/MatchInfo";

import Round from "./Battlefield/Round";
import MatchResult from "./MatchResult/MatchResult";








export default function Match() {




    return (
        <div className="match-info">
            <h2>Match Information</h2>
            <p>This section will display information about the match, such as match name, participating players, scores, and current status.</p>
            {/* Add more detailed match information here */}

            <MatchInfo />

            {/* Render either Round, or if the match is completed, render the Match Result*/}
            <Round></Round>

            {/* Based on the status of the match, render the following */}


        </div>
    );
}