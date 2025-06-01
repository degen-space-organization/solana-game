/**
 * @file index.ts
 * 
 * @description This is the root of the solana game server
 * It is a boilerplate express server
 * 
 */

/** Imports */
import { config } from "dotenv";
import cors from 'cors';
import express from 'express';
import path from 'path';


/** Routers */
import {
    GameRouter
} from './routers'
import gameRouter from "./routers/GameRouter/GameRouter";

import { startWatchingGameRounds } from "./controllers/GameController/GameWatcher";

// Config the env vars
config({ 
    path: path.join(__dirname, '../.env')
});

const PORT = process.env.SERVER_PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'default-supabase-url';
const API_VERSION = process.env.API_VERSION || 'v1';


const app = express();
app.use(cors());
app.use(express.json());


/** Routes */
const prefix = { 
    get: (route: string) => `/api/${API_VERSION}/${route}`,
    post: (route: string) => `/api/${API_VERSION}/${route}`
}; 
app.use(prefix.get('game'), GameRouter.default);
app.use(prefix.post('game'), GameRouter.default)

// simple health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Game server is running',
        version: API_VERSION,
        port: PORT,
        supabaseUrl: SUPABASE_URL
    });
});



/** Main server runtime */
app.listen(PORT, () => {
    console.log('Game server is starting...');
    console.log('==========================');
    console.log('Server is running on port', PORT);
    console.log('API url: ', `http://localhost:${PORT}/api/${API_VERSION}`);
    console.log('Connected to supabase DB at: ', SUPABASE_URL);
    console.log('==========================\n');
}).on('error', (err) => {
    console.error('Error starting server:', err);
    console.error('Please check your environment variables and try again.');
    console.error('==========================');
})

// This goes on and on and on
startWatchingGameRounds();

