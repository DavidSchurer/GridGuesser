"use client";

import { useState } from "react";
import Image from "next/image";

interface GameGridProps {
  imageId: string;
  revealedTiles: number[];
  isMyTurn: boolean;
  isOpponentGrid: boolean;
  onTileClick?: (tileIndex: number) => void;
  disabled?: boolean;
  reveal2x2Mode?: boolean;
}

export default function GameGrid({
  imageId,
  revealedTiles,
  isMyTurn,
  isOpponentGrid,
  onTileClick,
  disabled = false,
  reveal2x2Mode = false,
}: GameGridProps) {
  const [loadingTile, setLoadingTile] = useState<number | null>(null);
  const [hoveredTile, setHoveredTile] = useState<number | null>(null);

  const handleTileClick = (tileIndex: number) => {
    if (disabled || !isMyTurn || !isOpponentGrid) {
      return;
    }

    // In reveal2x2 mode, allow clicking on any tile (even revealed ones)
    // The server will handle which tiles to reveal
    if (!reveal2x2Mode && revealedTiles.includes(tileIndex)) {
      return;
    }
    
    setLoadingTile(tileIndex);
    onTileClick?.(tileIndex);
    
    // Clear loading state after animation
    setTimeout(() => setLoadingTile(null), 500);
  };

  // Calculate all 4 tiles in the 2x2 area starting from tileIndex
  const get2x2Tiles = (tileIndex: number): number[] => {
    const row = Math.floor(tileIndex / 10);
    const col = tileIndex % 10;
    const tiles: number[] = [];

    // Ensure we don't go beyond grid boundaries
    const maxRow = Math.min(row + 2, 10);
    const maxCol = Math.min(col + 2, 10);

    for (let r = row; r < maxRow; r++) {
      for (let c = col; c < maxCol; c++) {
        tiles.push(r * 10 + c);
      }
    }

    return tiles;
  };

  // Check if a tile should be highlighted in 2x2 mode
  const isIn2x2Area = (tileIndex: number): boolean => {
    if (!reveal2x2Mode || hoveredTile === null || !isOpponentGrid) {
      return false;
    }
    
    // Calculate the 2x2 area based on hoveredTile
    const tiles2x2 = get2x2Tiles(hoveredTile);
    return tiles2x2.includes(tileIndex);
  };

  // Handle mouse enter on a tile
  const handleTileHover = (tileIndex: number) => {
    if (reveal2x2Mode && isOpponentGrid) {
      setHoveredTile(tileIndex);
    }
  };

  // Handle mouse leave from the entire grid
  const handleGridMouseLeave = () => {
    if (reveal2x2Mode && isOpponentGrid) {
      setHoveredTile(null);
    }
  };

  const getTileImage = (tileIndex: number) => {
    // In production, these would be pre-generated tiles
    // For MVP, we'll use a simple approach with CSS
    const row = Math.floor(tileIndex / 10);
    const col = tileIndex % 10;
    
    return {
      backgroundImage: `url(/images/${imageId}.jpg)`,
      backgroundSize: '1000%',
      backgroundPosition: `${col * 11.111}% ${row * 11.111}%`,
    };
  };

  return (
    <div className="w-full max-w-[600px]">
      <div 
        className="grid-container" 
        onMouseLeave={handleGridMouseLeave}
      >
        {Array.from({ length: 100 }).map((_, index) => {
          const isRevealed = revealedTiles.includes(index);
          const isClickable = isOpponentGrid && isMyTurn && !disabled && (reveal2x2Mode || !isRevealed);
          const isLoading = loadingTile === index;
          const isIn2x2 = isIn2x2Area(index);

          return (
            <div
              key={index}
              onClick={() => handleTileClick(index)}
              onMouseEnter={() => handleTileHover(index)}
              className={`
                tile relative
                ${isRevealed ? 'revealed' : ''}
                ${isClickable && !reveal2x2Mode ? 'cursor-pointer hover:scale-105 hover:z-10 hover:shadow-lg' : ''}
                ${isClickable && reveal2x2Mode ? 'cursor-crosshair' : ''}
                ${!isClickable && !isRevealed ? 'bg-gray-300 dark:bg-gray-700' : ''}
                ${disabled ? 'disabled' : ''}
                ${isLoading ? 'animate-pulse' : ''}
                ${isIn2x2 && !isRevealed ? '!bg-purple-300 dark:!bg-purple-700 ring-4 ring-purple-500 scale-[1.08] z-[30] shadow-2xl' : ''}
                ${isIn2x2 && isRevealed ? 'ring-4 ring-purple-400 scale-[1.05] z-[25]' : ''}
                transition-all duration-150 ease-out
              `}
            >
              {isRevealed ? (
                <div
                  className="tile-image animate-fade-in"
                  style={getTileImage(index)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-xs font-mono">
                  {index + 1}
                  {isIn2x2 && reveal2x2Mode && (
                    <div className="absolute inset-0 bg-purple-500 opacity-40 animate-pulse pointer-events-none" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
        {isOpponentGrid ? "Opponent's Grid" : "Your Grid"}
        <span className="ml-2 font-semibold">
          ({revealedTiles.length}/100 revealed)
        </span>
      </div>
    </div>
  );
}

