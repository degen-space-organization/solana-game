

/**
 * @file ~/components/Game/Game.tsx
 */

// imports
import Game from "./Game";




/**
 * @function GamePage
 * 
 * This Component represents the Game "Page"
 * It will contain the game itself and will work with the game features
 * in the context of the application
 * - rendering the game UI accordingly
 * - fetching the general user data & game participation (not handling the game / round logic)
 * - hiding / showing the UI based on the application state
 * 
 * * the actual game & game logic will be implemented
 * * in its child components, that will again be standalone
 * 
 * @returns JSX.Element representing the Game Page
 */
export default function GamePage() {



    return (
        <div className="game-container">
            <h1>Game Component</h1>
            <p>This is the game component where you can implement your game logic.</p>
            <Game />
        </div>
    );
}