# Power-Ups System 🎮

## Overview

GridGuesser now features an exciting power-up system that adds strategic depth to the gameplay! Players earn points by revealing tiles and can spend those points on powerful abilities.

## How It Works

### Earning Points
- **+1 Point** for each tile you reveal on your opponent's grid
- Points accumulate throughout the game
- Both players can see each other's point totals

### Power-Ups Sidebar
A dedicated sidebar appears on the right side of the game screen showing:
- Your current points
- Opponent's current points
- Available power-ups with costs
- Visual indicators for which power-ups you can afford

## Available Power-Ups

### 1. Skip Turn (5 Points)
**Icon:** Clock  
**Effect:** Forces your opponent to skip their next turn  
**Strategy:** Use this to maintain momentum when you're on a roll!

**How to Use:**
1. Click the "Skip Turn" power-up button
2. Immediately activated - opponent loses their next turn
3. You get to take another turn right after

### 2. Reveal 2x2 (8 Points)
**Icon:** Target  
**Effect:** Reveals a 2x2 area (4 tiles) on opponent's grid  
**Strategy:** Use this when you think you've found an interesting area!

**How to Use:**
1. Click the "Reveal 2x2" power-up button
2. The sidebar shows instructions to select a tile
3. Click on any tile in the opponent's grid
4. A 2x2 area starting from that tile (top-left corner) is revealed
5. All 4 tiles are revealed instantly (or up to 4 if near edges)

### 3. Nuke (15 Points)
**Icon:** Alert Triangle  
**Effect:** Reveals the ENTIRE opponent's image (all 100 tiles)  
**Strategy:** Ultimate power! Use when you're confident you can guess the image!

**How to Use:**
1. Click the "Nuke" power-up button
2. Immediately activated - all tiles revealed
3. Now you can see the full image to make your guess!

## Tactical Considerations

### When to Save Points
- Early game: Focus on revealing tiles strategically
- Save for Nuke if you're behind and need a big reveal
- Use Skip Turn to deny your opponent key moments

### When to Spend Points
- Use Reveal 2x2 when you spot interesting patterns
- Skip Turn is great when your opponent is close to guessing
- Nuke is risky but powerful - use when confident in your guess

### Point Economy
- **5 tiles revealed** = 1 Skip Turn
- **8 tiles revealed** = 1 Reveal 2x2
- **15 tiles revealed** = 1 Nuke
- Balance between revealing tiles and using power-ups!

## Visual Design

### Affordable Power-Ups
- Purple/pink gradient background
- Glowing border
- Hover effect with scale animation
- Clear "Use" button

### Unaffordable Power-Ups
- Grayed out
- Disabled cursor
- Shows cost requirement

### Active Selection (Reveal 2x2)
- Yellow instruction banner appears
- Selected power-up has purple ring
- Click anywhere to cancel

## Technical Details

### Server Events
```typescript
// Use a power-up
socket.emit("use-power-up", {
  roomId: string,
  powerUpId: 'skip' | 'reveal2x2' | 'nuke',
  tileIndex?: number  // Required for reveal2x2
});

// Power-up used notification
socket.on("power-up-used", {
  powerUpId: string,
  usedBy: number,
  message: string,
  points: [number, number],
  revealedTiles?: number[],
  allRevealedTiles?: [number[], number[]]
});
```

### Game State Updates
The `GameRoom` interface now includes:
```typescript
points: [number, number]  // Points for each player
```

## Future Enhancements

Potential additions to the power-up system:

- [ ] **Hint**: Show the category of the image (3 points)
- [ ] **Freeze**: Freeze opponent's points for 2 turns (6 points)
- [ ] **Swap**: Swap a revealed tile with an unrevealed one (4 points)
- [ ] **Peek**: See one tile without revealing it (3 points)
- [ ] **Double Points**: Next 3 reveals give 2 points each (7 points)
- [ ] Power-up cooldowns to prevent spam
- [ ] Power-up animations and sound effects
- [ ] Achievement system for power-up usage

## Balancing Notes

Current costs are balanced for a typical 10-15 tile game:
- Skip Turn: Cheap enough for regular use
- Reveal 2x2: Mid-tier strategic option
- Nuke: Expensive endgame option

Adjust costs in `GridGuesser/server/index.ts` if needed:
```typescript
const powerUpCosts: Record<string, number> = {
  skip: 5,
  reveal2x2: 8,
  nuke: 15,
};
```

## Tips for Players

1. **Don't Hoard Points**: Use power-ups strategically rather than saving for Nuke
2. **Skip Turn is Strong**: Denying opponent turns can be game-winning
3. **Reveal 2x2 on Corners**: Reveals 4 tiles efficiently
4. **Nuke Before Guessing**: If unsure, use Nuke to see the full image
5. **Watch Opponent Points**: Anticipate when they might use power-ups

---

**Have fun with the new power-up system! May the best strategist win!** 🏆

