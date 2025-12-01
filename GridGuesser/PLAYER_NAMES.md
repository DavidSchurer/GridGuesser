# Player Names System 👤

## Overview

GridGuesser now features a personalized player name system! Players must enter their name before creating or joining a game, making the experience more personal and engaging.

## How It Works

### Creating a Game
1. Click "Create New Game" on home page
2. **Name input screen appears**
3. Enter your name (up to 20 characters)
4. Press Enter or click "Create Game"
5. Game room is created with your name

### Joining a Game
1. Enter 6-digit room code
2. Click "Join Game"
3. **Name input screen appears**
4. Enter your name (up to 20 characters)
5. Press Enter or click "Join Game"
6. You join the room with your name

## Player Name Display

### In-Game UI
Player names are displayed in multiple locations:

#### 1. **Player Info Cards** (Top of game screen)
Two cards showing:
- **Your Card (Left):**
  - Your name with "You" badge
  - Your points
  - Blue/purple gradient when it's your turn
  - Circle avatar with first letter of your name

- **Opponent Card (Right):**
  - Opponent's name
  - Their points
  - Gray background when not their turn
  - Glows when it's their turn

#### 2. **Game Status Banner**
- "Alice's Turn - Click a tile!" (instead of "Your Turn")
- "Bob's Turn" (instead of "Opponent's Turn")
- "Alice Won!" (instead of "You Won!")
- "Bob disconnected" (instead of "Opponent disconnected")

#### 3. **Grid Headers**
- "Alice's Grid - Guess This!" (instead of "Opponent's Grid")
- "Your Grid (Bob) - They're Guessing This!"

#### 4. **Power-Up Notifications**
- "Alice used Skip Turn!" (instead of "Player 1 used...")
- "Bob revealed a 2x2 area!" (instead of "Player 2 revealed...")
- "Alice nuked the image!" (instead of "Player 1 nuked...")

## Technical Implementation

### Data Flow

1. **Name Input:**
   ```typescript
   // Home page stores name in sessionStorage
   sessionStorage.setItem('playerName', playerName.trim());
   ```

2. **Game Room Creation:**
   ```typescript
   // Game room retrieves name
   const playerName = sessionStorage.getItem('playerName') || 'Player';
   
   // Sends to server
   socket.emit("create-room-with-id", { roomId, playerName });
   ```

3. **Server Storage:**
   ```typescript
   const player: Player = {
     id: socket.id,
     socketId: socket.id,
     playerIndex: 0,
     name: playerName || 'Player 1',
   };
   ```

4. **Display in UI:**
   ```typescript
   const myName = gameRoom.players[playerIndex]?.name || 'You';
   const opponentName = gameRoom.players[1 - playerIndex]?.name || 'Opponent';
   ```

### Updated Types

**Player Interface:**
```typescript
export interface Player {
  id: string;
  socketId: string;
  playerIndex: 0 | 1;
  name: string;  // ← NEW FIELD
}
```

### sessionStorage Usage

**Why sessionStorage?**
- ✅ Persists during browser session
- ✅ Clears when browser closes (privacy)
- ✅ No server-side storage needed for MVP
- ✅ Name available across page navigations

**Storage Key:** `playerName`  
**Max Length:** 20 characters  
**Validation:** Trimmed, non-empty string required

## UI Components

### New Components
1. **PlayerInfo.tsx** - Player card with avatar, name, and points
2. **Name input screen** - Added to home page

### Updated Components
1. **GameStatus.tsx** - Now accepts `myName` and `opponentName` props
2. **Home page** - Two-step flow (name → create/join)
3. **Game room** - Displays names throughout

## Validation

### Name Requirements
- ✅ **Minimum:** 1 character (after trimming)
- ✅ **Maximum:** 20 characters
- ✅ **Required:** Cannot proceed without entering name
- ✅ **Auto-focus:** Input field is focused on load
- ✅ **Enter key:** Submit by pressing Enter

### Fallbacks
- If name somehow missing: Defaults to "Player 1" or "Player 2"
- If sessionStorage unavailable: Falls back to "Player"
- Opponent not joined yet: Shows "Opponent"

## Visual Design

### Player Info Cards
**Active Player (Their Turn):**
- Blue-to-purple gradient background
- White text
- Glowing shadow
- Pulsing pointer icon
- Scaled up (105%)

**Inactive Player:**
- Gray background
- Dark text
- Normal size
- No special effects

### Name Input Screen
- Clean, focused design
- Large input field
- Auto-focus for quick entry
- Back button to return
- Disabled submit until name entered
- Maximum 20 characters

## Future Enhancements

Potential improvements:

- [ ] **Avatar Selection:** Choose from preset avatars
- [ ] **Color Themes:** Each player gets a unique color
- [ ] **Name Validation:** Profanity filter, special characters
- [ ] **Name History:** Remember recently used names
- [ ] **Guest Names:** Auto-generate fun names (Guest1234)
- [ ] **Emoji Support:** Allow emojis in names (or restrict them)
- [ ] **Username Length:** Dynamic font size for long names

## Testing Checklist

✅ **Create Game Flow:**
1. Click "Create New Game"
2. Enter name (e.g., "Alice")
3. See waiting room
4. Name appears in game UI

✅ **Join Game Flow:**
1. Enter room code
2. Click "Join Game"
3. Enter name (e.g., "Bob")
4. Both players see each other's names

✅ **In-Game Display:**
1. Player cards show both names
2. Status shows "{Name}'s Turn"
3. Grid headers show names
4. Power-up notifications show names
5. Win/lose messages show names

✅ **Edge Cases:**
1. Empty name → Submit disabled
2. Very long name → Truncated at 20 chars
3. Special characters → Allowed (for now)
4. No sessionStorage → Falls back to "Player"

---

**Names add personality and make the game feel more social!** 🎮


