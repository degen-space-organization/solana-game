
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
                return res.status(400).json({ error: "Missing required fields: lobby_id, creator_user_id" });
            }

            // Fetch lobby and its participants
            const { data: lobby, error: lobbyError } = await dbClient
                .from('lobbies')
                .select('*, lobby_participants(user_id)')
                .eq('id', lobby_id)
                .single();

            if (lobbyError) {
                console.error("Error fetching lobby for match start:", lobbyError);
                return res.status(404).json({ error: "Lobby not found" });
            }

            // Basic authorization: Only the creator can start the match
            if (lobby.created_by !== creator_user_id) {
                return res.status(403).json({ error: "Only the lobby creator can start the match." });
            }

            // Ensure lobby is in 'waiting' status
            if (lobby.status !== 'waiting') {
                return res.status(400).json({ error: "Lobby is not in 'waiting' status." });
            }

            // Ensure enough players are in the lobby and all have staked if required
            const participants = lobby.lobby_participants;
            if (!participants || participants.length !== lobby.max_players) {
                console.log("Max players: ", lobby.max_players)
                console.log("Participants: ", participants.length)
                return res.status(400).json({ error: "Not enough players in lobby to start match." });
            }


            // Check if all participants are ready and staked (example; add actual staking logic)
            // For now, assuming they are ready if they are present.
            // In a real app, you'd check `has_staked` on each participant.

            // Create match entry
            const matchData: TablesInsert<'matches'> = {
                lobby_id: lobby_id,
                status: 'in_progress', // Match starts immediately in 'in_progress'
                stake_amount: lobby.stake_amount,
                total_prize_pool: (parseInt(lobby.stake_amount) * participants.length).toString(),
                started_at: new Date().toISOString(),
            };

            const { data: newMatch, error: matchInsertError } = await dbClient
                .from('matches')
                .insert([matchData])
                .select()
                .single();

            if (matchInsertError) {
                console.error("Error creating match:", matchInsertError);
                return res.status(500).json({ error: "Failed to create match" });
            }

            // Link lobby participants to the new match
            const matchParticipantsInserts = participants.map((p, index) => ({
                match_id: newMatch.id,
                user_id: p.user_id,
                position: index + 1, // Assign player positions (1 or 2 for 1v1)
            }));

            const { error: matchParticipantsError } = await dbClient
                .from('match_participants')
                .insert(matchParticipantsInserts);

            if (matchParticipantsError) {
                console.error("Error adding match participants:", matchParticipantsError);
                // Rollback match creation if participant linking fails
                await dbClient.from('matches').delete().eq('id', newMatch.id);
                return res.status(500).json({ error: "Failed to link players to match" });
            }

            // --- NEW: Create the first game round for the newly started match ---
            const { success: roundCreationSuccess, errorMessage: roundCreationError } = await GameController.createGameRound(newMatch.id, 1);

            if (!roundCreationSuccess) {
                console.error(`Failed to create first round for match ${newMatch.id}:`, roundCreationError);
                // Optionally, implement a more robust rollback or compensation strategy here.
                // For now, return an error as the match is not fully ready without its first round.
                return res.status(500).json({ message: "Match started, but failed to create initial round.", error: roundCreationError });
            }
            // --- END NEW ---

            // Update lobby status to 'closed' or 'starting'
            const { error: updateLobbyStatusError } = await dbClient
                .from('lobbies')
                .update({ status: 'closed' }) // Lobby is closed once match starts
                .eq('id', lobby_id);

            if (updateLobbyStatusError) {
                console.error("Error updating lobby status:", updateLobbyStatusError);
                // This is less critical, but could be handled with a logging system or retry
            }

            res.status(201).json({
                message: "Match started successfully and Round 1 created.",
                match: newMatch
            });

        } catch (error) {
            console.error(error);
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
            const { user_id, lobby_id, txHash } = req.body;

            if (!user_id || !lobby_id || !txHash) {
                return res.status(400).json({ error: "Missing required fields: user_id, lobby_id, txHash" });
            }
            await new Promise(resolve => setTimeout(resolve, 1500));

            console.log('Received payload for lobby stake submission:', req.body);
            // Validate deposit for the lobby creation
            const isDepositValid = await VaultController.validateDepositLobbyCreation(txHash, user_id, lobby_id);

            if (!isDepositValid) {
                console.error("Deposit validation failed for lobby creation.");
                // Optionally, delete the lobby if deposit validation fails
                return res.status(400).json({ error: "Deposit validation failed. Lobby not created." });
            }

            res.status(201).json({
                message: "Deposit created successfully",
            });

        } catch (error) {
            console.error("Error submitting stake for lobby:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    static async createLobby(req: Request, res: Response) {
        try {
            const {
                name,
                tournament_id,
                created_by,
                stake_amount,
                max_players,
                txHash,
            } = req.body;
            console.log('Received payload for lobby creation:', req.body);
            if (!created_by || !stake_amount) {
                return res.status(400).json({ error: "Missing required lobby fields: created_by, stake_amount" });
            }

            // Validate stake_amount against allowed values (from lobby_migration.sql)
            const allowedStakes = ['100000000', '250000000', '500000000', '750000000', '1000000000'];
            if (!allowedStakes.includes(stake_amount.toString())) {
                return res.status(400).json({ error: `Invalid stake amount. Allowed values: ${allowedStakes.join(', ')}` });
            }


            const lobbyData: TablesInsert<'lobbies'> = {
                name: name || `Lobby by ${created_by}`,
                tournament_id: tournament_id || null,
                created_by: created_by,
                stake_amount: stake_amount.toString(),
                max_players: max_players || 2, // Default to 2 players for 1v1
                current_players: 1, // Initialize with 0 current players
                status: 'waiting',
            };

            const { data, error } = await dbClient
                .from('lobbies')
                .insert([lobbyData])
                .select()
                .single();

            if (error) {
                console.error("Error creating lobby:", error);
                return res.status(500).json({ error: "Failed to create lobby" });
            }

            // Automatically add the creator as a participant to the lobby
            const lobbyParticipantData: TablesInsert<'lobby_participants'> = {
                lobby_id: data.id,
                user_id: created_by,
                joined_at: new Date().toISOString(),
                is_ready: false,
                has_staked: false,
            };

            const { error: participantError } = await dbClient
                .from('lobby_participants')
                .insert([lobbyParticipantData]);

            if (participantError) {
                console.error("Error adding creator to lobby participants:", participantError);
                // Optionally, delete the lobby if participant addition failed
                await dbClient.from('lobbies').delete().eq('id', data.id);
                res.status(500).json({ error: "Failed to add creator to lobby" });
            }

            // sleep for 3 second
            await new Promise(resolve => setTimeout(resolve, 2000));

            // validate the
            //  deposit for the lobby creation
            const isDepositValid = await VaultController.validateDepositLobbyCreation(txHash, created_by, data.id);


            if (!isDepositValid) {
                console.error("Deposit validation failed for lobby creation.");
                // Optionally, delete the lobby if deposit validation fails
                await dbClient.from('lobbies').delete().eq('id', data.id);
                await dbClient.from('lobby_participants').delete().eq('lobby_id', data.id).eq('user_id', created_by);
                return res.status(400).json({ error: "Deposit validation failed. Lobby not created." });
            }

            res.status(201).json({
                message: "Lobby created successfully",
                lobby: data
            });

        } catch (error) {
            console.error(error);
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


            // Check if lobby exists and is not full
            const { data: lobby, error: lobbyError } = await dbClient
                .from('lobbies')
                .select('*')
                .eq('id', lobby_id)
                .single();

            if (lobbyError) return res.status(404).json({ error: "Lobby not found" });
            // only join if the lobby is in the waiting status
            if (lobby.status !== 'waiting') return res.status(400).json({ error: "Lobby is not joinable" });
            if (lobby.current_players! >= lobby.max_players!) return res.status(400).json({ error: "Lobby is full" });


            // Check if user is already in this lobby
            const { data: existingParticipant, error: participantCheckError } = await dbClient
                .from('lobby_participants')
                .select('id')
                .eq('lobby_id', lobby_id)
                .eq('user_id', user_id)
                .single();


            if (existingParticipant) {
                return res.status(400).json({ error: "User already in this lobby" });
            }


            if (participantCheckError && participantCheckError.code !== 'PGRST116') { // PGRST116 = no rows found
                console.error("Error checking existing participant:", participantCheckError);
                return res.status(500).json({ error: "Database error checking participant" });
            }


            const newParticipant: TablesInsert<'lobby_participants'> = {
                lobby_id: lobby_id,
                user_id: user_id,
                joined_at: new Date().toISOString(),
                is_ready: false,
                has_staked: false,
            };


            const { data, error } = await dbClient
                .from('lobby_participants')
                .insert([newParticipant])
                .select()
                .single();


            if (error) {
                console.error("Error joining lobby:", error);
                // Handle specific Supabase errors, e.g., 'User is already in an active lobby' from trigger
                if (error.message.includes('User is already in an active lobby')) {
                    return res.status(409).json({ error: "User is already in another active game or lobby." });
                }
                return res.status(500).json({ error: "Failed to join lobby" });
            }


            // Update current_players count in lobbies table
            const { error: updateLobbyError } = await dbClient
                .from('lobbies')
                .update({ current_players: lobby.current_players! + 1 })
                .eq('id', lobby_id);


            if (updateLobbyError) {
                console.error("Error updating lobby player count:", updateLobbyError);
                // Consider rolling back participant insertion if this fails
                return res.status(500).json({ error: "Failed to update lobby player count" });
            }

            // check if lobby is part of a tournament, if it is, add the participant to the tournament_participants table
            if (lobby.tournament_id) {
                const { success, errorMessage } = await GameController.addTournamentParticipant(lobby.tournament_id, user_id);
                if (!success) {
                    console.error("Error adding participant to tournament:", errorMessage);
                    // Rollback participant addition if tournament join fails
                    await dbClient.from('lobby_participants').delete().eq('id', data.id);
                    await dbClient.from('lobbies').update({ current_players: lobby.current_players! - 1 }).eq('id', lobby_id);
                    return res.status(500).json({ error: `Failed to join tournament: ${errorMessage}` });
                }
            }
            // Successfully joined lobby and updated participant count
            console.log(`User ${user_id} joined lobby ${lobby_id} successfully.`);

            res.status(200).json({
                message: "Joined lobby successfully",
                participant: data
            });


        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    static async withdrawFromLobby(req: Request, res: Response) {
        try {

            const { user_id, lobby_id } = req.body;
            console.log('Withdraw request received:', { user_id, lobby_id });

            if (!user_id || !lobby_id) {
                return res.status(400).json({ error: "Missing required fields: user_id, lobby_id" });
            }
            // fetch lobby
            const { data: lobbyData, error: lobbyFetchError } = await dbClient
                .from('lobbies')
                .select('*')
                .eq('id', lobby_id)
                .single();
            if (lobbyFetchError || !lobbyData || lobbyData.status !== 'waiting') {
                console.error("Error fetching lobby for withdrawal:", lobbyFetchError);
                return res.status(404).json({ error: "Lobby not found or not in a valid state for withdrawal" });
            }

            // fetch user first
            const { data: user, error: userError } = await dbClient
                .from('users')
                .select('id, solana_address')
                .eq('id', user_id)
                .single();
            if (userError || !user) {
                console.error("Error fetching user for withdrawal:", userError);
                return res.status(404).json({ error: "User not found" });
            }



            // Fetch participant details to check if they have staked
            const { data: participant, error: participantError } = await dbClient
                .from('lobby_participants')
                .select('has_staked')
                .eq('user_id', user_id)
                .eq('lobby_id', lobby_id)
                .single();

            if (participantError || !participant) {
                console.error("Error fetching participant for withdrawal:", participantError);
                return res.status(404).json({ error: "Participant not found in this lobby" });
            }

            // Update the status of lobby to "withdrawal"
            const { error: updateLobbyError } = await dbClient
                .from('lobbies')
                .update({ status: 'withdrawal' })
                .eq('id', lobby_id);
            if (updateLobbyError) {
                console.error("Error updating lobby status to withdrawal:", updateLobbyError);
                return res.status(500).json({ error: "Failed to update lobby status" });
            }

            // Fetch lobby details to get stake amount and current players
            const { data: lobby, error: lobbyError } = await dbClient
                .from('lobbies')
                .select('current_players, stake_amount, status')
                .eq('id', lobby_id)
                .single();

            if (lobbyError || !lobby) {
                console.error("Error fetching lobby for withdrawal:", lobbyError);
                return res.status(404).json({ error: "Lobby not found or error fetching lobby data" });
            }


            // format stake amount from lamports to sol number
            const stakeAmountInSol = parseFloat(lobby.stake_amount) / 1e9; // Convert lamports to SOL
            const signature = await AdminWallet.processWithdrawal(user.solana_address, stakeAmountInSol);

            if (!signature) {
                console.error("Withdrawal failed, no signature returned.");
                const { error: rollbackError } = await dbClient
                    .from('lobbies')
                    .update({ status: lobby.status }) // Rollback to previous status
                    .eq('id', lobby_id);
                return res.status(500).json({ error: "Failed to process withdrawal" });
            }

            // Delete the participant from the lobby_participants table
            const { error: deleteParticipantError } = await dbClient
                .from('lobby_participants')
                .delete()
                .eq('user_id', user_id)
                .eq('lobby_id', lobby_id);

            if (deleteParticipantError) {
                console.error("Error deleting lobby participant:", deleteParticipantError);
                return res.status(500).json({ error: "Failed to remove participant from lobby" });
            }

            // Decrement current_players in lobbies table and update total_prize_pool
            const newCurrentPlayers = lobby.current_players! - 1;


            const { error: lobbyUpdateError } = await dbClient
                .from('lobbies')
                .update({
                    current_players: newCurrentPlayers,
                    status: newCurrentPlayers === 0 ? 'disbanded' : 'waiting', // Disband if no players left
                    total_prize_pool: newCurrentPlayers > 0 ? (parseFloat(lobby.stake_amount) * newCurrentPlayers).toString() : '0'
                })
                .eq('id', lobby_id);


            if (lobbyUpdateError) {
                console.error("Error updating lobby current players count and prize pool after withdrawal:", lobbyUpdateError);
                return res.status(500).json({ error: "Failed to update lobby details after withdrawal" });
            }

            return res.status(200).json({ message: "Successfully withdrawn from lobby" });

        } catch (error) {
            console.error("Error in withdrawFromLobby:", error);
            return res.status(500).json({ error: "Internal server error during lobby withdrawal" });
        }
    }

    static async kickPlayer(req: Request, res: Response) {
        try {
            const { lobby_id, player_to_kick_id, creator_user_id } = req.body;

            if (!lobby_id || !player_to_kick_id || !creator_user_id) {
                return res.status(400).json({ error: "Missing required fields: lobby_id, player_to_kick_id, creator_user_id" });
            }

            // Verify the caller is the lobby creator
            const { data: lobby, error: lobbyError } = await dbClient
                .from('lobbies')
                .select('*')
                .eq('id', lobby_id)
                .single();

            if (lobbyError || !lobby || lobby.status !== 'waiting') {
                console.error("Error fetching lobby for kicking player:", lobbyError);
                return res.status(404).json({ error: "Lobby not found" });
            }

            if (lobby.created_by !== creator_user_id) {
                return res.status(403).json({ error: "Only the lobby creator can kick players" });
            }

            // Ensure the player to be kicked is actually in the lobby
            const { data: participant, error: participantError } = await dbClient
                .from('lobby_participants')
                .select('*')
                .eq('user_id', player_to_kick_id)
                .eq('lobby_id', lobby_id)
                .single();

            if (participantError || !participant) {
                console.error("Error fetching participant to kick:", participantError);
                return res.status(404).json({ error: "Player not found in this lobby" });
            }

            // Prevent kicking if the player has already staked
            if (participant.has_staked && participant.stake_transaction_hash) {
                return res.status(400).json({ error: "Cannot kick a player who has already staked" });
            }

            // Delete the participant from the lobby_participants table
            const { error: deleteParticipantError } = await dbClient
                .from('lobby_participants')
                .delete()
                .eq('user_id', player_to_kick_id)
                .eq('lobby_id', lobby_id);

            if (deleteParticipantError) {
                console.error("Error deleting kicked player from lobby_participants:", deleteParticipantError);
                return res.status(500).json({ error: "Failed to remove player from lobby" });
            }

            // Decrement current_players in lobbies table and update total_prize_pool (if applicable)
            const newCurrentPlayers = lobby.current_players! - 1;
            // No need to adjust total_prize_pool as the kicked player hadn't staked
            const { error: lobbyUpdateError } = await dbClient
                .from('lobbies')
                .update({
                    current_players: newCurrentPlayers,
                    status: newCurrentPlayers === 0 ? 'disbanded' : lobby.status // Disband if no players left
                })
                .eq('id', lobby_id);

            if (lobbyUpdateError) {
                console.error("Error updating lobby current players count after kicking:", lobbyUpdateError);
                return res.status(500).json({ error: "Failed to update lobby details after kicking player" });
            }

            return res.status(200).json({ message: "Player kicked successfully" });

        } catch (error) {
            console.error("Error in kickPlayer:", error);
            return res.status(500).json({ error: "Internal server error during player kick" });
        }
    }

    static async deleteLobby(req: Request, res: Response) {
        try {
            const { lobby_id, user_id } = req.body;

            console.log('Received payload for lobby deletion:', req.body);

            if (!lobby_id || !user_id) {
                return res.status(400).json({ error: "Missing required fields: lobby_id, user_id" });
            }

            // Fetch the lobby to check if the user is the creator
            const { data: lobbyArray, error: lobbyError } = await dbClient
                .from('lobbies')
                .select('*')
                .eq('id', lobby_id)

            if (!lobbyArray || lobbyArray?.length === 0 || lobbyError || lobbyArray[0].status === 'withdrawal') {
                console.error("Error fetching lobby for deletion:", lobbyError);
                return res.status(403).json({ error: "Cannot disband while withdrawal is in process" });
            }

            // update lobby to closing status
            const { error: updateLobbyError } = await dbClient
                .from('lobbies')
                .update({ status: 'closing' })
                .eq('id', lobby_id);

            if (updateLobbyError) {
                console.error("Error updating lobby status to closing:", updateLobbyError);
                return res.status(500).json({ error: "Failed to update lobby status to closing" });
            }

            const lobby = lobbyArray[0];

            console.log("Fetched lobby for deletion:", lobby);
            console.error("Lobby deletion error:", lobbyError);

            // fetch all users from lobby_participants
            const { data: participants, error: participantsError } = await dbClient
                .from('lobby_participants')
                .select('*')
                .eq('lobby_id', lobby_id);

            console.log("Fetched participants for lobby deletion:", participants);

            if (!participants || participants.length === 0) {
                console.error("No participants found for lobby deletion.");
                console.error("Error fetching participants for lobby deletion:", participantsError);
                return res.status(404).json({ error: "No participants found for this lobby" });
            }

            if (lobbyError || !lobby) {
                console.error("Error fetching lobby for deletion:", lobbyError);
                return res.status(404).json({ error: "Lobby not found" });
            }

            if (lobby.created_by !== user_id) {
                return res.status(403).json({ error: "Only the lobby creator can delete the lobby" });
            }

            // issue a refund to all participants if they have staked
            const participantsEligibleForRefund = participants.filter(p => p.has_staked && p.stake_transaction_hash)
            const walletAddresses = participantsEligibleForRefund.map(p => p.user_id);
            const eligibleWalletAddresses = await dbClient
                .from('users')
                .select('solana_address')
                .in('id', walletAddresses);
            if (eligibleWalletAddresses.error || !eligibleWalletAddresses.data) {
                console.error("Error fetching participant wallet addresses for lobby deletion:", eligibleWalletAddresses.error);
                return res.status(500).json({ error: "Failed to fetch participant wallet addresses" });
            }
            const arrayOfWalletAddresses = eligibleWalletAddresses.data!.map(p => p.solana_address);
            const stakeAmountInSol = parseFloat(lobby.stake_amount) / 1e9; // Convert lamports to SOL
            const result = await AdminWallet.processLobbyDeletion(arrayOfWalletAddresses, stakeAmountInSol);

            if (!result) {
                console.error("Failed to process refunds for lobby participants.");
                return res.status(500).json({ error: "Failed to process refunds for lobby participants" });
            }
            console.log("Refunds processed successfully for lobby participants.");

            // Delete all participants in this lobby
            const { error: deleteParticipantsError } = await dbClient
                .from('lobby_participants')
                .delete()
                .eq('lobby_id', lobby_id);

            if (deleteParticipantsError) {
                console.error("Error deleting participants from lobby:", deleteParticipantsError);
                return res.status(500).json({ error: "Failed to delete participants from lobby" });
            }

            // Delete the lobby itself
            const { error: deleteLobbyError } = await dbClient
                .from('lobbies')
                .delete()
                .eq('id', lobby_id);

            if (deleteLobbyError) {
                console.error("Error deleting lobby:", deleteLobbyError);
                return res.status(500).json({ error: "Failed to delete the lobby" });
            }

            return res.status(200).json({ message: "Lobby deleted successfully" });

        } catch (error) {
            console.error("Error in deleteLobby:", error);
            return res.status(500).json({ error: "Internal server error during lobby deletion" });
        }
    }

    static async leaveLobby(req: Request, res: Response) {
        // A player only action, if not staked yet, they can leave the lobby
        try {
            const { user_id, lobby_id } = req.body;

            if (!user_id || !lobby_id) {
                return res.status(400).json({ error: "Missing required fields: user_id, lobby_id" });
            }

            const { data: lobbyCheck, error: lobbyCheckError } = await dbClient
                .from('lobbies')
                .select('*')
                .eq('id', lobby_id)
                .single();

            if (lobbyCheckError || !lobbyCheck || lobbyCheck.status === 'closing') {
                console.error("Error fetching lobby for leaving:", lobbyCheckError);
                return res.status(404).json({ error: "Lobby not found or in process of closing" });
            }

            // Check if the user is a participant in the lobby
            const { data: participant, error: participantError } = await dbClient
                .from('lobby_participants')
                .select('*')
                .eq('user_id', user_id)
                .eq('lobby_id', lobby_id)
                .single();

            if (participantError || !participant) {
                console.error("Error fetching participant for leaving lobby:", participantError);
                return res.status(404).json({ error: "Participant not found in this lobby" });
            }

            // Prevent leaving if the player has already staked
            if (participant.has_staked && participant.stake_transaction_hash) {
                return res.status(400).json({ error: "Cannot leave a lobby after staking" });
            }

            // Delete the participant from the lobby_participants table
            const { error: deleteParticipantError } = await dbClient
                .from('lobby_participants')
                .delete()
                .eq('user_id', user_id)
                .eq('lobby_id', lobby_id);

            if (deleteParticipantError) {
                console.error("Error deleting participant from lobby_participants:", deleteParticipantError);
                return res.status(500).json({ error: "Failed to remove participant from lobby" });
            }

            // Decrement current_players in lobbies table
            const { data: lobby, error: lobbyError } = await dbClient
                .from('lobbies')
                .select('current_players, status')
                .eq('id', lobby_id)
                .single();

            if (lobbyError || !lobby) {
                console.error("Error fetching lobby for updating current players:", lobbyError);
                return res.status(404).json({ error: "Lobby not found" });
            }

            const newCurrentPlayers = Math.max(lobby.current_players! - 1, 0); // Ensure it doesn't go negative

            const { error: updateLobbyError } = await dbClient
                .from('lobbies')
                .update({
                    current_players: newCurrentPlayers,
                    status: newCurrentPlayers === 0 ? 'disbanded' : lobby
                        .status // Disband if no players left
                })
                .eq('id', lobby_id);
            if (updateLobbyError) {
                console.error("Error updating lobby current players count after leaving:", updateLobbyError);
                return res.status(500).json({ error: "Failed to update lobby details after leaving" });
            }
            return res.status(200).json({ message: "Successfully left the lobby" });
        } catch (error) {
            console.error("Error in leaveLobby:", error);
            return res.status(500).json({ error: "Internal server error during lobby leave" });
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