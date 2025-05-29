


export default function RoundInformation({
    gameId
} : {
    gameId: number
}) {
    // This component will display the round information for the current match
    // It will fetch the current round information from the database and display it

    return (
        <div className="round-information">
            <h2>Round Information</h2>
            {/* Fetch and display round information here */}
            {/* For now, we will just display the gameId */}
            <p>Game ID: {gameId}</p>
        </div>
    );
}
//     // This component is responsible for displaying the current round of the match.