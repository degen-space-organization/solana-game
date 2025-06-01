// Modified Tournament Logic for Immediate Bracket Advancement
import { dbClient } from '../../database/provider';
import { TablesInsert } from '../../database/types';

export class BracketTournamentManager {

    /**
     * Process single match completion for immediate tournament advancement
     * Call this immediately when any tournament match completes
     */
    static async processMatchCompletion(matchId: number, winnerId: number): Promise<{ success: boolean, errorMessage?: string }> {
        try {
            // Get match details
            const { data: match, error: matchError } = await dbClient
                .from('matches')
                .select('tournament_id, id')
                .eq('id', matchId)
                .single();

            if (matchError || !match || !match.tournament_id) {
                return { success: false, errorMessage: "Match not found or not part of tournament" };
            }

            const tournamentId = match.tournament_id;

            // ✅ Check if tournament will be complete after this elimination
            const { data: activeParticipants, error: activeError } = await dbClient
                .from('tournament_participants')
                .select('user_id')
                .eq('tournament_id', tournamentId)
                .is('eliminated_at', null);

            if (activeError) {
                return { success: false, errorMessage: "Could not check tournament status" };
            }

            const willBeActiveAfterElimination = (activeParticipants?.length || 0) - 1;
            const isFinals = willBeActiveAfterElimination === 1;

            // 1. Eliminate the loser (with special finals handling)
            await this.eliminateLoser(matchId, winnerId, isFinals);

            // 2. Only advance winner if tournament will continue (more than 1 player remaining)
            if (!isFinals) {
                console.log(`🎯 Tournament ${tournamentId}: Winner ${winnerId} advancing to next round (${willBeActiveAfterElimination} players remaining)`);
                await this.advanceWinner(tournamentId, winnerId);
            } else {
                console.log(`🏆 Tournament ${tournamentId}: Final match completed, winner ${winnerId} - preparing for payout display`);
            }

            // 3. Check tournament completion (will handle finals cleanup if needed)
            await this.checkTournamentCompletion(tournamentId);

            return { success: true };

        } catch (error) {
            console.error("Error processing match completion:", error);
            return { success: false, errorMessage: "Failed to process match completion" };
        }
    }

    /**
     * Immediately eliminate the loser from tournament and clean up match participants
     * Special handling for finals - keep participants for payout display
     */
    private static async eliminateLoser(matchId: number, winnerId: number, isFinals: boolean = false): Promise<void> {
        // Get match participants
        const { data: participants, error } = await dbClient
            .from('match_participants')
            .select('user_id')
            .eq('match_id', matchId);

        if (error || !participants || participants.length !== 2) {
            throw new Error("Could not find match participants");
        }

        // Find the loser
        const loserId = participants.find(p => p.user_id !== winnerId)?.user_id;
        
        if (!loserId) {
            throw new Error("Could not identify loser");
        }

        // Get tournament ID
        const { data: match, error: matchError } = await dbClient
            .from('matches')
            .select('tournament_id')
            .eq('id', matchId)
            .single();

        if (matchError || !match?.tournament_id) {
            throw new Error("Could not find tournament for match");
        }

        // 1. Always eliminate the loser from tournament_participants
        const { error: eliminateError } = await dbClient
            .from('tournament_participants')
            .update({ 
                eliminated_at: new Date().toISOString()
            })
            .eq('tournament_id', match.tournament_id)
            .eq('user_id', loserId)
            .is('eliminated_at', null);

        if (eliminateError) {
            throw new Error(`Failed to eliminate loser: ${eliminateError.message}`);
        }

        // 2. Clean up match_participants only for non-finals
        if (!isFinals) {
            const { error: cleanupError } = await dbClient
                .from('match_participants')
                .delete()
                .eq('match_id', matchId);

            if (cleanupError) {
                throw new Error(`Failed to cleanup match participants: ${cleanupError.message}`);
            }

            console.log(`✅ Player ${loserId} eliminated from tournament ${match.tournament_id} - can now join other games`);
            console.log(`✅ Cleaned up match_participants for completed match ${matchId}`);
        } else {
            console.log(`🏆 Finals completed! Player ${loserId} eliminated from tournament ${match.tournament_id}`);
            console.log(`⏳ Match participants kept for payout display - cleanup will happen after 15 seconds`);
        }
    }

    /**
     * Advance winner to next round immediately
     */
    private static async advanceWinner(tournamentId: number, winnerId: number): Promise<void> {
        // Check if there's already a waiting match for this winner
        const waitingMatch = await this.findWaitingMatchForWinner(tournamentId, winnerId);
        
        if (waitingMatch) {
            // Add winner to existing waiting match
            await this.addWinnerToWaitingMatch(waitingMatch.id, winnerId);
        } else {
            // Create new waiting match for this winner
            await this.createWaitingMatchForWinner(tournamentId, winnerId);
        }
    }

