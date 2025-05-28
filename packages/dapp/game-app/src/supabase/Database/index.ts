// Imports
import { lobbies } from "./lobbies";
import { users } from "./users";
import { games } from "./game";
import { spectate } from "./spectate";



/**
 * Exports a single object containing all database transactions
 * @module database
 */
export const database = {
    lobbies,
    users,
    games,
    spectate
};