


export default function Battlefield() {
    
    // This component will render either the animation of the two players fighting (gif)
    // or it will render "waitinig"


    // this component will subscribe to the game round updates and when a game round is finished 
    // and there is a winner, it will trigger the Battlefield to re-render and display the animation of the two players fighting

    return (
        <div className="battlefield">
            <h2>Battlefield</h2>
            <p>This section will display the battlefield where the game takes place.</p>
            {/* Add your battlefield UI and logic here */}
        </div>
    );
}