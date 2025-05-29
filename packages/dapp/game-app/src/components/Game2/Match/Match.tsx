

import MatchInfo from "./MatchInfo/MatchInfo";

import Round from "./Battlefield/Round";
import MatchResult from "./MatchResult/MatchResult";

import { Box } from "@chakra-ui/react";
import { useState } from "react";



// if this component detects a change in the match, it will re-render

// it will also fetch the current match of the user and display it



export default function Match() {

    const [isMatchInProgress, setIsMatchInProgress] = useState<boolean>(true);
    



    return (
        <div className="match-info">
            <h2>Match Information</h2>
            {/* Add more detailed match information here */}

            <Box p={4} borderWidth={1} borderRadius="md" boxShadow="md">
                <MatchInfo />
                <Box p={4} borderWidth={1} borderRadius="md" boxShadow="md">
                    {isMatchInProgress ? (
                        <Round />
                    ) : (
                        <MatchResult />
                    )}
                </Box>
            </Box>


            {/* Render either Round, or if the match is completed, render the Match Result*/}

            {/* Based on the status of the match, render the following */}


        </div>
    );
}