
import { Request, Response } from "express";
import { determineResult, isValidMove, Move } from '../../types/Game/gameEngine';

import { dbClient } from '../../database/provider';
import { TablesInsert, Tables, TablesUpdate } from '../../database/types'

type player_move = 'rock' | 'paper' | 'scissors';


/**
 * 
 */
export default class GameController {

    constructor() { };


    static async hello(req: Request, res: Response) {
        try {
            res.status(200).json({
                message: "Hello from GameController"
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    };

    static async createLobby(req: Request, res: Response) {
        try {
            const { name, created_by, stake_amount, max_players } = req.body;

            if (!created_by || !stake_amount) {
                return res.status(400).json({ error: "Missing required lobby fields: created_by, stake_amount" });
            }

            // Validate stake_amount against allowed values (from lobby_migration.sql)
            const allowedStakes = ['250000000', '500000000', '750000000', '1000000000'];
            if (!allowedStakes.includes(stake_amount.toString())) {
                return res.status(400).json({ error: `Invalid stake amount. Allowed values: ${allowedStakes.join(', ')}` });
            }

            // const allowedMaxPlayers = [2, 4, 8];
            // if (!allowedMaxPlayers.includes(max_players)) {
            //     return res.status(400).json({ error: `Invalid max players count. Allowed values: ${allowedMaxPlayers.join(', ')}` });
            // }

            const lobbyData: TablesInsert<'lobbies'> = {
                name: name || `Lobby by ${created_by}`,
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
            const { lobby_id, user_id } = req.body;

            if (!lobby_id || !user_id) {
                return res.status(400).json({ error: "Missing required fields: lobby_id, user_id" });
            }

            // Check if lobby exists and is not full
            const { data: lobby, error: lobbyError } = await dbClient
                .from('lobbies')
                .select('id, current_players, max_players, status')
                .eq('id', lobby_id)
                .single();

            if (lobbyError) {
                console.error("Error fetching lobby:", lobbyError);
                return res.status(404).json({ error: "Lobby not found" });
            }

            if (lobby.status !== 'waiting') {
                return res.status(400).json({ error: "Lobby is not joinable" });
            }

            if (lobby.current_players! >= lobby.max_players!) {
                return res.status(400).json({ error: "Lobby is full" });
            }

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

            res.status(200).json({
                message: "Joined lobby successfully",
                participant: data
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
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

            if (match.status !== 'in_progress') {
                console.log(`Cannot create round for match ${matchId} because its status is '${match.status}'.`);
                return { success: false, errorMessage: "Match is not in 'in_progress' status." };
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

            // Ensure enough players are in the lobby and all have staked if required
            const participants = lobby.lobby_participants;
            if (!participants || participants.length !== lobby.max_players) {
                console.log("Max players: ", lobby.max_players)
                console.log("Participants: ", participants.length)
                return res.status(400).json({ error: "Not enough players in lobby to start match." });
            }

            console.log("PARTICIPANTS: ", participants)
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
            }

            // After a move is submitted, check if both players have made a move for the round.
            // If so, trigger the round processing function.
            const { data: updatedRound, error: checkError } = await dbClient
                .from('game_rounds')
                .select('player1_move, player2_move')
                .eq('id', gameRound.id)
                .single();

            if (checkError) {
                console.error("Error re-fetching round after move submission:", checkError);
                // Continue, as the move was likely saved, but logging is important.
            }

            if (updatedRound?.player1_move && updatedRound?.player2_move) {
                // Both players have made a move, process the round immediately
                console.log(`Both players made moves for match ${match_id}, round ${round_number}. Processing round...`);
                const { success, errorMessage } = await GameController.processRound(match_id, round_number);
                if (!success) {
                    console.error(`Failed to process round ${round_number} for match ${match_id}: ${errorMessage}`);
                    return res.status(500).json({ message: "Move submitted, but round processing failed.", error: errorMessage });
                }
                res.status(200).json({ message: "Move submitted successfully and round processed." });
            } else {
                res.status(200).json({ message: "Move submitted successfully. Waiting for opponent." });
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
                // or simply be a 'no winner' round. For now, we'll say no winner, effectively a 'tie'
                // in terms of points for the match, but still marking the round as completed.
                console.log(`Both players failed to move for round ${roundNumber}. It's a tie for this round.`);
                roundWinnerId = null; // No winner for this round
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
                .update({ winner_id: roundWinnerId, completed_at: new Date().toISOString() })
                .eq('id', gameRound.id);

            if (updateError) {
                console.error("Error updating game round with winner:", updateError);
                return { success: false, errorMessage: "Failed to update round with winner." };
            }

            console.log(`Round ${roundNumber} completed for match ${matchId}. Winner: ${roundWinnerId ? `User ${roundWinnerId}` : 'Tie'}`);

            // After processing a round, check if the match is over
            const { success: matchProcessSuccess, matchWinnerId } = await GameController.processMatch(matchId);

            if (matchProcessSuccess && matchWinnerId === null) {
                // Match is still in progress (no winner yet), create the next round
                const nextRoundNumber = roundNumber + 1;
                const { success: createNextRoundSuccess, errorMessage: createNextRoundError } = await GameController.createGameRound(matchId, nextRoundNumber);
                    if (!createNextRoundSuccess) {
                        console.error(`Failed to create next round ${nextRoundNumber} for match ${matchId}: ${createNextRoundError}`);
                        // Handle this error appropriately, perhaps by marking match as cancelled or error.
                    }
                // if (nextRoundNumber <= 5) { // "best of 5" means up to 5 rounds
                //     const { success: createNextRoundSuccess, errorMessage: createNextRoundError } = await GameController.createGameRound(matchId, nextRoundNumber);
                //     if (!createNextRoundSuccess) {
                //         console.error(`Failed to create next round ${nextRoundNumber} for match ${matchId}: ${createNextRoundError}`);
                //         // Handle this error appropriately, perhaps by marking match as cancelled or error.
                //     }
                // } else {
                //     console.log(`Match ${matchId} reached max rounds (5) without a clear winner (shouldn't happen in best of 5 if logic is correct).`);
                //     // This scenario means 2-2 tie after 4 rounds, and the 5th round was a tie too.
                //     // You might need a tie-breaker rule or declare it a draw, and mark the match completed.
                //     // The `processMatch` should handle this, so this else block might not be strictly necessary
                //     // if processMatch ensures a winner or completion.
                // }
            }

            return { success: true, winnerId: roundWinnerId };

        } catch (error) {
            console.error("processRound error:", error);
            return { success: false, errorMessage: "Internal Server Error." };
        }
    }

    /**
     * Checks if a match has a winner based on "best of 5" and updates its status.
     * This method would be called after each round is processed.
     * @param matchId The ID of the match to process.
     */
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
            // --- END NEW LOGIC ---

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
            // else if (gameRounds.length === 5 && player1Wins < 3 && player2Wins < 3) {
                // // All 5 rounds played and no one reached 3 wins (e.g., 2-2 tie after 5 rounds, implies one round was a tie).
                // // This means the logic might need to handle a specific tie-breaker or declare a draw.
                // // For now, let's assume the current 'winner_id' for the 5th round correctly determines a winner or a final draw.
                // // If it's 2-2, and the 5th round was a tie, then it's a draw, and we might need to decide on a winner arbitrarily or refund.
                // // The current setup expects a clear winner for a match status of 'completed'.
                // // If 5 rounds are done and no one has 3 wins, it implies some rounds were ties.
                // // A common RPS rule is that ties don't count towards the 'best of X' unless specified.
                // // Here, we count 'winner_id IS NOT NULL' rounds.
                // // If after 5 rounds, no one has 3 'winner_id's, then we need a rule for this.
                // // For now, if max rounds are played and no winner, keep it 'in_progress' or mark as 'draw'.
                // // Let's explicitly check the win count against the "best of 5" rule.
                // console.log(`Match ${matchId}: All 5 rounds played. Scores: P1: ${player1Wins}, P2: ${player2Wins}.`);
                // // If after 5 rounds, still no winner, this might mean a specific scenario (e.g., 2-2, with one round being a draw)
                // // For a "best of 5", a game must end when one player wins 3 rounds.
                // // If the game reaches 5 rounds and neither has 3 wins, it means there were ties.
                // // The current logic based on `winner_id IS NOT NULL` handles this.
                // // If the match ends without a winner by normal means (e.g., 3-2 score), it's a bug in previous logic.
                // // If this `else if` block is hit, it suggests 5 rounds have been completed, but neither player has 3 wins.
                // // This scenario could occur if `winner_id` was NULL for some rounds (ties).
                // // In such a case, you might need a specific tie-breaking mechanism or declare a draw.
                // // For simplicity, if 5 rounds are completed and no one has 3 wins, let's treat it as completed without a clear winner,
                // // perhaps leading to a refund.
                // if (player1Wins === player2Wins) {
                //      matchStatus = 'completed'; // It's a draw/tie-game after all rounds
                //      matchWinnerId = null; // Explicitly set to null for a draw
                //      console.log(`Match ${matchId}: Declared a draw after 5 rounds (P1: ${player1Wins}, P2: ${player2Wins}).`);
                // } else {
                //     // This implies a logical flaw if someone should have won. Re-evaluating.
                //     // Given 'best of 5' and 'winner_id IS NOT NULL' is counted, a 2-2 scenario after 5 rounds is possible if one round was a tie.
                //     // The code needs to handle this.
                //     // If it's 2-2 after 5 rounds, and the 5th round was a tie, it means the earlier logic failed to account for a scenario where someone should have won.
                //     // For the "best of 5" to enforce a winner, you can't have 2-2 after 5.
                //     // Let's assume the rules enforce a winner, and if we are here, it means we have played 5 rounds and someone *should* have 3 wins.
                //     // If not, it means the previous `winner_id` assignment for rounds needs to be re-evaluated.
                //     // For now, if we reach this and no one has 3 wins, the match is implicitly still in progress or an error state.
                //     // The `gameRounds.length === 5` check only makes sense if ties don't count towards round completion or require a different way to end.
                //     // Best of 5 means `max_rounds_to_play` is not fixed at 5. It's max of 5, but ends when one hits 3.
                //     // Let's remove this `else if (gameRounds.length === 5)` branch to avoid misinterpretation of "best of 5".
                //     // The current logic of checking `player1Wins >=3` or `player2Wins >=3` is sufficient for determining completion.
                //     // If it *doesn't* hit those, the match is `in_progress`.
                // }
            // }


            if (matchWinnerId !== null) {
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
                    .select('tournament_id, lobby_id')
                    .eq('id', matchId)
                    .single();

                if (!mError && matchData) {
                    if (matchData.tournament_id) {
                        console.log(`Match ${matchId} is part of tournament ${matchData.tournament_id}. Triggering tournament advancement logic.`);
                        // TODO: Implement GameController.advanceTournament(matchData.tournament_id);
                        // This would be a separate, more complex function.
                    } else if (matchData.lobby_id && !matchData.tournament_id) {
                        // This is a 1v1 match, proceed with direct payout
                        console.log(`Match ${matchId} is 1v1. Initiating payout via smart contract.`);
                        // TODO: Implement initiatePayout(matchId, matchWinnerId);
                        // This function would interact with your Solana contract.
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


    //Tourney stuff

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
            const allowedStakes = ['250000000', '500000000', '750000000', '1000000000'];
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
}