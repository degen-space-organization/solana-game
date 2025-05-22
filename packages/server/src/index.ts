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


// Config the env vars
config({ 
    path: path.join(__dirname, '../.env')
});

const PORT = process.env.SERVER_PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'default-supabase-url';

const app = express();
app.use(cors());
app.use(express.json());


/** Routes */
app.get('/', (req, res) => {
    res.send('healthcheck');
});




/** Main server runtime */
app.listen(PORT, () => {
    console.log('Game server is starting...');
    console.log('==========================');
    console.log('Server is running on port', PORT);
    console.log('Connected to supabase DB at: ', SUPABASE_URL);
    console.log('==========================\n');
}).on('error', (err) => {
    console.error('Error starting server:', err);
    console.error('Please check your environment variables and try again.');
    console.error('==========================');
})


