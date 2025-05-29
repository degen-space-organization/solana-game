



export default function WaitingTournament() {
    // This component is responsible for displaying a waiting screen while the game is loading or waiting for players.
    // It will show a loading spinner and a message indicating that the game is in progress.

    return (
        <div className="waiting-screen">
            <h2>Waiting for Player To </h2>
            <p>Please wait while the game is loading...</p>
            <div className="spinner"></div>
            {/* Add more detailed waiting information here */}
        </div>
    );
}