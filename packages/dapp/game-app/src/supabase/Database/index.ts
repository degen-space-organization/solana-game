// Imports
import { lobbies } from "./lobbies";
import { users } from "./users";
import { games } from "./game";
import { spectate } from "./spectate";
import { tournaments } from "./tournaments";



/**
 * Exports a single object containing all database transactions
 * @module database
 */
export const database = {
    lobbies,
    users,
    games,
    tournaments,
    spectate
};