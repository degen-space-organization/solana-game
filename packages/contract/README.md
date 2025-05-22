# Gaming Vault Smart Contract

A Solana smart contract built with Anchor that handles secure fund management for competitive gaming tournaments and 1v1 matches. The contract focuses on financial security while delegating game logic to a backend service.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Responsibilities](#responsibilities)
- [Game Types & Tiers](#game-types--tiers)
- [Contract Functions](#contract-functions)
- [Backend Integration](#backend-integration)
- [Race Condition Handling](#race-condition-handling)
- [Security Features](#security-features)
- [Testing](#testing)
- [Deployment](#deployment)

## Overview

The Gaming Vault contract manages:
- Secure escrow of player stakes
- Automated fee collection
- Game creation and joining
- Admin-controlled payouts and withdrawals
- Emergency fund recovery

**Key Design Philosophy:** Minimal on-chain state, maximum security, backend-controlled game logic.

## Architecture

### Contract Responsibilities ✅
- **Fund Security**: Escrow player stakes in secure vault
- **Fee Management**: Automatic fee collection and distribution
- **Basic Validation**: Prevent duplicate joins, validate game states
- **Payout Distribution**: Execute winner payouts based on backend instructions
- **Emergency Recovery**: Admin-controlled fund recovery mechanisms

### Backend Responsibilities ✅
- **Game Logic**: All match mechanics, round timing, elimination tracking
- **Player Eligibility**: Determine who can join which games
- **Race Condition Prevention**: Database-level locks and atomic operations
- **Winner Determination**: Calculate tournament brackets and results
- **Gas Fee Calculation**: Compute transaction costs for precise deductions

## Game Types & Tiers

### Game Types
1. **1v1 Standoff**: 2 players, winner takes all
2. **Tournament**: Power-of-2 elimination (2, 4, 8, 16 players)

### Stake Tiers
- **Tier 1**: 0.1 SOL
- **Tier 2**: 0.25 SOL  
- **Tier 3**: 0.5 SOL
- **Tier 4**: 1.0 SOL

### Prize Distribution (Tournaments)
- Configurable percentages for 1st, 2nd, 3rd place
- Default: 50% / 30% / 20%
- 1v1 games: Winner takes entire pot

## Contract Functions

### Public Functions (Anyone can call)

#### `create_game(game_type, tier)`
Creates a new game and locks creator's stake.

**Parameters:**
- `game_type`: `OneVsOne` or `Tournament { size: u8 }`
- `tier`: `PointOne`, `PointTwoFive`, `PointFive`, or `One`

**Effects:**
- Transfers stake + fee from creator
- Creates game account with unique ID
- Sets status to `WaitingForPlayers`

#### `join_game(game_id)`
Joins an existing game and locks player's stake.

**Parameters:**
- `game_id`: Unique game identifier

**Effects:**
- Transfers stake + fee from player
- Adds player to game
- Auto-starts game when full capacity reached

### Admin-Only Functions

#### `admin_withdraw_player(game_id, player_pubkey, gas_fee)`
Withdraws a player before game starts (refunds stake minus gas).

#### `admin_cancel_game(game_id, gas_fee_per_player)`
Cancels a game and refunds all players (minus gas fees).

#### `admin_payout_winners(game_id, winners, gas_fee_per_winner)`
Distributes winnings to tournament/1v1 winners (minus gas fees).

#### `admin_emergency_withdraw(recipient, amount)`
Emergency function to recover funds (admin only).

#### `update_config(...)`
Updates contract configuration (fees, prize distribution).

## Backend Integration

### Typical Workflow

```typescript
// 1. Player requests to join game via API
app.post('/join-game', async (req, res) => {
  const { playerId, gameId } = req.body;
  
  // Backend validates eligibility
  const canJoin = await validatePlayerEligibility(playerId, gameId);
  if (!canJoin) {
    return res.status(400).json({ error: "Cannot join game" });
  }
  
  // Call contract
  await contract.joinGame(gameId);
  
  // Update database
  await db.updatePlayerStatus(playerId, gameId);
});

// 2. Game logic runs on backend
async function processGameRound(gameId) {
  // Handle player moves, timeouts, eliminations
  const eliminatedPlayers = await processRound(gameId);
  
  // Backend tracks eliminations, NO contract call needed
  await db.markPlayersEliminated(eliminatedPlayers);
  
  // Eliminated players can immediately join new games!
}

// 3. Payout winners when game ends
async function finalizeGame(gameId) {
  const winners = await calculateWinners(gameId);
  const gasFee = await estimateGasCosts();
  
  // Single contract call to distribute all winnings
  await contract.adminPayoutWinners(gameId, winners, gasFee);
}
```

### Race Condition Prevention

#### Database Level
```sql
-- Use database transactions with locks
BEGIN;
SELECT * FROM players WHERE id = ? FOR UPDATE;
-- Check eligibility, update status atomically
UPDATE players SET current_game_id = ? WHERE id = ?;
COMMIT;
```

#### API Level
```typescript
// Queue concurrent requests
const joinGameQueue = new Queue('join-game');

joinGameQueue.process(async (job) => {
  const { playerId, gameId } = job.data;
  
  // Atomic database operation
  return await db.transaction(async (trx) => {
    const player = await trx('players')
      .where('id', playerId)
      .forUpdate()
      .first();
      
    if (player.in_active_game) {
      throw new Error('Player already in game');
    }
    
    // Update and call contract
    await trx('players').where('id', playerId)
      .update({ in_active_game: true, current_game_id: gameId });
      
    return await contract.joinGame(gameId);
  });
});
```

## Security Features

### Financial Security
- **Secure Vault**: All funds held in program-derived account
- **Fee Protection**: Gas fees deducted from payouts to prevent service losses
- **Overflow Protection**: Checked arithmetic prevents integer attacks
- **Admin Authorization**: Multi-signature support for admin functions

### Validation Logic
- **Duplicate Prevention**: Cannot join same game twice
- **State Validation**: Games must be in correct state for operations
- **Balance Checks**: Validates sufficient funds before transfers
- **Emergency Controls**: Admin can recover funds in emergencies

### Gas Fee Management
```rust
// All payouts subtract gas fees automatically
let payout_amount = prize_amount.saturating_sub(gas_fee_per_winner);

// Backend calculates precise gas costs
const gasEstimate = await connection.getFeeForMessage(transaction);
await contract.adminPayoutWinners(gameId, winners, gasEstimate);
```

## Testing

### Running Tests
```bash
# Install dependencies
npm install

# Run basic tests
anchor test

# Run with logs
anchor test --skip-local-validator
```

### Test Coverage
- ✅ Contract initialization
- ✅ Game creation (1v1 and tournaments)
- ✅ Player joining and auto-start
- ✅ Duplicate join prevention
- ✅ Admin functions (withdraw, cancel, payout)
- ✅ Authorization checks
- ✅ Balance validations
- ✅ Gas fee deductions

### Advanced Test Scenarios
```typescript
// Test race conditions
describe("Race Conditions", () => {
  it("Multiple players joining simultaneously", async () => {
    // Simulate concurrent joins
    const promises = [
      contract.joinGame(gameId, { signer: player1 }),
      contract.joinGame(gameId, { signer: player2 }),
      contract.joinGame(gameId, { signer: player3 }),
    ];
    
    // Only valid joins should succeed
    const results = await Promise.allSettled(promises);
    // Assert proper handling
  });
});
```

## Player Eligibility Logic

### Backend Validation Rules

```typescript
async function validatePlayerEligibility(playerId: string, gameId: string): Promise<boolean> {
  const player = await db.getPlayer(playerId);
  const game = await db.getGame(gameId);
  
  // Rule 1: Player not already in this specific game
  if (game.players.includes(playerId)) {
    return false;
  }
  
  // Rule 2: Player not in any active game (unless eliminated)
  if (player.current_game_id && !player.is_eliminated) {
    return false;
  }
  
  // Rule 3: Game is still accepting players
  if (game.status !== 'WAITING_FOR_PLAYERS') {
    return false;
  }
  
  // Rule 4: Game not full
  if (game.players.length >= game.max_players) {
    return false;
  }
  
  return true;
}
```

### Elimination Workflow

```typescript
// When player loses in tournament
async function eliminatePlayer(gameId: string, playerId: string) {
  await db.transaction(async (trx) => {
    // Mark player as eliminated in THIS game
    await trx('game_players')
      .where({ game_id: gameId, player_id: playerId })
      .update({ is_eliminated: true, eliminated_at: new Date() });
    
    // Free up player to join other games
    await trx('players')
      .where('id', playerId)
      .update({ 
        current_game_id: null,
        in_active_game: false 
      });
  });
  
  // Player can now join other games immediately!
  // No contract transaction needed!
}
```

## Deployment

### Prerequisites
```bash
# Install Anchor
curl -sSf https://install.anchor-lang.com | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
```

### Deploy Steps
```bash
# Build program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Initialize contract
anchor run initialize --provider.cluster devnet
```

### Environment Configuration
```typescript
// config.ts
export const CONTRACT_CONFIG = {
  programId: new PublicKey("Game111111111111111111111111111111111111111"),
  gameConfigPda: // Derived from seeds
  vaultPda: // Derived from seeds
  network: "devnet", // or "mainnet-beta"
  fees: {
    joinGame: 50, // 0.5% in basis points
    firstPlace: 50, // 50%
    secondPlace: 30, // 30%
    thirdPlace: 20, // 20%
  }
};
```

## Error Handling

### Common Errors
- `InvalidFeeBps`: Fee percentage > 100%
- `AlreadyInThisGame`: Player trying to join same game twice
- `GameNotJoinable`: Game not accepting players
- `GameFull`: Game reached max capacity
- `UnauthorizedAccess`: Non-admin calling admin functions
- `InsufficientFunds`: Player lacks required SOL

### Error Recovery
```typescript
try {
  await contract.joinGame(gameId);
} catch (error) {
  if (error.message.includes('AlreadyInThisGame')) {
    // Handle duplicate join
    return { success: false, reason: 'Already joined' };
  }
  if (error.message.includes('InsufficientFunds')) {
    // Handle insufficient balance
    return { success: false, reason: 'Insufficient SOL' };
  }
  // Handle other errors
  throw error;
}
```

## Best Practices

### For Backend Developers
1. **Always validate eligibility before calling contract functions**
2. **Use database transactions for atomic operations**
3. **Calculate gas fees accurately to prevent losses**
4. **Implement proper error handling and retries**
5. **Use event logs for state synchronization**

### For Frontend Developers
1. **Check player balance before allowing game joins**
2. **Show clear error messages for failed transactions**
3. **Implement loading states for blockchain operations**
4. **Handle network switching and wallet connections**
5. **Display real-time game status updates**

### Security Considerations
1. **Never expose admin private keys**
2. **Use hardware wallets for admin functions**
3. **Implement rate limiting on API endpoints**
4. **Validate all user inputs thoroughly**
5. **Monitor contract events for suspicious activity**

## Support & Contribution

### Getting Help
- Check the test files for usage examples
- Review error messages for debugging clues
- Ensure proper account derivations for PDAs

### Contributing
1. Fork the repository
2. Create feature branch
3. Add comprehensive tests
4. Submit pull request with clear description

---

**Remember**: This contract prioritizes security and simplicity. Complex game logic belongs in your backend, while the contract focuses on secure fund management and basic validation.