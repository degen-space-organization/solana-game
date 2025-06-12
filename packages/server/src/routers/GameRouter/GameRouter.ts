import {Request, Response, Express, RequestHandler} from 'express';
import express from 'express';

import { GameController } from '../../controllers';


const gameRouter = express.Router();


/** GET Routes */

gameRouter.get('/list-tournaments', GameController.listTournaments as unknown as RequestHandler);


/** POST Routes */
gameRouter.post('/create-lobby', GameController.createLobby as RequestHandler); // Explicitly cast (only way it works...)
gameRouter.post('/join-lobby', GameController.joinLobby as RequestHandler);
gameRouter.post('/start-match', GameController.startMatch as RequestHandler);
gameRouter.post('/submit-stake', GameController.submitStakeForLobby as RequestHandler);
gameRouter.post('/submit-move', GameController.submitMove as unknown as RequestHandler);

// gameRouter.post('/create-tournament', GameController.createTournament as unknown as RequestHandler);
gameRouter.post('/join-tournament', GameController.joinTournament as unknown as RequestHandler);
gameRouter.post('/start-tournament', GameController.startTournament as unknown as RequestHandler);

gameRouter.post('/leave-lobby', GameController.leaveLobby as unknown as RequestHandler);
gameRouter.post('/withdraw-lobby', GameController.withdrawFromLobby as unknown as RequestHandler);
// gameRouter.post('/close-lobby', GameController.deleteLobby as unknown as RequestHandler);
gameRouter.post('/close-lobby', GameController.closeLobby as unknown as RequestHandler);
gameRouter.post('/kick-player', GameController.kickPlayer as unknown as RequestHandler);

gameRouter.get('/tournament/:tournament_id/bracket', GameController.getTournamentBracket as RequestHandler);




export default gameRouter;