    /**
     * Find if there's already a waiting match that this winner should join
     */
    private static async findWaitingMatchForWinner(tournamentId: number, winnerId: number): Promise<any | null> {
        // Look for matches with status 'waiting' that have exactly 1 participant
        const { data: waitingMatches, error } = await dbClient
            .from('matches')
            .select(`
                id, status,
                match_participants(user_id, position)
            `)
            .eq('tournament_id', tournamentId)
            .eq('status', 'waiting');

        if (error || !waitingMatches) {
            return null;
        }

        // Find a match with exactly 1 participant (waiting for opponent)
        for (const match of waitingMatches) {
            const participantCount = match.match_participants?.length || 0;
            if (participantCount === 1) {
                return match;
            }
        }

        return null;
    }

    /**
     * Add winner to existing waiting match and start it
     */
    private static async addWinnerToWaitingMatch(matchId: number, winnerId: number): Promise<void> {
        // Get existing participant position
        const { data: existingParticipants, error: participantError } = await dbClient
            .from('match_participants')
            .select('position')
            .eq('match_id', matchId);

        if (participantError || !existingParticipants || existingParticipants.length !== 1) {
            throw new Error("Invalid existing match participants");
        }

        const existingPosition = existingParticipants[0].position;
        const newPosition = existingPosition === 1 ? 2 : 1;

        // Add new participant
        const { error: addParticipantError } = await dbClient
            .from('match_participants')
            .insert([{
                match_id: matchId,
                user_id: winnerId,
                position: newPosition
            }]);

        if (addParticipantError) {
            throw new Error(`Failed to add winner to match: ${addParticipantError.message}`);
        }

        // Start the match immediately
        const { error: startMatchError } = await dbClient
            .from('matches')
            .update({
                status: 'in_progress',
                started_at: new Date().toISOString()
            })
            .eq('id', matchId);

        if (startMatchError) {
            throw new Error(`Failed to start match: ${startMatchError.message}`);
        }

        // Create first round for the match
        await this.createFirstRound(matchId);

        console.log(`✅ Winner ${winnerId} added to match ${matchId} - match started!`);
    }

    /**
     * Create new waiting match for winner
     */
    private static async createWaitingMatchForWinner(tournamentId: number, winnerId: number): Promise<void> {
        // Get tournament details for match creation
        const { data: tournament, error: tournamentError } = await dbClient
            .from('tournaments')
            .select('prize_pool, max_players')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            throw new Error("Failed to fetch tournament details");
        }

        const stakeAmount = (Number(tournament.prize_pool) / Number(tournament.max_players)).toString();

        // Create waiting match
        const { data: newMatch, error: matchError } = await dbClient
            .from('matches')
            .insert([{
                tournament_id: tournamentId,
                status: 'waiting', // ⭐ Key: Match waits for second player
                stake_amount: stakeAmount,
                total_prize_pool: tournament.prize_pool!,
                // Don't set started_at yet - will be set when second player joins
            }])
            .select('id')
            .single();

        if (matchError || !newMatch) {
            throw new Error(`Failed to create waiting match: ${matchError?.message}`);
        }

        // Add winner as first participant
        const { error: participantError } = await dbClient
            .from('match_participants')
            .insert([{
                match_id: newMatch.id,
                user_id: winnerId,
                position: 1
            }]);

        if (participantError) {
            throw new Error(`Failed to add winner to new match: ${participantError.message}`);
        }

