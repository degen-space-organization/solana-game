# Rock Paper Scissors Game Components

A collection of React components for building a real-time Rock Paper Scissors game with neobrutalism design.

## File Structure

```
components/Game/
├── index.ts              # Main export file
├── GameMatch.tsx         # Main game container
├── MoveSelector.tsx      # Player move selection
├── OpponentCards.tsx     # Opponent's move display
├── Battlefield.tsx       # Game battle arena
├── MatchInfo.tsx         # Score and match status
└── GameDemo.tsx          # Demo component

types/
└── game.ts              # TypeScript interfaces
```

## Components Overview

### 1. **GameMatch** (Main Component)
The primary container that orchestrates all game logic and state management.

```tsx
import { GameMatch } from './components/Game';

<GameMatch
  matchData={matchData}
  currentUserId={userId}
  onLeaveMatch={() => navigate('/lobbies')}
/>
```

### 2. **MoveSelector**
Interactive component for players to choose Rock, Paper, or Scissors.

**Features:**
- Visual move selection with color feedback
- 20-second countdown timer
- Disabled state after move submission
- Confirmation message

### 3. **OpponentCards**
Displays opponent's possible moves with mystery overlay.

**Features:**
- Shows opponent readiness status
- Mystery overlay during selection phase
- Reveal animation during battle

### 4. **Battlefield**
Central battle arena showing game phases and results.

**States:**
- Waiting: Loading spinner
- Choosing: Move submission prompt
- Revealing: Battle animation with results
- Finished: Match completion screen

### 5. **MatchInfo**
Score tracking and match status display.

**Features:**
- Visual score dots (3 to win)
- Player vs Opponent layout
- Round counter
- Player name display

## Usage Example

```tsx
import React from 'react';
import { GameMatch, type MatchData } from './components/Game';

const YourGamePage: React.FC = () => {
  const matchData: MatchData = {
    id: 1,
    status: 'in_progress',
    winner_id: null,
    participants: [
      {
        user_id: currentUserId,
        position: 1,
        users: {
          id: currentUserId,
          nickname: 'YourNickname',
          solana_address: 'your_wallet_address',
        },
      },
      {
        user_id: opponentId,
        position: 2,
        users: {
          id: opponentId,
          nickname: 'OpponentNickname',
          solana_address: 'opponent_wallet_address',
        },
      },
    ],
  };

  return (
    <GameMatch
      matchData={matchData}
      currentUserId={currentUserId}
      onLeaveMatch={() => {
        // Handle leaving the match
        navigate('/lobbies');
      }}
    />
  );
};
```

## API Integration Points

The components are designed to integrate with your existing backend:

### Move Submission
```tsx
// In GameMatch.tsx - submitMove function
const response = await fetch('http://localhost:4000/api/v1/game/submit-move', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    match_id: matchData.id,
    user_id: currentUserId,
    round_number: currentRound?.round_number || 1,
    player_move: move,
  }),
});
```

### Real-time Updates
For real-time opponent moves and game state, you'll want to add:
- WebSocket connection for live updates
- Supabase real-time subscriptions
- Server-sent events

## Customization

### Replace Emoji with Custom GIFs
```tsx
// In MoveSelector.tsx and other components
const moves: MoveOption[] = [
  { 
    type: 'rock', 
    emoji: <Image src="/gifs/rock-avatar.gif" alt="Rock" />, 
    name: 'ROCK', 
    color: '#DC2626' 
  },
  // ... other moves
];
```

### Styling Modifications
All components use Chakra UI with neobrutalism styling:
- `borderRadius="0"` for sharp edges
- `border="4px solid"` for thick borders
- `shadow="8px 8px 0px rgba(0,0,0,0.8)"` for bold shadows

### Game Logic Customization
- Timer duration: Change `timeRemaining` initial value
- Winning condition: Modify score tracking in `GameMatch`
- Round structure: Adjust max rounds from 5 to any number

## State Management

The `GameMatch` component manages:
- **gameState**: `'waiting' | 'choosing' | 'revealing' | 'finished'`
- **selectedMove**: Player's chosen move
- **currentRound**: Round information
- **timeRemaining**: Countdown timer
- **playerScore/opponentScore**: Match scores
- **matchFinished/matchWinner**: End game states

## Events and Callbacks

### onLeaveMatch
Called when player wants to exit the match:
```tsx
onLeaveMatch={() => {
  // Cleanup logic
  // Navigate away
  // Update parent component state
}}
```

### Move Selection
Automatically handled within `GameMatch` component through the `submitMove` function.

## Dependencies

Required Chakra UI components:
- Box, Button, VStack, HStack, Text, Heading
- Card, Badge, Grid, Flex, Spinner, Container
- Icons from lucide-react

## Demo

Use the `GameDemo` component to test the game interface:

```tsx
import { GameDemo } from './components/Game';

// Renders a demo game with mock data
<GameDemo />
```