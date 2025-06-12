//@ts-nocheck


import { Request, Response } from "express";

import { dbClient } from '../../database/provider';
import { TablesInsert, Tables, TablesUpdate } from '../../database/types'
import VaultController from "../VaultController/VaultController";
import AdminWallet from "../../utils/adminWallet";
import { BracketTournamentManager } from "./BracketTournamentManager";

type player_move = 'rock' | 'paper' | 'scissors';


/**
 * 
 */
export default class GameController {


    // #region Games Management
    static async startMatch(req: Request, res: Response) {
        try {
            const { lobby_id, creator_user_id } = req.body;

            if (!lobby_id || !creator_user_id) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            // Use the new atomic function
            const { data, error } = await dbClient.rpc('start_match_atomic', {
                p_lobby_id: lobby_id,
                p_creator_user_id: creator_user_id
            });

            if (error) {
                console.error("Error starting match:", error);
                return res.status(500).json({ error: error.message });
            }

            if (!data.success) {
                return res.status(400).json({ error: data.error });
            }

            res.status(200).json({
                message: "Match started successfully",
                match_id: data.match_id
            });
        } catch (error) {
            console.error("Error in startMatch:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    static async startTournament(req: Request, res: Response) {
        try {
            const { tournament_id, creator_user_id } = req.body;

            if (!tournament_id || !creator_user_id) {
                return res.status(400).json({ error: "Missing required fields: tournament_id, creator_user_id." });
            }

            // Fetch tournament details and participants
            const { data: tournament, error: tournamentError } = await dbClient
                .from('tournaments')
                .select('*, tournament_participants(user_id)')
                .eq('id', tournament_id)
                .single();

            if (tournamentError || !tournament) {
                console.error("Error fetching tournament for start:", tournamentError);
                return res.status(404).json({ error: "Tournament not found." });
            }

            if (tournament.created_by !== creator_user_id) {
                return res.status(403).json({ error: "Only the tournament creator can start the tournament." });
            }

            if (tournament.status !== 'waiting') {
                return res.status(400).json({ error: "Tournament is not in 'waiting' status." });
            }

            const participants = tournament.tournament_participants;
            if (!participants || participants.length !== tournament.max_players) {
                return res.status(400).json({ error: `Not enough players to start tournament. Expected ${tournament.max_players}, got ${participants?.length || 0}.` });
            }

            // ✅ Create initial bracket using the new bracket system
            const { success: bracketCreated, errorMessage: bracketError } =
                await BracketTournamentManager.createInitialBracket(tournament_id, participants);

            if (!bracketCreated) {
                console.error("Error generating initial bracket:", bracketError);
                return res.status(500).json({ error: `Failed to generate initial bracket: ${bracketError}` });
            }

            // ✅ Update tournament status to 'in_progress' (only once!)
            const { error: updateError } = await dbClient
                .from('tournaments')
                .update({ status: 'in_progress', started_at: new Date().toISOString() })
                .eq('id', tournament_id);

            if (updateError) {
                console.error("Error updating tournament status to in_progress:", updateError);
                return res.status(500).json({ error: "Failed to start tournament." });
            }

            // ✅ Clean up lobby system (if tournament was created via lobby)
            // Remove lobby and lobby participants if tournament is started
            const { error: removeLobbyError } = await dbClient
                .from('lobbies')
                .delete()
                .eq('tournament_id', tournament_id);

            if (removeLobbyError) {
                console.error("Error removing lobby for tournament:", removeLobbyError);
                // Don't fail the tournament start for this - log and continue
            }

            // Remove all lobby participants whose id is in the tournament
            const { error: removeParticipantsError } = await dbClient
                .from('lobby_participants')
                .delete()
                .in('user_id', participants.map(p => p.user_id));

            if (removeParticipantsError) {
                console.error("Error removing lobby participants for tournament:", removeParticipantsError);
                // Don't fail the tournament start for this - log and continue
            }

            console.log(`✅ Tournament ${tournament_id} started successfully with ${participants.length} players`);

            res.status(200).json({
                message: "Tournament started successfully. Initial bracket created.",
                tournament_id: tournament_id,
                matches_created: Math.floor(participants.length / 2)
            });

        } catch (error) {
            console.error("Error in startTournament:", error);
            res.status(500).json({ error: "Internal Server Error." });
        }
    }
    // #endregion



    // #region Game Logic
    static async submitMove(req: Request, res: Response) {
        const { match_id, user_id, round_number, player_move }: { match_id: number, user_id: number, round_number: number, player_move: player_move } = req.body;

        if (!match_id || !user_id || !round_number || !player_move) {
            return res.status(400).json({ error: "Missing required fields (match_id, user_id, round_number, player_move)." });
        }

        // Validate player_move against allowed values
        const validMoves: player_move[] = ['rock', 'paper', 'scissors'];
        if (!validMoves.includes(player_move)) {
            return res.status(400).json({ error: "Invalid player_move. Must be 'rock', 'paper', or 'scissors'." });
        }

        try {
            // --- NEW SECURITY CHECK: Prevent moves if the match is already completed ---
            const { data: match, error: matchFetchError } = await dbClient
                .from('matches')
                .select('status, winner_id')
                .eq('id', match_id)
                .single();

            if (matchFetchError || !match) {
                console.error(`Error fetching match ${match_id}:`, matchFetchError);
                return res.status(404).json({ error: "Match not found." });
            }

            if (match.status === 'completed' && match.winner_id !== null) {
                console.log(`Attempted to submit move for completed match ${match_id}.`);
                return res.status(403).json({ error: "Cannot submit move to a completed match." });
            }
            // --- END NEW SECURITY CHECK ---

            // Find the game round
            const { data: gameRound, error: fetchError } = await dbClient
                .from('game_rounds')
                .select('*')
                .eq('match_id', match_id)
                .eq('round_number', round_number)
                .single();

            if (fetchError || !gameRound) {
                console.error(`Error fetching game round or round not found: Match ${match_id}, Round ${round_number}`, fetchError);
                return res.status(404).json({ error: "Game round not found or already completed." });
            }

            // Ensure the round is not already completed
            if (gameRound.completed_at) {
                return res.status(409).json({ error: "This round has already been completed." });
            }

            // Determine if the user is player1 or player2 in this match
            const { data: matchParticipants, error: participantsError } = await dbClient
                .from('match_participants')
                .select('user_id, position')
                .eq('match_id', match_id);

            if (participantsError || !matchParticipants || matchParticipants.length !== 2) {
                console.error("Error fetching match participants or unexpected number of participants:", participantsError);
                return res.status(500).json({ error: "Could not determine match participants." });
            }

            let updateData: { player1_move?: player_move, player2_move?: player_move } = {};
            const isPlayer1 = matchParticipants.some(p => p.user_id === user_id && p.position === 1);
            const isPlayer2 = matchParticipants.some(p => p.user_id === user_id && p.position === 2);

            if (isPlayer1) {
                if (gameRound.player1_move) {
                    return res.status(409).json({ error: "Player 1 has already made a move for this round." });
                }
                updateData.player1_move = player_move;
            } else if (isPlayer2) {
                if (gameRound.player2_move) {
                    return res.status(409).json({ error: "Player 2 has already made a move for this round." });
                }
                updateData.player2_move = player_move;
            } else {
                return res.status(403).json({ error: "User is not a participant in this match." });
            }

            // Update the game round with the player's move
            const { error: updateError } = await dbClient
                .from('game_rounds')
                .update(updateData)
                .eq('id', gameRound.id);

            if (updateError) {
                console.error("Error submitting move:", updateError);
                return res.status(500).json({ error: "Failed to submit move." });
            } else {
                console.log(`Move submitted successfully for match ${match_id}, round ${round_number} by user ${user_id}.`);
                res.status(200).json({ message: "Move submitted successfully." });
            }



        } catch (error) {
            console.error("submitMove error:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    static async processRound(matchId: number, roundNumber: number): Promise<{ success: boolean, winnerId?: number | null, errorMessage?: string }> {
        console.log(`Processing match ${matchId}, round ${roundNumber}`);
        try {
            const { data: gameRound, error: fetchError } = await dbClient
                .from('game_rounds')
                .select('*')
                .eq('match_id', matchId)
                .eq('round_number', roundNumber)
                .single();

            console.log('ProcessRound - Fetched game round:', gameRound);
            console.log(gameRound);

            if (fetchError || !gameRound) {
                console.error("Error fetching game round or round not found:", fetchError);
                return { success: false, errorMessage: "Game round not found." };
            }

            if (gameRound.completed_at) {
                console.log(`Round ${matchId}-${roundNumber} already completed.`);
                return { success: true, winnerId: gameRound.winner_id }; // Already processed
            }

            const player1Move = gameRound.player1_move as player_move | null;
            const player2Move = gameRound.player2_move as player_move | null;
            let roundWinnerId: number | null = null; // null for a tie or if moves are missing

            // Determine players' actual user_ids
            const { data: participants, error: pError } = await dbClient
                .from('match_participants')
                .select('user_id, position')
                .eq('match_id', matchId);

            if (pError || !participants || participants.length !== 2) {
                console.error("Could not fetch match participants:", pError);
                return { success: false, errorMessage: "Could not fetch match participants." };
            }
            const player1UserId = participants.find(p => p.position === 1)?.user_id;
            const player2UserId = participants.find(p => p.position === 2)?.user_id;

            if (!player1UserId || !player2UserId) {
                console.error("Missing player user IDs for match:", matchId);
                return { success: false, errorMessage: "Missing player IDs." };
            }

            // Rule: If a player fails to make a decision, he loses immediately.
            if (!player1Move && player2Move) {
                roundWinnerId = player2UserId; // Player 1 failed to move
                console.log(`Player 1 failed to move, Player 2 (User ID: ${player2UserId}) wins round ${roundNumber}.`);
            } else if (player1Move && !player2Move) {
                roundWinnerId = player1UserId; // Player 2 failed to move
                console.log(`Player 2 failed to move, Player 1 (User ID: ${player1UserId}) wins round ${roundNumber}.`);
            } else if (!player1Move && !player2Move) {
                // Both failed to move. In a best of 5, this might count as a 'lost' round for both
                // in this case player1 is a winner
                roundWinnerId = player1UserId; // Player 1 wins by default if both fail to move
                console.log(`Both players failed to move, Player 1 (User ID: ${player1UserId}) wins round ${roundNumber} by default.`);
            } else {
                // Both players made a move, determine winner based on RPS rules
                // 'rock' > 'scissors', 'scissors' > 'paper', 'paper' > 'rock'
                if (player1Move === player2Move) {
                    roundWinnerId = null; // Tie
                    console.log(`Match ${matchId}, Round ${roundNumber}: Tie - Both picked ${player1Move}.`);
                } else if (
                    (player1Move === 'rock' && player2Move === 'scissors') ||
                    (player1Move === 'scissors' && player2Move === 'paper') ||
                    (player1Move === 'paper' && player2Move === 'rock')
                ) {
                    roundWinnerId = player1UserId;
                    console.log(`Match ${matchId}, Round ${roundNumber}: Player 1 (User ID: ${player1UserId}) wins with ${player1Move} vs ${player2Move}.`);
                } else {
                    roundWinnerId = player2UserId;
                    console.log(`Match ${matchId}, Round ${roundNumber}: Player 2 (User ID: ${player2UserId}) wins with ${player2Move} vs ${player1Move}.`);
                }
            }

            // Update the game_rounds table
            const { error: updateError } = await dbClient
                .from('game_rounds')
                .update({
                    winner_id: roundWinnerId,
                    completed_at: new Date().toISOString(),
                    status: 'evaluating'
                })
                .eq('id', gameRound.id);

            if (updateError) {
                console.error("Error updating game round with winner:", updateError);
                return { success: false, errorMessage: "Failed to update round with winner." };
            }

            // sleep for 10 seconds
            const result = await new Promise(resolve => setTimeout(resolve, 10_000));

            const { error: statusUpdateError } = await dbClient
                .from('game_rounds')
                .update({ status: 'completed' })
                .eq('id', gameRound.id);

            console.log(`Round ${roundNumber} completed for match ${matchId}. Winner: ${roundWinnerId ? `User ${roundWinnerId}` : 'Tie'}`);

            // After processing a round, check if the match is over
            const { success: matchProcessSuccess, matchWinnerId } = await GameController.processMatch(matchId);

            if (matchProcessSuccess && matchWinnerId === null) {
                // Match is still in progress (no winner yet), create the next round
                const nextRoundNumber = roundNumber + 1;
                const { success: createNextRoundSuccess, errorMessage: createNextRoundError } = await GameController.createGameRound(matchId, nextRoundNumber);
                if (!createNextRoundSuccess) console.error(`Failed to create next round ${nextRoundNumber} for match ${matchId}: ${createNextRoundError}`);
            }

            return { success: true, winnerId: roundWinnerId };

        } catch (error) {
            console.error("processRound error:", error);
            return { success: false, errorMessage: "Internal Server Error." };
        }
    }

    static async processMatch(matchId: number): Promise<{ success: boolean, matchWinnerId?: number | null, errorMessage?: string }> {
        console.log(`Processing match ${matchId} for overall winner.`);
        try {
            // Fetch match details to get current status and ensure initial round creation
            const { data: currentMatch, error: currentMatchError } = await dbClient
                .from('matches')
                .select('status')
                .eq('id', matchId)
                .single();

            if (currentMatchError || !currentMatch) {
                console.error(`Error fetching current match ${matchId} status:`, currentMatchError);
                return { success: false, errorMessage: "Match not found for status check." };
            }

            // --- NEW LOGIC: Create the first round if the match has just started ---
            if (currentMatch.status === 'in_progress') {
                const { data: existingRounds, error: existingRoundsError } = await dbClient
                    .from('game_rounds')
                    .select('id')
                    .eq('match_id', matchId);

                if (existingRoundsError) {
                    console.error("Error checking for existing rounds during match process:", existingRoundsError);
                    return { success: false, errorMessage: "Failed to check existing rounds." };
                }

                if (existingRounds.length === 0) {
                    console.log(`Match ${matchId} is in_progress but has no rounds. Creating Round 1.`);
                    const { success, errorMessage } = await GameController.createGameRound(matchId, 1);
                    if (!success) {
                        console.error(`Failed to create initial round for match ${matchId}: ${errorMessage}`);
                        // Consider marking the match as 'error' or 'cancelled'
                        return { success: false, errorMessage: "Failed to create initial round." };
                    }
                }
            }

            // Fetch all completed rounds for the match
            const { data: gameRounds, error: roundsError } = await dbClient
                .from('game_rounds')
                .select('winner_id')
                .eq('match_id', matchId)
                .not('winner_id', 'is', null); // Only count rounds with a distinct winner

            if (roundsError) {
                console.error("Error fetching game rounds for match:", roundsError);
                return { success: false, errorMessage: "Failed to fetch match rounds." };
            }

            // Get participants to map winner_id to actual players
            const { data: participants, error: pError } = await dbClient
                .from('match_participants')
                .select('user_id, position')
                .eq('match_id', matchId);

            if (pError || !participants || participants.length !== 2) {
                console.error("Could not fetch match participants for winner calculation:", pError);
                return { success: false, errorMessage: "Could not fetch match participants." };
            }
            const player1Id = participants.find(p => p.position === 1)?.user_id;
            const player2Id = participants.find(p => p.position === 2)?.user_id;

            if (!player1Id || !player2Id) {
                console.error("Missing player IDs for match winner calculation:", matchId);
                return { success: false, errorMessage: "Missing player IDs for match winner calculation." };
            }

            let player1Wins = 0;
            let player2Wins = 0;

            gameRounds.forEach(round => {
                if (round.winner_id === player1Id) {
                    player1Wins++;
                } else if (round.winner_id === player2Id) {
                    player2Wins++;
                }
            });

            let matchWinnerId: number | null = null;
            let matchStatus: string = 'in_progress';

            // Best of 5 scenario: first to 3 wins
            if (player1Wins >= 3) {
                matchWinnerId = player1Id;
                matchStatus = 'completed';
            } else if (player2Wins >= 3) {
                matchWinnerId = player2Id;
                matchStatus = 'completed';
            }

            if (matchWinnerId !== null) {
                // update the match status to showing_results
                const { data: updateMatchData, error: updateMatchDataError } = await dbClient
                    .from('matches')
                    .update({
                        status: 'showing_results',
                        winner_id: matchWinnerId,
                    })
                    .eq('id', matchId)
                if (updateMatchDataError) {
                    console.error("Error updating match status to showing_results:", updateMatchDataError);
                    return { success: false, errorMessage: "Failed to update match status." };
                }
                // Sleep for 10 seconds to simulate showing results
                await new Promise(resolve => setTimeout(resolve, 10_000));

                // Update match status and winner in the 'matches' table
                const { error: updateError } = await dbClient
                    .from('matches')
                    .update({ winner_id: matchWinnerId, status: matchStatus, completed_at: new Date().toISOString() })
                    .eq('id', matchId);

                if (updateError) {
                    console.error("Error updating match status and winner:", updateError);
                    return { success: false, errorMessage: "Failed to update match status." };
                }

                console.log(`Match ${matchId} completed. Winner: User ${matchWinnerId}.`);

                // Increment matches_won/lost for users using dbClient.rpc directly
                const { error: wonError } = await dbClient.rpc('increment_matches_won', { p_user_id: matchWinnerId });
                if (wonError) console.error("Error incrementing matches_won:", wonError);

                const loserId = matchWinnerId === player1Id ? player2Id : player1Id;
                const { error: lostError } = await dbClient.rpc('increment_matches_lost', { p_user_id: loserId });
                if (lostError) console.error("Error incrementing matches_lost:", lostError);


                // Check if it's a tournament match and trigger advancement logic
                const { data: matchData, error: mError } = await dbClient
                    .from('matches')
                    .select('*')
                    .eq('id', matchId)
                    .single();

                if (!mError && matchData) {
                    if (matchData.tournament_id) {
                        console.log(`Match ${matchId} is part of tournament ${matchData.tournament_id}. Processing immediate advancement.`);

                        // ✅ NEW: Use bracket-style immediate advancement
                        const { success: advanceSuccess, errorMessage: advanceError } =
                            await BracketTournamentManager.processMatchCompletion(matchId, matchWinnerId);

                        if (!advanceSuccess) {
                            console.error(`Failed to advance tournament ${matchData.tournament_id}:`, advanceError);
                            // Don't fail the match completion, just log the error
                        }

                        // ✅ IMPORTANT: Remove the old cleanup logic for tournament matches
                        // Tournament participants are handled by the bracket manager now
                        // Losers are eliminated immediately, winners advance to next match

                    } else if (matchData.lobby_id && !matchData.tournament_id) {
                        // Keep existing 1v1 logic unchanged
                        const { error: uMatchCompletedErr } = await dbClient
                            .from('matches')
                            .update({
                                status: 'completed',
                                winner_id: matchWinnerId
                            })
                            .eq('id', matchId);

                        if (uMatchCompletedErr) {
                            console.error(`Error updating match ${matchId} status to completed:`, uMatchCompletedErr);
                            return { success: false, errorMessage: "Failed to update match status to completed." };
                        }

                        // Process 1v1 payout
                        const payoutResult = await VaultController.processPayoutDuel(matchId);

                        // Sleep for 10 seconds to display to the user that he won
                        await new Promise(resolve => setTimeout(resolve, 10_000));

                        if (!payoutResult) {
                            console.error(`Error processing payout for match ${matchId} to winner ${matchWinnerId}`);
                            return { success: false, errorMessage: "Failed to process payout." };
                        }

                        // Clean up 1v1 lobby system
                        const { error: cleanupError } = await dbClient
                            .from('lobby_participants')
                            .delete()
                            .eq('lobby_id', matchData.lobby_id);

                        if (cleanupError) {
                            console.error(`Error cleaning up lobby participants for lobby ${matchData.lobby_id}:`, cleanupError);
                        } else {
                            console.log(`Successfully cleaned up lobby participants for lobby ${matchData.lobby_id}.`);
                        }

                        const { error: matchParticipantsCleanupError } = await dbClient
                            .from('match_participants')
                            .delete()
                            .eq('match_id', matchId);

                        if (matchParticipantsCleanupError) {
                            console.error(`Error cleaning up match participants for match ${matchId}:`, matchParticipantsCleanupError);
                        } else {
                            console.log(`Successfully cleaned up match participants for match ${matchId}.`);
                        }

                        const { error: lobbyCleanupError } = await dbClient
                            .from('lobbies')
                            .delete()
                            .eq('id', matchData.lobby_id);

                        if (lobbyCleanupError) {
                            console.error(`Error cleaning up lobby ${matchData.lobby_id}:`, lobbyCleanupError);
                        } else {
                            console.log(`Successfully cleaned up lobby ${matchData.lobby_id}.`);
                        }
                    }
                } else if (mError) {
                    console.error("Error fetching match data for post-completion actions:", mError);
                }


                return { success: true, matchWinnerId: matchWinnerId };
            } else {
                console.log(`Match ${matchId} still in progress. Current scores: P1: ${player1Wins}, P2: ${player2Wins}. Rounds played: ${gameRounds.length}`);
                return { success: true, matchWinnerId: null }; // Match is not yet completed
            }

        } catch (error) {
            console.error("processMatch error:", error);
            return { success: false, errorMessage: "Internal Server Error." };
        }
    }

    static async advanceTournament(tournamentId: number): Promise<{ success: boolean, tournamentWinnerId?: number | null, errorMessage?: string }> {
        console.log(`Advancing tournament ${tournamentId}.`);

        // Add a simple lock mechanism using database transaction
        const lockKey = `tournament_advance_${tournamentId}`;

        try {
            // Get tournament details
            const { data: tournament, error: tournamentFetchError } = await dbClient
                .from('tournaments')
                .select('id, max_players, current_players, status')
                .eq('id', tournamentId)
                .single();

            if (tournamentFetchError || !tournament) {
                console.error(`Tournament ${tournamentId} not found or error fetching details:`, tournamentFetchError);
                return { success: false, errorMessage: "Tournament not found." };
            }

            if (tournament.status === 'completed') {
                console.log(`Tournament ${tournamentId} is already completed.`);
                return { success: true, tournamentWinnerId: null };
            }

            // ✅ FIX 1: Check for BOTH 'in_progress' AND 'showing_results' matches
            const { data: activeMatches, error: activeMatchesError } = await dbClient
                .from('matches')
                .select('id, status')
                .eq('tournament_id', tournamentId)
                .in('status', ['in_progress', 'showing_results', 'waiting']); // ✅ Include showing_results

            if (activeMatchesError) {
                console.error(`Error fetching active matches for tournament ${tournamentId}:`, activeMatchesError);
                return { success: false, errorMessage: "Failed to fetch active matches." };
            }

            // If there are still active matches, don't advance yet
            if (activeMatches && activeMatches.length > 0) {
                console.log(`Tournament ${tournamentId}: Still has ${activeMatches.length} active matches. Not advancing yet.`);
                return { success: true, tournamentWinnerId: null };
            }

            // Get all completed matches for this tournament that have a winner
            const { data: completedMatches, error: matchesError } = await dbClient
                .from('matches')
                .select('id, winner_id')
                .eq('tournament_id', tournamentId)
                .eq('status', 'completed')
                .not('winner_id', 'is', null);

            if (matchesError) {
                console.error(`Error fetching completed matches for tournament ${tournamentId}:`, matchesError);
                return { success: false, errorMessage: "Failed to fetch completed matches." };
            }

            // Fetch all tournament participants to track elimination status
            const { data: allTournamentParticipants, error: allParticipantsError } = await dbClient
                .from('tournament_participants')
                .select('user_id, eliminated_at')
                .eq('tournament_id', tournamentId);

            if (allParticipantsError) {
                console.error(`Error fetching all tournament participants for tournament ${tournamentId}:`, allParticipantsError);
                return { success: false, errorMessage: "Failed to fetch all tournament participants." };
            }

            // 1. Mark losers as eliminated (only if not already eliminated)
            for (const match of completedMatches) {
                const { data: matchParticipants, error: mpError } = await dbClient
                    .from('match_participants')
                    .select('user_id')
                    .eq('match_id', match.id);

                if (!mpError && matchParticipants && match.winner_id !== null) {
                    const loser = matchParticipants.find(p => p.user_id !== match.winner_id);
                    if (loser) {
                        const existingLoserEntry = allTournamentParticipants.find(p => p.user_id === loser.user_id);
                        if (existingLoserEntry && existingLoserEntry.eliminated_at === null) {
                            const { error: updateError } = await dbClient
                                .from('tournament_participants')
                                .update({ eliminated_at: new Date().toISOString() })
                                .eq('tournament_id', tournamentId)
                                .eq('user_id', loser.user_id);

                            if (updateError) {
                                console.error(`Failed to eliminate user ${loser.user_id} from tournament ${tournamentId}:`, updateError);
                            } else {
                                console.log(`User ${loser.user_id} eliminated from tournament ${tournamentId}.`);
                            }
                        }
                    }
                }
            }

            // Re-fetch active participants AFTER eliminations
            const { data: activeParticipants, error: activeParticipantsError } = await dbClient
                .from('tournament_participants')
                .select('user_id')
                .eq('tournament_id', tournamentId)
                .is('eliminated_at', null);

            if (activeParticipantsError) {
                console.error(`Error re-fetching active participants for tournament ${tournamentId}:`, activeParticipantsError);
                return { success: false, errorMessage: "Failed to re-fetch active participants after eliminations." };
            }

            const numActivePlayers = activeParticipants.length;
            console.log(`Tournament ${tournamentId}: Active players after eliminations: ${numActivePlayers}`);

            // 2. Determine tournament winner or create next round matches
            if (numActivePlayers === 1) {
                // Tournament completed - we have a winner!
                const finalWinnerId = activeParticipants[0].user_id;
                console.log(`Tournament ${tournamentId} completed. Winner: User ${finalWinnerId}.`);

                await dbClient.from('tournaments').update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    winner_id: finalWinnerId
                }).eq('id', tournamentId);

                await GameController.updateTournamentFinalPositions(tournamentId, finalWinnerId);

                // Process tournament payout
                const result = await VaultController.processPayoutTournamentSingle(tournamentId);
                if (!result) {
                    console.error(`Error processing payout for tournament ${tournamentId} to winner ${finalWinnerId}.`);
                    return { success: false, errorMessage: "Failed to process tournament payout." };
                }

                return { success: true, tournamentWinnerId: finalWinnerId };

            } else if (numActivePlayers >= 2 && numActivePlayers % 2 === 0) {
                // ✅ FIX 2: Double-check no new matches exist for these participants
                const existingNewMatches = await GameController.checkExistingMatchesForParticipants(tournamentId, activeParticipants);

                if (existingNewMatches.length > 0) {
                    console.log(`Tournament ${tournamentId}: Found ${existingNewMatches.length} existing matches for current participants. Not creating new matches.`);
                    return { success: true, tournamentWinnerId: null };
                }

                console.log(`Tournament ${tournamentId}: Creating next round matches with ${numActivePlayers} active players.`);

                // ✅ FIX 3: Add transaction-like behavior to prevent duplicate match creation
                const { success: matchesCreated, errorMessage: createMatchesError } = await GameController.generateTournamentMatchesSafe(tournamentId, activeParticipants);

                if (!matchesCreated) {
                    console.error(`Failed to create next round matches for tournament ${tournamentId}:`, createMatchesError);
                    return { success: false, errorMessage: "Failed to advance tournament to next round." };
                }

                return { success: true, tournamentWinnerId: null };

            } else {
                console.log(`Tournament ${tournamentId}: Waiting for more eliminations. Active players: ${numActivePlayers}`);
                return { success: true, tournamentWinnerId: null };
            }

        } catch (error) {
            console.error("advanceTournament error:", error);
            return { success: false, errorMessage: "Internal Server Error." };
        }
    }
    // #endregion Game Logic



    // #region Tournament Management
    static async addTournamentParticipant(tournamentId: number, userId: number): Promise<{ success: boolean, errorMessage?: string }> {
        try {
            // Check if tournament exists and is in 'waiting' status and not full
            const { data: tournament, error: tournamentError } = await dbClient
                .from('tournaments')
                .select('id, status, current_players, max_players')
                .eq('id', tournamentId)
                .single();

            if (tournamentError || !tournament) {
                return { success: false, errorMessage: "Tournament not found." };
            }
            if (tournament.status !== 'waiting') {
                return { success: false, errorMessage: "Tournament is not in 'waiting' status and cannot be joined." };
            }
            if (tournament.current_players! >= tournament.max_players!) {
                return { success: false, errorMessage: "Tournament is full." };
            }

            // Check if user is already in this tournament
            const { data: existingParticipant, error: existingParticipantError } = await dbClient
                .from('tournament_participants')
                .select('id')
                .eq('tournament_id', tournamentId)
                .eq('user_id', userId)
                .single();

            if (existingParticipant) {
                return { success: false, errorMessage: "User is already a participant in this tournament." };
            }
            if (existingParticipantError && existingParticipantError.code !== 'PGRST116') { // PGRST116 = no rows found
                console.error("Error checking existing tournament participant:", existingParticipantError);
                return { success: false, errorMessage: "Database error checking participant." };
            }

            // Add participant
            const participantData: TablesInsert<'tournament_participants'> = {
                tournament_id: tournamentId,
                user_id: userId,
                joined_at: new Date().toISOString(),
                is_ready: false, // Assuming 'is_ready' might be a future field
                has_staked: false, // Assuming 'has_staked' might be a future field
            };

            const { error: insertError } = await dbClient
                .from('tournament_participants')
                .insert([participantData]);

            if (insertError) {
                console.error("Error inserting tournament participant:", insertError);
                return { success: false, errorMessage: "Failed to add tournament participant." };
            }

            // Update current_players count in tournaments table
            const { error: updateError } = await dbClient
                .from('tournaments')
                .update({ current_players: tournament.current_players! + 1 })
                .eq('id', tournamentId);

            if (updateError) {
                console.error("Error updating tournament player count:", updateError);
                // Consider rolling back participant insertion if this fails
                return { success: false, errorMessage: "Failed to update tournament player count." };
            }

            return { success: true };

        } catch (error) {
            console.error("addTournamentParticipant error:", error);
            return { success: false, errorMessage: "Internal Server Error." };
        }
    }

    static async createTournament(req: Request, res: Response) {
        try {
            // Updated: Removed prize_pool from destructuring, added stake_amount
            const { name, created_by, max_players, stake_amount } = req.body;

            // Updated: Validate required fields based on new input
            if (!name || !created_by || !max_players || !stake_amount) {
                return res.status(400).json({ error: "Missing required tournament fields: name, created_by, max_players, stake_amount." });
            }

            // Updated: Validate max_players to be strictly 4 or 8
            const allowedMaxPlayers = [4, 8];
            if (!allowedMaxPlayers.includes(max_players)) {
                return res.status(400).json({ error: `Invalid max_players. Must be either ${allowedMaxPlayers.join(' or ')}.` });
            }

            // Validate stake_amount against allowed values (from lobby_migration.sql or similar standard)
            const allowedStakes = ['100000000', '250000000', '500000000', '750000000', '1000000000'];
            if (!allowedStakes.includes(stake_amount.toString())) {
                return res.status(400).json({ error: `Invalid stake amount. Allowed values: ${allowedStakes.join(', ')}` });
            }

            // Calculate prize_pool based on stake_amount and max_players
            const calculatedPrizePool = (parseInt(stake_amount) * max_players).toString();

            // Check if the user is already in an active tournament
            const { data: existingTournamentParticipant, error: participantError } = await dbClient
                .from('tournament_participants')
                .select('id')
                .eq('user_id', created_by)
                .is('eliminated_at', null) // Not yet eliminated
                .limit(1);

            if (existingTournamentParticipant && existingTournamentParticipant.length > 0) {
                return res.status(409).json({ error: "User is already participating in another active tournament." });
            }

            const tournamentData: TablesInsert<'tournaments'> = {
                name: name,
                created_by: created_by,
                max_players: max_players,
                // Updated: Use the calculated prize_pool
                prize_pool: calculatedPrizePool,
                current_players: 0, // Initialize with 0, creator will join explicitly
                status: 'waiting',
            };

            const { data, error } = await dbClient
                .from('tournaments')
                .insert([tournamentData])
                .select()
                .single();

            if (error) {
                console.error("Error creating tournament:", error);
                return res.status(500).json({ error: "Failed to create tournament." });
            }

            // Automatically add the creator as a participant
            const { success: participantAdded, errorMessage: participantAddError } = await GameController.addTournamentParticipant(data.id, created_by);

            if (!participantAdded) {
                console.error("Error adding creator to tournament participants:", participantAddError);
                await dbClient.from('tournaments').delete().eq('id', data.id); // Rollback tournament creation
                return res.status(500).json({ error: `Failed to add creator to tournament: ${participantAddError}` });
            }

            res.status(201).json({
                message: "Tournament created successfully",
                tournament: data
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error." });
        }
    }

    static async joinTournament(req: Request, res: Response) {
        try {
            const { tournament_id, user_id } = req.body;

            if (!tournament_id || !user_id) {
                return res.status(400).json({ error: "Missing required fields: tournament_id, user_id." });
            }

            const { success, errorMessage } = await GameController.addTournamentParticipant(tournament_id, user_id);

            if (!success) {
                return res.status(400).json({ error: errorMessage });
            }

            res.status(200).json({ message: "Joined tournament successfully." });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error." });
        }
    }

    static async listTournaments(req: Request, res: Response) {
        try {
            const { status } = req.query; // Optional filter by status

            let query = dbClient.from('tournaments').select('*');

            if (status && typeof status === 'string') {
                query = query.eq('status', status);
            }

            const { data: tournaments, error } = await query.order('created_at', { ascending: false });

            if (error) {
                console.error("Error listing tournaments:", error);
                return res.status(500).json({ error: "Failed to retrieve tournaments." });
            }

            res.status(200).json({ tournaments: tournaments });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error." });
        }
    }

    static async getTournamentBracket(req: Request, res: Response) {
        try {
            const { tournament_id } = req.params;

            if (!tournament_id) {
                return res.status(400).json({ error: "Missing tournament_id" });
            }

            const bracket = await BracketTournamentManager.getTournamentBracket(parseInt(tournament_id));

            res.status(200).json({ bracket });

        } catch (error) {
            console.error("Error fetching tournament bracket:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
    // #endregion Tournament Management



    // #region Lobby Actions
    static async submitStakeForLobby(req: Request, res: Response) {
        try {
            console.log('Received payload for lobby stake submission:', req.body);
            const { user_id, lobby_id, txHash } = req.body;
    
            if (!user_id || !lobby_id || !txHash) {
                return res.status(400).json({ error: "Missing required fields: user_id, lobby_id, txHash" });
            }
    
            // Add delay to ensure transaction is confirmed on blockchain
            await new Promise(resolve => setTimeout(resolve, 1500));
    
            // First, call the atomic database function to update staking status
            const { data, error } = await dbClient.rpc('submit_stake_atomic', {
                p_lobby_id: lobby_id,
                p_user_id: user_id,
                p_tx_hash: txHash
            });
    
            if (error) {
                console.error("Error calling submit_stake_atomic:", error);
                return res.status(500).json({ error: "Database function call failed" });
            }
    
            const result = data as { 
                success: boolean; 
                error?: string; 
                message?: string; 
                lobby_id?: number;
                user_id?: number;
                stake_amount?: string;
                transaction_hash?: string;
                is_tournament_lobby?: boolean;
            };
    
            if (!result.success) {
                // Handle specific error cases with appropriate HTTP status codes
                if (result.error?.includes('already used')) {
                    return res.status(409).json({ error: result.error });
                }
                if (result.error?.includes('not found')) {
                    return res.status(404).json({ error: result.error });
                }
                if (result.error?.includes('already staked')) {
                    return res.status(400).json({ error: result.error });
                }
                if (result.error?.includes('not accepting')) {
                    return res.status(400).json({ error: result.error });
                }
                
                return res.status(400).json({ error: result.error });
            }
    
            // Now validate the blockchain transaction
            console.log(`Validating blockchain transaction for user ${user_id} in lobby ${lobby_id}`);
            const isDepositValid = await VaultController.validateDepositLobbyCreation(
                txHash, 
                user_id, 
                lobby_id
            );
    
            if (!isDepositValid) {
                console.error("Blockchain transaction validation failed for stake submission.");
                
                // If blockchain validation fails, we need to rollback the database changes
                try {
                    // Rollback the participant staking status
                    await dbClient
                        .from('lobby_participants')
                        .update({
                            has_staked: false,
                            is_ready: false,
                            stake_transaction_hash: null,
                            staked_at: null
                        })
                        .eq('lobby_id', lobby_id)
                        .eq('user_id', user_id);
    
                    // Rollback tournament participant if applicable
                    if (result.is_tournament_lobby) {
                        const { data: lobby } = await dbClient
                            .from('lobbies')
                            .select('tournament_id')
                            .eq('id', lobby_id)
                            .single();
                        
                        if (lobby?.tournament_id) {
                            await dbClient
                                .from('tournament_participants')
                                .update({
                                    has_staked: false,
                                    is_ready: false
                                })
                                .eq('tournament_id', lobby.tournament_id)
                                .eq('user_id', user_id);
                        }
                    }
    
                    // Remove the stake transaction record
                    await dbClient
                        .from('stake_transactions')
                        .delete()
                        .eq('transaction_hash', txHash);
    
                    // Remove from used_transactions
                    await dbClient
                        .from('used_transactions')
                        .delete()
                        .eq('tx_hash', txHash);
    
                } catch (rollbackError) {
                    console.error("Failed to rollback after validation failure:", rollbackError);
                }
                
                return res.status(400).json({ 
                    error: "Blockchain transaction validation failed. Stake not recorded." 
                });
            }
    
            // Success! Both database and blockchain validation passed
            console.log(`User ${user_id} successfully staked in lobby ${lobby_id} with transaction ${txHash}`);
    
            res.status(201).json({
                message: result.message,
                lobby_id: result.lobby_id,
                user_id: result.user_id,
                stake_amount: result.stake_amount,
                transaction_hash: result.transaction_hash,
                is_tournament_lobby: result.is_tournament_lobby,
                blockchain_validated: true
            });
    
        } catch (error) {
            console.error("Error submitting stake for lobby:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    static async createLobby(req: Request, res: Response) {
        try {
            console.log('Received payload for lobby creation:', req.body);
            const { name, created_by, stake_amount, max_players, tx_hash } = req.body;
    
            if (!created_by || !stake_amount || !max_players || !tx_hash) {
                return res.status(400).json({ error: "Missing required fields: created_by, stake_amount, max_players, tx_hash" });
            }
    
            // FIXED: Use the correct function that marks creator as staked
            const { data, error } = await dbClient.rpc('create_lobby_with_tournament_atomic', {
                p_name: name,
                p_created_by: created_by,
                p_stake_amount: stake_amount,
                p_max_players: max_players,
                p_tx_hash: tx_hash
            });
    
            if (error) {
                console.error("Error calling create_lobby_with_tournament_atomic:", error);
                return res.status(500).json({ error: "Database function call failed" });
            }
    
            const result = data as { 
                success: boolean; 
                error?: string; 
                lobby_id?: number; 
                tournament_id?: number;
                participant_id?: number;
                is_tournament_lobby?: boolean;
                message?: string;
            };
    
            if (!result.success) {
                if (result.error?.includes('already used')) {
                    return res.status(409).json({ error: result.error });
                }
                if (result.error?.includes('available') || result.error?.includes('Invalid')) {
                    return res.status(400).json({ error: result.error });
                }
                return res.status(400).json({ error: result.error });
            }
    
            // Add delay before validation
            await new Promise(resolve => setTimeout(resolve, 2000));
    
            // Validate the transaction using VaultController
            const isDepositValid = await VaultController.validateDepositLobbyCreation(
                tx_hash, 
                created_by, 
                result.lobby_id!
            );
    
            if (!isDepositValid) {
                console.error("Deposit validation failed for lobby creation.");
                
                try {
                    await dbClient.rpc('cleanup_failed_lobby_creation', {
                        p_lobby_id: result.lobby_id,
                        p_tournament_id: result.tournament_id,
                        p_user_id: created_by,
                        p_tx_hash: tx_hash
                    });
                } catch (cleanupError) {
                    console.error("Failed to cleanup after validation failure:", cleanupError);
                }
                
                return res.status(400).json({ 
                    error: "Transaction validation failed. Lobby creation cancelled." 
                });
            }
    
            console.log(`User ${created_by} created ${result.is_tournament_lobby ? 'tournament ' : ''}lobby ${result.lobby_id} successfully.`);
    
            res.status(201).json({
                message: result.message,
                lobby_id: result.lobby_id,
                tournament_id: result.tournament_id,
                participant_id: result.participant_id,
                is_tournament_lobby: result.is_tournament_lobby
            });
    
        } catch (error) {
            console.error("createLobby error:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    static async joinLobby(req: Request, res: Response) {
        try {
            console.log('Received payload for joining lobby:', req.body);
            const { lobby_id, user_id } = req.body;
    
            if (!lobby_id || !user_id) {
                return res.status(400).json({ error: "Missing required fields: lobby_id, user_id" });
            }
    
            // Call the atomic PostgreSQL function
            const { data, error } = await dbClient
                .rpc('join_lobby_as_user_atomic', {
                    p_lobby_id: lobby_id,
                    p_user_id: user_id
                });
    
            if (error) {
                console.error("Error calling join_lobby_atomic:", error);
                return res.status(500).json({ error: "Database function call failed" });
            }
    
            const result = data as { success: boolean; error?: string; message?: string; participant_id?: number; lobby_id?: number; current_players?: number; is_tournament_lobby?: boolean };
    
            if (!result.success) {
                // Handle specific error cases with appropriate HTTP status codes
                if (result.error?.includes('already in')) {
                    return res.status(409).json({ error: result.error });
                }
                if (result.error?.includes('full') || result.error?.includes('not joinable')) {
                    return res.status(400).json({ error: result.error });
                }
                if (result.error?.includes('not found')) {
                    return res.status(404).json({ error: result.error });
                }
                
                // Generic error
                return res.status(400).json({ error: result.error });
            }
    
            // Successfully joined lobby
            console.log(`User ${user_id} joined lobby ${lobby_id} successfully.`);
    
            res.status(200).json({
                message: result.message,
                participant_id: result.participant_id,
                lobby_id: result.lobby_id,
                current_players: result.current_players,
                is_tournament_lobby: result.is_tournament_lobby
            });
    
        } catch (error) {
            console.error("joinLobby error:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    static async withdrawFromLobby(req: Request, res: Response) {
        try {
            console.log('Received payload for lobby withdrawal:', req.body);
            const { user_id, lobby_id } = req.body;
    
            if (!user_id || !lobby_id) {
                return res.status(400).json({ error: "Missing required fields: user_id, lobby_id" });
            }
    
            // Call the atomic PostgreSQL function
            const { data, error } = await dbClient.rpc('withdraw_from_lobby_atomic', {
                p_lobby_id: lobby_id,
                p_user_id: user_id
            });
    
            if (error) {
                console.error("Error calling withdraw_from_lobby_atomic:", error);
                return res.status(500).json({ error: "Database function call failed" });
            }
    
            const result = data as { 
                success: boolean; 
                error?: string; 
                message?: string; 
                lobby_disbanded?: boolean;
                remaining_players?: number;
                was_tournament_lobby?: boolean;
                withdrawal_info?: {
                    user_id: number;
                    solana_address: string;
                    stake_amount_lamports: string;
                    stake_amount_sol: number;
                    original_stake_tx_hash: string;
                };
            };
    
            if (!result.success) {
                // Handle specific error cases with appropriate HTTP status codes
                if (result.error?.includes('not found')) {
                    return res.status(404).json({ error: result.error });
                }
                if (result.error?.includes('not in a valid state')) {
                    return res.status(400).json({ error: result.error });
                }
                if (result.error?.includes('has not staked')) {
                    return res.status(400).json({ error: result.error });
                }
                
                return res.status(400).json({ error: result.error });
            }
    
            // Process blockchain withdrawal if withdrawal info is provided
            let withdrawal_successful = false;
            let blockchain_tx_hash: string | null = null;
    
            if (result.withdrawal_info) {
                console.log(`Processing blockchain withdrawal for user ${result.withdrawal_info.user_id}: ${result.withdrawal_info.stake_amount_sol} SOL`);
                
                try {
                    // Use AdminWallet to process the withdrawal
                    blockchain_tx_hash = await AdminWallet.processWithdrawal(
                        result.withdrawal_info.solana_address, 
                        result.withdrawal_info.stake_amount_sol
                    );
    
                    if (blockchain_tx_hash) {
                        withdrawal_successful = true;
                        console.log(`✅ Withdrawal successful for user ${result.withdrawal_info.user_id}: ${blockchain_tx_hash}`);
                        
                        // Update withdrawal transaction status with blockchain hash
                        try {
                            await dbClient.rpc('update_withdrawal_transaction_status', {
                                p_lobby_id: lobby_id,
                                p_user_id: user_id,
                                p_blockchain_tx_hash: blockchain_tx_hash,
                                p_status: 'completed'
                            });
                        } catch (updateError) {
                            console.error(`Failed to update withdrawal status for user ${user_id}:`, updateError);
                        }
                    } else {
                        console.error(`❌ Blockchain withdrawal failed for user ${result.withdrawal_info.user_id}`);
                        
                        // Mark withdrawal as failed in database
                        try {
                            await dbClient.rpc('update_withdrawal_transaction_status', {
                                p_lobby_id: lobby_id,
                                p_user_id: user_id,
                                p_blockchain_tx_hash: null,
                                p_status: 'failed'
                            });
                        } catch (updateError) {
                            console.error(`Failed to update failed withdrawal status for user ${user_id}:`, updateError);
                        }
                    }
                } catch (withdrawalError) {
                    console.error(`Withdrawal processing error for user ${result.withdrawal_info.user_id}:`, withdrawalError);
                    
                    // Mark withdrawal as failed
                    try {
                        await dbClient.rpc('update_withdrawal_transaction_status', {
                            p_lobby_id: lobby_id,
                            p_user_id: user_id,
                            p_blockchain_tx_hash: null,
                            p_status: 'failed'
                        });
                    } catch (updateError) {
                        console.error(`Failed to update failed withdrawal status for user ${user_id}:`, updateError);
                    }
                }
            }
    
            // Determine response status and message
            let response_message = result.message || 'Withdrawal processed';
            let response_status = 200;
    
            if (result.withdrawal_info) {
                if (withdrawal_successful) {
                    response_message = `Withdrawal successful. ${result.withdrawal_info.stake_amount_sol} SOL sent to your wallet.`;
                    if (result.lobby_disbanded) {
                        response_message += ' Lobby was disbanded as you were the last player.';
                    }
                } else {
                    response_message = 'Database withdrawal completed but blockchain transaction failed. Manual intervention required.';
                    response_status = 207; // Multi-status
                }
            }
    
            console.log(`User ${user_id} withdrew from lobby ${lobby_id}. Blockchain success: ${withdrawal_successful}, Lobby disbanded: ${result.lobby_disbanded}`);
    
            res.status(response_status).json({
                message: response_message,
                withdrawal_successful,
                blockchain_tx_hash,
                lobby_disbanded: result.lobby_disbanded || false,
                remaining_players: result.remaining_players || 0,
                was_tournament_lobby: result.was_tournament_lobby || false,
                stake_amount_sol: result.withdrawal_info?.stake_amount_sol || 0
            });
    
        } catch (error) {
            console.error("withdrawFromLobby error:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    static async kickPlayer(req: Request, res: Response) {
        try {
            console.log('Received payload for kicking player:', req.body);
            const { lobby_id, creator_user_id, player_to_kick_id } = req.body;
    
            if (!lobby_id || !creator_user_id || !player_to_kick_id) {
                return res.status(400).json({ error: "Missing required fields: lobby_id, creator_user_id, player_to_kick_id" });
            }
    
            // Call the atomic PostgreSQL function
            const { data, error } = await dbClient
                .rpc('kick_player_as_admin_atomic', {
                    p_lobby_id: lobby_id,
                    p_admin_user_id: creator_user_id,
                    p_player_id: player_to_kick_id
                });
    
            if (error) {
                console.error("Error calling kick_player_atomic:", error);
                return res.status(500).json({ error: "Database function call failed" });
            }
    
            const result = data as { 
                success: boolean; 
                error?: string; 
                message?: string; 
                disbanded?: boolean; 
                remaining_players?: number;
                was_tournament_lobby?: boolean;
                kicked_player_id?: number;
            };
    
            if (!result.success) {
                // Handle specific error cases with appropriate HTTP status codes
                if (result.error?.includes('not found')) {
                    return res.status(404).json({ error: result.error });
                }
                if (result.error?.includes('Only lobby creator')) {
                    return res.status(403).json({ error: result.error });
                }
                if (result.error?.includes('already staked') || result.error?.includes('closing') || result.error?.includes('Cannot kick yourself')) {
                    return res.status(400).json({ error: result.error });
                }
                
                // Generic error
                return res.status(400).json({ error: result.error });
            }
    
            // Successfully kicked player
            console.log(`User ${creator_user_id} kicked player ${player_to_kick_id} from lobby ${lobby_id}.`);
    
            res.status(200).json({
                message: result.message,
                disbanded: result.disbanded,
                remaining_players: result.remaining_players,
                was_tournament_lobby: result.was_tournament_lobby,
                kicked_player_id: result.kicked_player_id
            });
    
        } catch (error) {
            console.error("kickPlayer error:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    /**
     * @deprecated Use closeLobby instead 
     */
    static async deleteLobby(req: Request, res: Response) {
        try {
            const { lobby_id, admin_user_id } = req.body;

            if (!lobby_id || !admin_user_id) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            // Use the new atomic function
            const { data, error } = await dbClient.rpc('close_lobby_atomic', {
                p_lobby_id: lobby_id,
                p_admin_user_id: admin_user_id
            });

            if (error) {
                console.error("Error closing lobby:", error);
                return res.status(500).json({ error: error.message });
            }

            if (!data.success) {
                return res.status(400).json({ error: data.error });
            }

            res.status(200).json({
                message: "Lobby closed successfully",
                refunds_created: data.refunds_created
            });
        } catch (error) {
            console.error("Error in deleteLobby:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    static async leaveLobby(req: Request, res: Response) {
        try {
            console.log('Received payload for leaving lobby:', req.body);
            const { user_id, lobby_id } = req.body;
    
            if (!user_id || !lobby_id) {
                return res.status(400).json({ error: "Missing required fields: user_id, lobby_id" });
            }
    
            // Call the atomic PostgreSQL function
            const { data, error } = await dbClient
                .rpc('leave_lobby_as_user_atomic', {
                    p_lobby_id: lobby_id,
                    p_user_id: user_id
                });
    
            if (error) {
                console.error("Error calling leave_lobby_atomic:", error);
                return res.status(500).json({ error: "Database function call failed" });
            }
    
            const result = data as { 
                success: boolean; 
                error?: string; 
                message?: string; 
                disbanded?: boolean; 
                remaining_players?: number;
                was_tournament_lobby?: boolean;
            };
    
            if (!result.success) {
                // Handle specific error cases with appropriate HTTP status codes
                if (result.error?.includes('not found')) {
                    return res.status(404).json({ error: result.error });
                }
                if (result.error?.includes('after staking') || result.error?.includes('closing')) {
                    return res.status(400).json({ error: result.error });
                }
                
                // Generic error
                return res.status(400).json({ error: result.error });
            }
    
            // Successfully left lobby
            console.log(`User ${user_id} left lobby ${lobby_id} successfully.`);
    
            res.status(200).json({
                message: result.message,
                disbanded: result.disbanded,
                remaining_players: result.remaining_players,
                was_tournament_lobby: result.was_tournament_lobby
            });
    
        } catch (error) {
            console.error("leaveLobby error:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    static async closeLobby(req: Request, res: Response) {
        try {
            console.log('Received payload for lobby closure:', req.body);
            const { lobby_id, user_id } = req.body;
    
            if (!lobby_id || !user_id) {
                return res.status(400).json({ error: "Missing required fields: lobby_id, user_id" });
            }
    
            // Use the FIXED close function that handles creators not marked as staked
            const { data, error } = await dbClient.rpc('close_lobby_atomic_fixed', {
                p_lobby_id: lobby_id,
                p_admin_user_id: user_id
            });
    
            if (error) {
                console.error("Error calling close_lobby_atomic_fixed:", error);
                return res.status(500).json({ error: "Database function call failed" });
            }
    
            const result = data as { 
                success: boolean; 
                error?: string; 
                refunds_created?: number; 
                participants_for_refund?: Array<{
                    user_id: number;
                    solana_address: string;
                    stake_amount_lamports: string;
                    stake_amount_sol: number;
                    was_marked_as_staked: boolean;
                    is_creator: boolean;
                }>;
                total_refund_amount_sol?: number;
                tournament_disbanded?: boolean;
                message?: string;
            };
    
            if (!result.success) {
                if (result.error?.includes('not found')) {
                    return res.status(404).json({ error: result.error });
                }
                if (result.error?.includes('Only lobby creator')) {
                    return res.status(403).json({ error: result.error });
                }
                if (result.error?.includes('already being closed')) {
                    return res.status(400).json({ error: result.error });
                }
                return res.status(400).json({ error: result.error });
            }
    
            // Process blockchain refunds if there are participants to refund
            let refund_results = {
                success: true,
                refund_transactions: [],
                failed_refunds: []
            };
    
            if (result.participants_for_refund && result.participants_for_refund.length > 0) {
                console.log(`Processing blockchain refunds for ${result.participants_for_refund.length} participants`);
                console.log('Participants:', result.participants_for_refund.map(p => ({
                    user_id: p.user_id,
                    is_creator: p.is_creator,
                    was_marked_as_staked: p.was_marked_as_staked,
                    amount: p.stake_amount_sol
                })));
                
                refund_results = await AdminWallet.processLobbyClosureRefunds(
                    result.participants_for_refund
                );
    
                // Update refund transaction records with blockchain transaction hashes
                for (const refund_tx of refund_results.refund_transactions) {
                    if (refund_tx.tx_hash) {
                        try {
                            await dbClient.rpc('update_refund_transaction_status', {
                                p_lobby_id: lobby_id,
                                p_user_id: refund_tx.user_id,
                                p_blockchain_tx_hash: refund_tx.tx_hash,
                                p_status: 'completed'
                            });
                        } catch (updateError) {
                            console.error(`Failed to update refund status for user ${refund_tx.user_id}:`, updateError);
                        }
                    }
                }
    
                // Mark failed refunds in database
                for (const failed_refund of refund_results.failed_refunds) {
                    try {
                        await dbClient.rpc('update_refund_transaction_status', {
                            p_lobby_id: lobby_id,
                            p_user_id: failed_refund.user_id,
                            p_blockchain_tx_hash: null,
                            p_status: 'failed'
                        });
                    } catch (updateError) {
                        console.error(`Failed to update failed refund status for user ${failed_refund.user_id}:`, updateError);
                    }
                }
            }
    
            // Determine response based on refund results
            const all_refunds_successful = refund_results.failed_refunds.length === 0;
            const some_refunds_failed = refund_results.failed_refunds.length > 0 && refund_results.refund_transactions.length > 0;
            const all_refunds_failed = refund_results.failed_refunds.length > 0 && refund_results.refund_transactions.length === 0;
    
            let response_message = result.message || 'Lobby closed successfully';
            let response_status = 200;
    
            if (result.refunds_created && result.refunds_created > 0) {
                if (all_refunds_successful) {
                    response_message = `Lobby closed successfully. All ${result.refunds_created} refunds processed.`;
                } else if (some_refunds_failed) {
                    response_message = `Lobby closed with ${refund_results.refund_transactions.length}/${result.refunds_created} refunds successful. ${refund_results.failed_refunds.length} refunds failed.`;
                    response_status = 207;
                } else if (all_refunds_failed) {
                    response_message = `Lobby closed but all ${result.refunds_created} refunds failed. Manual intervention required.`;
                    response_status = 500;
                }
            }
    
            console.log(`Lobby ${lobby_id} closed by user ${user_id}. Refunds: ${refund_results.refund_transactions.length} successful, ${refund_results.failed_refunds.length} failed.`);
    
            res.status(response_status).json({
                message: response_message,
                lobby_closed: true,
                refunds_created: result.refunds_created || 0,
                successful_refunds: refund_results.refund_transactions.length,
                failed_refunds: refund_results.failed_refunds.length,
                tournament_disbanded: result.tournament_disbanded || false,
                total_refund_amount_sol: result.total_refund_amount_sol || 0,
                debug_info: {
                    participants_found: result.participants_for_refund?.length || 0,
                    participants_details: result.participants_for_refund
                }
            });
    
        } catch (error) {
            console.error("closeLobby error:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
    
    // #endregion Lobby Actions



    // #region helpers
    // Helper to generate initial tournament matches
    private static async generateTournamentMatches(tournamentId: number, participants: { user_id: number }[]): Promise<{ success: boolean, errorMessage?: string }> {
        if (participants.length < 2) {
            return { success: false, errorMessage: "Not enough participants to generate matches." };
        }

        const { data: tournament, error: tournamentError } = await dbClient
            .from('tournaments')
            .select('prize_pool, max_players')
            .eq('id', tournamentId)
            .single()

        if (tournamentError || !tournament) {
            console.error("Error fetching tournament details:", tournamentError);
            return { success: false, errorMessage: "Failed to retrieve tournament details for match generation." };
        }

        const stakeAmount = Number(tournament.prize_pool) / Number(tournament.max_players);


        // Shuffle participants to randomize pairings
        const shuffledParticipants = [...participants].sort(() => 0.5 - Math.random());

        const matchesToInsert: TablesInsert<'matches'>[] = [];

        // For a simple bracket, pair participants for Round 1
        for (let i = 0; i < shuffledParticipants.length; i += 2) {
            if (i + 1 < shuffledParticipants.length) {
                matchesToInsert.push({
                    tournament_id: tournamentId,
                    status: 'waiting', // Matches start immediately
                    stake_amount: stakeAmount.toString(), // Could be derived from tournament prize_pool
                    total_prize_pool: tournament.prize_pool!, // Placeholder, actual prize pool distributed at tournament end
                    // started_at: new Date().toISOString(),
                    // Link participants directly or via match_participants after match creation
                });
            } else {
                // Handle odd number of players (e.g., byes or waiting for next round)
                // For a strict power-of-2 tournament, this shouldn't happen for initial round
                console.warn(`Tournament ${tournamentId} has an odd number of players. Player ${shuffledParticipants[i].user_id} gets a bye.`);
            }
        }

        if (matchesToInsert.length === 0) {
            return { success: false, errorMessage: "No matches generated for the tournament." };
        }

        const { data: newMatches, error: matchInsertError } = await dbClient
            .from('matches')
            .insert(matchesToInsert)
            .select();

        if (matchInsertError) {
            console.error("Error creating tournament matches:", matchInsertError);
            return { success: false, errorMessage: "Failed to create tournament matches." };
        }

        // Now, link participants to their respective matches
        let matchIndex = 0;
        const matchParticipantsInserts: TablesInsert<'match_participants'>[] = [];
        for (let i = 0; i < shuffledParticipants.length; i += 2) {
            if (i + 1 < shuffledParticipants.length && newMatches && newMatches[matchIndex]) {
                const matchId = newMatches[matchIndex].id;
                matchParticipantsInserts.push({
                    match_id: matchId,
                    user_id: shuffledParticipants[i].user_id,
                    position: 1,
                });
                matchParticipantsInserts.push({
                    match_id: matchId,
                    user_id: shuffledParticipants[i + 1].user_id,
                    position: 2,
                });
                matchIndex++;
            }
        }

        const { error: linkError } = await dbClient
            .from('match_participants')
            .insert(matchParticipantsInserts);

        if (linkError) {
            console.error("Error linking participants to tournament matches:", linkError);
            return { success: false, errorMessage: "Failed to link participants to tournament matches." };
        }

        // For each created match, create its first round
        for (const match of newMatches) {
            const { success: roundSuccess, errorMessage: roundError } = await GameController.createGameRound(match.id, 1);
            if (!roundSuccess) {
                console.error(`Failed to create first round for new tournament match ${match.id}:`, roundError);
                // Depending on criticality, you might want to rollback the match creation or log an error.
            }
        }


        return { success: true };
    }

    // Helper to update final positions of tournament participants
    private static async updateTournamentFinalPositions(tournamentId: number, winnerId: number) {
        try {
            // Set winner's position to 1
            await dbClient
                .from('tournament_participants')
                .update({ final_position: 1, eliminated_at: new Date().toISOString() })
                .eq('tournament_id', tournamentId)
                .eq('user_id', winnerId);

            // Get all other participants who are not yet eliminated
            const { data: remainingParticipants, error: remError } = await dbClient
                .from('tournament_participants')
                .select('user_id')
                .eq('tournament_id', tournamentId)
                .is('eliminated_at', null)
                .not('user_id', 'eq', winnerId);

            if (remError) {
                console.error("Error fetching remaining participants for final positions:", remError);
                return;
            }

            // For simplicity, assign positions in reverse order of elimination.
            // This is a placeholder; a true bracket system would track positions more precisely.
            const { data: eliminatedParticipants, error: elimError } = await dbClient
                .from('tournament_participants')
                .select('user_id, eliminated_at')
                .eq('tournament_id', tournamentId)
                .not('eliminated_at', 'is', null)
                .order('eliminated_at', { ascending: false }); // Latest eliminated first

            if (elimError) {
                console.error("Error fetching eliminated participants for final positions:", elimError);
                return;
            }

            let position = 2;
            for (const participant of eliminatedParticipants || []) {
                if (participant.user_id !== winnerId) {
                    await dbClient
                        .from('tournament_participants')
                        .update({ final_position: position })
                        .eq('tournament_id', tournamentId)
                        .eq('user_id', participant.user_id);
                    position++;
                }
            }

        } catch (error) {
            console.error("Error in updateTournamentFinalPositions:", error);
        }
    }

    private static async createGameRound(matchId: number, roundNumber: number): Promise<{ success: boolean, gameRoundId?: number, errorMessage?: string }> {
        console.log(`Attempting to create round ${roundNumber} for match ${matchId}`);
        try {


            // Check if the round already exists
            const { data: existingRound, error: existingRoundError } = await dbClient
                .from('game_rounds')
                .select('id')
                .eq('match_id', matchId)
                .eq('round_number', roundNumber)
                .single();

            if (existingRoundError && existingRoundError.code !== 'PGRST116') { // PGRST116 means "No rows found"
                console.error(`Error checking for existing round ${roundNumber} for match ${matchId}:`, existingRoundError);
                return { success: false, errorMessage: "Failed to check for existing round." };
            }

            if (existingRound) {
                console.log(`Round ${roundNumber} for match ${matchId} already exists (ID: ${existingRound.id}). Skipping creation.`);
                return { success: true, gameRoundId: existingRound.id };
            }

            // Get match details to ensure it's active and fetch participants if needed
            const { data: match, error: matchError } = await dbClient
                .from('matches')
                .select('status')
                .eq('id', matchId)
                .single();

            if (matchError || !match) {
                console.error(`Match ${matchId} not found or error fetching details:`, matchError);
                return { success: false, errorMessage: "Match not found." };
            }

            // Handle tournament matches in 'waiting' status
            if (match.status === 'waiting') {
                // Check if this is a tournament match with both participants
                const { data: participants, error: participantsError } = await dbClient
                    .from('match_participants')
                    .select('user_id')
                    .eq('match_id', matchId);

                if (participantsError) {
                    console.error(`Error fetching participants for match ${matchId}:`, participantsError);
                    return { success: false, errorMessage: "Failed to fetch match participants." };
                }

                // If tournament match has both participants, start it immediately
                if (participants && participants.length === 2) {
                    console.log(`Tournament match ${matchId} has both participants. Starting match...`);

                    const { error: statusUpdateError } = await dbClient
                        .from('matches')
                        .update({
                            status: 'in_progress',
                            started_at: new Date().toISOString()
                        })
                        .eq('id', matchId);

                    if (statusUpdateError) {
                        console.error(`Error updating match ${matchId} status to in_progress:`, statusUpdateError);
                        return { success: false, errorMessage: "Failed to start tournament match." };
                    }

                    console.log(`✅ Tournament match ${matchId} started successfully.`);
                } else {
                    console.log(`Match ${matchId} is waiting but only has ${participants?.length || 0} participants.`);
                    return { success: false, errorMessage: "Match is waiting for participants." };
                }
            } else if (match.status !== 'in_progress') {
                console.log(`Cannot create round for match ${matchId} because its status is '${match.status}'.`);
                return { success: false, errorMessage: "Match is not in a valid status for round creation." };
            }

            const newRound: TablesInsert<'game_rounds'> = {
                match_id: matchId,
                round_number: roundNumber,
                // player1_move, player2_move, winner_id will be set later
            };

            const { data, error } = await dbClient
                .from('game_rounds')
                .insert(newRound)
                .select('id')
                .single();

            if (error || !data) {
                console.error(`Error creating game round ${roundNumber} for match ${matchId}:`, error);
                return { success: false, errorMessage: "Failed to create game round." };
            }

            console.log(`Successfully created round ${roundNumber} for match ${matchId}. Round ID: ${data.id}`);
            return { success: true, gameRoundId: data.id };

        } catch (error) {
            console.error(`Error in createGameRound for match ${matchId}, round ${roundNumber}:`, error);
            return { success: false, errorMessage: "Internal Server Error during round creation." };
        }
    }

    private static async checkExistingMatchesForParticipants(tournamentId: number, participants: { user_id: number }[]): Promise<any[]> {
        if (participants.length === 0) return [];

        const participantIds = participants.map(p => p.user_id);

        // Check for any non-completed matches involving these participants
        const { data: existingMatches, error } = await dbClient
            .from('matches')
            .select(`
            id, 
            status,
            match_participants!inner(user_id)
        `)
            .eq('tournament_id', tournamentId)
            .in('status', ['waiting', 'in_progress', 'showing_results'])
            .in('match_participants.user_id', participantIds);

        if (error) {
            console.error("Error checking existing matches:", error);
            return [];
        }

        return existingMatches || [];
    }

    private static async generateTournamentMatchesSafe(tournamentId: number, participants: { user_id: number }[]): Promise<{ success: boolean, errorMessage?: string }> {
        if (participants.length < 2) {
            return { success: false, errorMessage: "Not enough participants to generate matches." };
        }

        if (participants.length % 2 !== 0) {
            return { success: false, errorMessage: "Odd number of participants - cannot create pairs." };
        }

        // Double-check no matches exist
        const existingMatches = await GameController.checkExistingMatchesForParticipants(tournamentId, participants);
        if (existingMatches.length > 0) {
            console.log(`Matches already exist for tournament ${tournamentId} participants. Skipping creation.`);
            return { success: true }; // Not an error, just already exists
        }

        const { data: tournament, error: tournamentError } = await dbClient
            .from('tournaments')
            .select('prize_pool, max_players')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            console.error("Error fetching tournament details:", tournamentError);
            return { success: false, errorMessage: "Failed to retrieve tournament details for match generation." };
        }

        const stakeAmount = Number(tournament.prize_pool) / Number(tournament.max_players);

        // Shuffle participants to randomize pairings
        const shuffledParticipants = [...participants].sort(() => 0.5 - Math.random());
        const matchesToInsert: TablesInsert<'matches'>[] = [];

        // Create matches for pairs
        for (let i = 0; i < shuffledParticipants.length; i += 2) {
            if (i + 1 < shuffledParticipants.length) {
                matchesToInsert.push({
                    tournament_id: tournamentId,
                    status: 'in_progress',
                    stake_amount: stakeAmount.toString(),
                    total_prize_pool: tournament.prize_pool!,
                    started_at: new Date().toISOString(),
                });
            }
        }

        if (matchesToInsert.length === 0) {
            return { success: false, errorMessage: "No matches generated for the tournament." };
        }

        console.log(`Creating ${matchesToInsert.length} matches for tournament ${tournamentId}`);

        const { data: newMatches, error: matchInsertError } = await dbClient
            .from('matches')
            .insert(matchesToInsert)
            .select();

        if (matchInsertError) {
            console.error("Error creating tournament matches:", matchInsertError);
            return { success: false, errorMessage: "Failed to create tournament matches." };
        }

        // Link participants to matches
        let matchIndex = 0;
        const matchParticipantsInserts: TablesInsert<'match_participants'>[] = [];

        for (let i = 0; i < shuffledParticipants.length; i += 2) {
            if (i + 1 < shuffledParticipants.length && newMatches && newMatches[matchIndex]) {
                const matchId = newMatches[matchIndex].id;
                matchParticipantsInserts.push({
                    match_id: matchId,
                    user_id: shuffledParticipants[i].user_id,
                    position: 1,
                });
                matchParticipantsInserts.push({
                    match_id: matchId,
                    user_id: shuffledParticipants[i + 1].user_id,
                    position: 2,
                });
                matchIndex++;
            }
        }

        const { error: linkError } = await dbClient
            .from('match_participants')
            .insert(matchParticipantsInserts);

        if (linkError) {
            console.error("Error linking participants to tournament matches:", linkError);
            return { success: false, errorMessage: "Failed to link participants to tournament matches." };
        }

        // Create first round for each match
        // for (const match of newMatches) {
        //     const { success: roundSuccess, errorMessage: roundError } = await GameController.createGameRound(match.id, 1);
        //     if (!roundSuccess) {
        //         console.error(`Failed to create first round for new tournament match ${match.id}:`, roundError);
        //     }
        // }
        for (const match of newMatches) {
            const { success: startSuccess, errorMessage: startError } = await GameController.startTournamentMatch(match.id);
            if (!startSuccess) {
                console.error(`Failed to start tournament match ${match.id}:`, startError);
            }
        }


        console.log(`Successfully created ${newMatches.length} matches for tournament ${tournamentId}`);
        return { success: true };
    }

    private static async startTournamentMatch(matchId: number): Promise<{ success: boolean, errorMessage?: string }> {
        try {
            // Update match status to in_progress and set started_at
            const { error: updateError } = await dbClient
                .from('matches')
                .update({
                    status: 'in_progress',
                    started_at: new Date().toISOString()
                })
                .eq('id', matchId);

            if (updateError) {
                console.error(`Error starting tournament match ${matchId}:`, updateError);
                return { success: false, errorMessage: "Failed to start tournament match." };
            }

            // Create the first round
            const { success: roundSuccess, errorMessage: roundError } = await GameController.createGameRound(matchId, 1);
            if (!roundSuccess) {
                console.error(`Failed to create first round for tournament match ${matchId}:`, roundError);
                return { success: false, errorMessage: "Failed to create initial round." };
            }

            console.log(`Tournament match ${matchId} started successfully.`);
            return { success: true };

        } catch (error) {
            console.error(`Error in startTournamentMatch for match ${matchId}:`, error);
            return { success: false, errorMessage: "Internal Server Error." };
        }
    }
    // #endregion
}