


export default function ChooseMove() {


    // This component will allow the player to chose and submit the move
    // he can pick the move from the variety of options
    // and there will be a button to submit the move 
    // meaning that you have to click and then submit

    // It will also subscribe to the game_round inserts and when a new game round is inserted it will re-render
    // to the default state of no move selected

    return (
        <div className="choose-move">
            <h2>Choose Your Move</h2>
            <p>Select a move for this round:</p>
            {/* Add your move selection UI here */}
            {/* For example, you could map over an array of moves and render buttons for each move */}
        </div>
    );
}