        console.log(`✅ Created waiting match ${newMatch.id} for winner ${winnerId}`);
    }

    /**
     * Create first round for a match
     */
    private static async createFirstRound(matchId: number): Promise<void> {
        const { error } = await dbClient
            .from('game_rounds')
            .insert([{
                match_id: matchId,
                round_number: 1,
                status: 'in_progress'
            }]);

        if (error) {
            console.error(`Failed to create first round for match ${matchId}:`, error);
        }
    }

    /**
     * Check if tournament is complete (only 1 active participant left)
     */
    private static async checkTournamentCompletion(tournamentId: number): Promise<void> {
        const { data: activeParticipants, error } = await dbClient
            .from('tournament_participants')
            .select('user_id')
            .eq('tournament_id', tournamentId)
            .is('eliminated_at', null);

        if (error) {
            console.error("Error checking active participants:", error);
            return;
        }

        const activeCount = activeParticipants?.length || 0;

        if (activeCount === 1) {
            // Tournament complete!
            const winnerId = activeParticipants![0].user_id;
            
            // Get the final match to handle payout display
            const { data: finalMatch, error: finalMatchError } = await dbClient
                .from('matches')
                .select('id, status')
                .eq('tournament_id', tournamentId)
                .eq('status', 'showing_results')
                .single();

            if (!finalMatchError && finalMatch) {
                console.log(`🏆 Tournament ${tournamentId} final match ${finalMatch.id} - showing payout for 15 seconds`);
                
                // 1. Set final match to completed (triggers payout display on frontend)
                await dbClient
                    .from('matches')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', finalMatch.id);

                // 2. Wait 15 seconds for payout display (both players see transaction processing)
                await new Promise(resolve => setTimeout(resolve, 15000));

                // 3. Now complete tournament and clean up
                await this.completeTournamentAndCleanup(tournamentId, winnerId, finalMatch.id);
            } else {
                // No final match in showing_results state, complete immediately
                await this.completeTournamentAndCleanup(tournamentId, winnerId, null);
            }

        } else if (activeCount === 0) {
            console.error(`Tournament ${tournamentId} has no active participants - invalid state`);
        } else {
            console.log(`Tournament ${tournamentId} continues with ${activeCount} active participants`);
        }
    }

    /**
     * Complete tournament and clean up all participants
     */
    private static async completeTournamentAndCleanup(tournamentId: number, winnerId: number, finalMatchId: number | null): Promise<void> {
        // Update tournament status
        await dbClient
            .from('tournaments')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', tournamentId);

        // Set final positions
        await this.setFinalPositions(tournamentId, winnerId);

        // Process tournament payout
        // await VaultController.processPayoutTournamentSingle(tournamentId);

        // Clean up all match participants for this tournament
        const { data: tournamentMatches, error: fetchMatchesError } = await dbClient
            .from('matches')
            .select('id')
            .eq('tournament_id', tournamentId);

        if (!fetchMatchesError && tournamentMatches && tournamentMatches.length > 0) {
            const matchIds = tournamentMatches.map(m => m.id);
            
            const { error: cleanupError } = await dbClient
                .from('match_participants')
                .delete()
                .in('match_id', matchIds);

            if (cleanupError) {
                console.error(`Error cleaning up tournament match participants:`, cleanupError);
            } else {
                console.log(`✅ Cleaned up all match_participants for completed tournament ${tournamentId}`);
            }
        }

        console.log(`🏆 Tournament ${tournamentId} completed! Winner: ${winnerId} - all participants freed`);
    }

    /**
     * Set final positions based on elimination order
     */
    private static async setFinalPositions(tournamentId: number, winnerId: number): Promise<void> {
        // Winner gets position 1
        await dbClient
            .from('tournament_participants')
            .update({ final_position: 1 })
            .eq('tournament_id', tournamentId)
            .eq('user_id', winnerId);

        // Others get positions based on elimination order (latest eliminated = higher position)
        const { data: eliminated } = await dbClient
            .from('tournament_participants')
            .select('user_id, eliminated_at')
            .eq('tournament_id', tournamentId)
            .not('eliminated_at', 'is', null)
            .neq('user_id', winnerId)
            .order('eliminated_at', { ascending: false });

        if (eliminated) {
            for (let i = 0; i < eliminated.length; i++) {
                await dbClient
                    .from('tournament_participants')
                    .update({ final_position: i + 2 })
                    .eq('tournament_id', tournamentId)
                    .eq('user_id', eliminated[i].user_id);
            }
        }
    }

    /**
     * Create initial bracket for tournament start
     */
    static async createInitialBracket(tournamentId: number, participants: { user_id: number }[]): Promise<{ success: boolean, errorMessage?: string }> {
        try {
            if (participants.length < 2) {
                return { success: false, errorMessage: "Not enough participants" };
            }

            // Ensure it's a power of 2 (4 or 8 players)
            if (![4, 8].includes(participants.length)) {
                return { success: false, errorMessage: "Tournament must have 4 or 8 players" };
            }

            // Get tournament details
            const { data: tournament, error: tournamentError } = await dbClient
                .from('tournaments')
                .select('prize_pool, max_players')
                .eq('id', tournamentId)
                .single();

            if (tournamentError || !tournament) {
                return { success: false, errorMessage: "Failed to fetch tournament details" };
            }

            const stakeAmount = (Number(tournament.prize_pool) / Number(tournament.max_players)).toString();

            // Shuffle participants for random bracket seeding
            const shuffled = [...participants].sort(() => Math.random() - 0.5);

            // Create first round matches (all start immediately)
            const matchesToCreate: TablesInsert<'matches'>[] = [];
            const participantInserts: TablesInsert<'match_participants'>[] = [];

            // Create pairs for first round
            for (let i = 0; i < shuffled.length; i += 2) {
                if (i + 1 < shuffled.length) {
                    matchesToCreate.push({
                        tournament_id: tournamentId,
                        status: 'in_progress', // Start first round immediately
                        stake_amount: stakeAmount,
                        total_prize_pool: tournament.prize_pool!,
                        started_at: new Date().toISOString(),
                        tournament_round: 1 // Track which round this is
                    });
                }
            }

            if (matchesToCreate.length === 0) {
                return { success: false, errorMessage: "No matches could be created" };
            }

            // Create all first round matches
            const { data: newMatches, error: matchError } = await dbClient
                .from('matches')
                .insert(matchesToCreate)
                .select('id');

            if (matchError || !newMatches) {
                return { success: false, errorMessage: `Failed to create matches: ${matchError?.message}` };
            }

            // Create participants for each match
            for (let i = 0; i < shuffled.length; i += 2) {
                if (i + 1 < shuffled.length) {
                    const matchIndex = Math.floor(i / 2);
                    const matchId = newMatches[matchIndex].id;

                    participantInserts.push(
                        {
                            match_id: matchId,
                            user_id: shuffled[i].user_id,
                            position: 1
                        },
                        {
                            match_id: matchId,
                            user_id: shuffled[i + 1].user_id,
                            position: 2
                        }
                    );
                }
            }

            // Insert all participants
            const { error: participantError } = await dbClient
                .from('match_participants')
                .insert(participantInserts);

            if (participantError) {
                return { success: false, errorMessage: `Failed to create participants: ${participantError.message}` };
            }

            // Create first rounds for all matches
            const roundInserts: TablesInsert<'game_rounds'>[] = newMatches.map(match => ({
                match_id: match.id,
                round_number: 1,
                status: 'in_progress'
            }));

            const { error: roundError } = await dbClient
                .from('game_rounds')
                .insert(roundInserts);

            if (roundError) {
                console.error("Error creating initial rounds:", roundError);
                // Don't fail tournament creation for this - rounds can be created manually
            }

            console.log(`✅ Created initial bracket for tournament ${tournamentId}: ${newMatches.length} first-round matches`);
            return { success: true };

        } catch (error) {
            console.error("Error creating initial bracket:", error);
            return { success: false, errorMessage: "Internal server error" };
        }
    }

    /**
     * Get tournament bracket status for frontend
     */
    static async getTournamentBracket(tournamentId: number): Promise<any> {
        const { data: matches, error } = await dbClient
            .from('matches')
            .select(`
                id, status, winner_id, started_at, completed_at, tournament_round,
                match_participants(user_id, position)
            `)
            .eq('tournament_id', tournamentId)
            .order('tournament_round', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            throw new Error(`Failed to fetch tournament bracket: ${error.message}`);
        }

        return {
            tournamentId,
            matches: matches || [],
            // You can add more bracket visualization data here
        };
    }

    /**
     * Utility method to clean up stale matches (matches with status 'waiting' but no participants)
     * This can be called as a maintenance task to fix any orphaned matches
     */
    static async cleanupStaleMatches(): Promise<{ cleaned: number, errors: string[] }> {
        const errors: string[] = [];
        let cleanedCount = 0;

        try {
            // Find all matches with 'waiting' status
            const { data: waitingMatches, error: fetchError } = await dbClient
                .from('matches')
                .select(`
                    id, tournament_id, status,
                    match_participants(user_id)
                `)
                .eq('status', 'waiting');

            if (fetchError) {
                errors.push(`Failed to fetch waiting matches: ${fetchError.message}`);
                return { cleaned: 0, errors };
            }

            if (!waitingMatches || waitingMatches.length === 0) {
                console.log('No waiting matches found');
                return { cleaned: 0, errors };
            }

            // Check each waiting match for participants
            for (const match of waitingMatches) {
                const participantCount = match.match_participants?.length || 0;
                
                if (participantCount === 0) {
                    // Stale match found - delete it
                    console.log(`🧹 Found stale match ${match.id} with no participants - deleting`);
                    
                    const { error: deleteError } = await dbClient
                        .from('matches')
                        .delete()
                        .eq('id', match.id);

                    if (deleteError) {
                        errors.push(`Failed to delete stale match ${match.id}: ${deleteError.message}`);
                    } else {
                        cleanedCount++;
                        console.log(`✅ Deleted stale match ${match.id}`);
                    }
                } else {
                    console.log(`✓ Match ${match.id} has ${participantCount} participants - keeping`);
                }
            }

            console.log(`🧹 Cleanup complete: ${cleanedCount} stale matches removed, ${errors.length} errors`);
            return { cleaned: cleanedCount, errors };

        } catch (error) {
            errors.push(`Unexpected error during cleanup: ${(error as any).message}`);
            return { cleaned: cleanedCount, errors };
        }
    }
}