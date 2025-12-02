# Secure Tile Implementation

## Overview
GridGuesser now uses server-side image processing to prevent cheating. Images are split into 100 individual tiles on the server, and only revealed tiles are sent to the client.

## How It Works

### 1. Image Processing
When a game starts, the server:
- Downloads/accesses the full image
- Resizes it to 1000x1000 pixels (maintaining aspect ratio)
- Splits it into 100 individual tiles (10x10 grid, each 100x100px)
- Stores tiles in `/public/tiles/{imageHash}/`
- Generates an MD5 hash of the image URL as the identifier

### 2. Security Features
- **Never sends full image URL**: Client only receives imageHash
- **Tile-by-tile access**: API serves individual tiles, not the full image
- **Validated requests**: Server validates tile index (0-99)
- **Filtered game state**: Full URLs removed from game state responses

### 3. API Endpoint
```
GET /api/tiles/:imageHash/:tileIndex
```
- `imageHash`: MD5 hash of the original image URL
- `tileIndex`: 0-99 (tile position in the grid)
- Returns: Individual JPEG tile (100x100px)

### 4. Client Implementation
- GameGrid component fetches individual tiles as they're revealed
- Uses Next.js Image component for optimized loading
- No access to full image at any point

## Files Modified

### Backend
- `lib/tileGenerator.ts` - New service for splitting images
- `server/index.ts` - Added tile serving endpoint, filtered game state
- `lib/gameRoomService.ts` - Integrated tile generation
- `lib/types.ts` - Added imageHashes field

### Frontend
- `components/GameGrid.tsx` - Changed to fetch individual tiles
- `app/game/[roomId]/page.tsx` - Updated to use imageHashes

## Testing Anti-Cheat

To verify the implementation is secure:
1. Start a game and reveal some tiles
2. Open Developer Tools (F12)
3. Check Network tab - only individual tile requests visible
4. Inspect element - no full image URL in DOM
5. Check game state responses - imageHashes only, no full URLs

## Performance Notes
- Initial tile generation takes 2-3 seconds per image
- Tiles are cached - subsequent games reuse existing tiles
- Each tile is ~5-15KB (JPEG quality 85)
- Total storage: ~100KB per image

## Cleanup
Tiles are stored persistently in `/public/tiles/`. To manually clean up:
- Delete `/public/tiles/{imageHash}/` directory
- Or use `cleanupTiles(imageHash)` function programmatically


