import GameTimer from './GameTimer';
import { dbClient } from '../../database/provider';

/**
 * Add a watcher for game creations
 * 
 * add a watcher for game updates too
 */


/**
 * This function provides a trigger after a new game round is
 * created in the database.
 */
export const startWatchingGameRounds = async () => {
  const channel = dbClient
    .channel('game_rounds_channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'game_rounds'
      },
      payload => {
        /** CAREFUL with this over here */
        const newRound = payload.new;
        console.log('New round created:', newRound.id);

        const timer = new GameTimer(newRound.id);
        timer.start();
      }
    )
    .subscribe();

  console.log('[Supabase] Listening to game_rounds inserts...');
};