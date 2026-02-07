"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface GameGridProps {
  imageHash: string; // Changed from imageId to imageHash
  revealedTiles: number[];
  isMyTurn: boolean;
  isOpponentGrid: boolean;
  onTileClick?: (tileIndex: number) => void;
  disabled?: boolean;
  reveal2x2Mode?: boolean;
}

export default function GameGrid({
  imageHash,
  revealedTiles,
  isMyTurn,
  isOpponentGrid,
  onTileClick,
  disabled = false,
  reveal2x2Mode = false,
}: GameGridProps) {
  const [loadingTile, setLoadingTile] = useState<number | null>(null);
  const [hoveredTile, setHoveredTile] = useState<number | null>(null);
  
  // Force reset when imageHash changes (on rematch)
  const gridKey = `${imageHash}-${revealedTiles.length}`;
  
  // Reset component state when imageHash changes (new game)
  useEffect(() => {
    setLoadingTile(null);
    setHoveredTile(null);
  }, [imageHash]);

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

  // Get tile URL from server - only individual tiles are served
  const getTileUrl = (tileIndex: number): string => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    return `${apiBase}/tiles/${imageHash}/${tileIndex}`;
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
            <motion.div
              key={`${imageHash}-tile-${index}`}
              onClick={() => handleTileClick(index)}
              onMouseEnter={() => handleTileHover(index)}
              whileHover={isClickable && !reveal2x2Mode ? { scale: 1.05, zIndex: 10 } : {}}
              whileTap={isClickable ? { scale: 0.95 } : {}}
              className={`
                tile relative
                ${isRevealed ? 'revealed' : ''}
                ${isClickable && !reveal2x2Mode ? 'cursor-pointer' : ''}
                ${isClickable && reveal2x2Mode ? 'cursor-crosshair' : ''}
                ${!isClickable && !isRevealed ? 'bg-gray-300 dark:bg-gray-700' : ''}
                ${disabled ? 'disabled' : ''}
                ${isLoading ? 'animate-pulse' : ''}
                ${isIn2x2 && !isRevealed ? '!bg-purple-300 dark:!bg-purple-700 ring-4 ring-purple-500 scale-[1.08] z-[30] shadow-2xl' : ''}
                ${isIn2x2 && isRevealed ? 'ring-4 ring-purple-400 scale-[1.05] z-[25]' : ''}
                transition-all duration-150 ease-out
              `}
            >
              <AnimatePresence mode="wait">
                {isRevealed ? (
                  <motion.div
                    key={`${imageHash}-revealed-${index}`}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ 
                      duration: 0.4,
                      ease: "easeOut"
                    }}
                    className="w-full h-full"
                  >
                    <Image
                      src={getTileUrl(index)}
                      alt={`Tile ${index + 1}`}
                      width={100}
                      height={100}
                      className="tile-image w-full h-full object-cover"
                      unoptimized
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={`${imageHash}-hidden-${index}`}
                    initial={{ rotateY: -90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: 90, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-xs font-mono"
                  >
                    {index + 1}
                    {isIn2x2 && reveal2x2Mode && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        className="absolute inset-0 bg-purple-500 pointer-events-none"
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
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

