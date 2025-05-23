import {Request, Response, Express} from 'express';
import express from 'express';

import { GameController } from '../../controllers';


const gameRouter = express.Router();


/** GET Routes */
gameRouter.get('/test', async (req: Request, res: Response) => GameController.hello(req, res));


/** POST Routes */

export default gameRouter;
