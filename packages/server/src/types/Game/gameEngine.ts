export type Move = 'rock' | 'paper' | 'scissors';
export type Result = 'win' | 'lose' | 'draw';

export const isValidMove = (move: string): move is Move => {
    return ['rock', 'paper', 'scissors'].includes(move);
}

export function determineResult(playerMove: Move, opponentMove: Move): Result {
    if (playerMove === opponentMove) 
        return 'draw';

    const winConditions: Record<Move, Move> = {
        rock: 'scissors',
        paper: 'rock',
        scissors: 'paper'
    }

    return winConditions[playerMove] === opponentMove ? 'win' : 'lose';
}

