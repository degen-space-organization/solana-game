
import Timer from './Timer';
import ChooseMove from './ChoseMove';
import Battlefield from './Battlefield';


export default function Round() {
    // This component is responsible for displaying the current round of the match.
    // It will show the round number, the players' scores, and any other relevant information about the round.

    return (
        <div className="round-info">
            <h2>Round Information</h2>
            <p>This section will display information about the current round, such as round number, player scores, and any other relevant details.</p>
            <Battlefield></Battlefield>
            <Timer></Timer>
            <ChooseMove></ChooseMove>
            {/* Add more detailed round information here */}
        </div>
    );
}