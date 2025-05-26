import {Request, Response, Express, RequestHandler} from 'express';
import express from 'express';

import { GameController } from '../../controllers';


const gameRouter = express.Router();


/** GET Routes */
gameRouter.get('/test', async (req: Request, res: Response) => GameController.hello(req, res));


/** POST Routes */
gameRouter.post('/create-lobby', GameController.createLobby as RequestHandler); // Explicitly cast (only way it works...)
gameRouter.post('/join-lobby', GameController.joinLobby as RequestHandler);
gameRouter.post('/start-match', GameController.startMatch as RequestHandler);
gameRouter.post('/submit-move', GameController.submitMove as unknown as RequestHandler);




export default gameRouter;
