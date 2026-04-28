"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface GameGridProps {
  imageHash: string;
  revealedTiles: number[];
  isMyTurn: boolean;
  isOpponentGrid: boolean;
  onTileClick?: (tileIndex: number) => void;
  disabled?: boolean;
  reveal2x2Mode?: boolean;
  peekMode?: boolean;
  peekTiles?: number[]; // tiles temporarily visible via Peek power-up
  revealLineMode?: boolean;
  lineDirection?: 'row' | 'col';
  compact?: boolean; // smaller grid for royale multi-grid layout
}

export default function GameGrid({
  imageHash,
  revealedTiles,
  isMyTurn,
  isOpponentGrid,
  onTileClick,
  disabled = false,
  reveal2x2Mode = false,
  peekMode = false,
  peekTiles = [],
  revealLineMode = false,
  lineDirection = 'col',
  compact = false,
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

    // In reveal2x2, peekMode, or revealLineMode, allow clicking on any tile (even revealed ones)
    if (!reveal2x2Mode && !peekMode && !revealLineMode && revealedTiles.includes(tileIndex)) {
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

    const maxRow = Math.min(row + 2, 10);
    const maxCol = Math.min(col + 2, 10);

    for (let r = row; r < maxRow; r++) {
      for (let c = col; c < maxCol; c++) {
        tiles.push(r * 10 + c);
      }
    }

    return tiles;
  };

  // Calculate 3x3 area centered on tileIndex (for peek hover preview)
  const get3x3Tiles = (tileIndex: number): number[] => {
    const row = Math.floor(tileIndex / 10);
    const col = tileIndex % 10;
    const tiles: number[] = [];

    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (r >= 0 && r < 10 && c >= 0 && c < 10) {
          tiles.push(r * 10 + c);
        }
      }
    }

    return tiles;
  };

  // Get all tiles in the same row as the given tile
  const getRowTiles = (tileIndex: number): number[] => {
    const row = Math.floor(tileIndex / 10);
    return Array.from({ length: 10 }, (_, c) => row * 10 + c);
  };

  // Get all tiles in the same column as the given tile
  const getColTiles = (tileIndex: number): number[] => {
    const col = tileIndex % 10;
    return Array.from({ length: 10 }, (_, r) => r * 10 + col);
  };

  // Check if a tile should be highlighted in 2x2 mode
  const isIn2x2Area = (tileIndex: number): boolean => {
    if (!reveal2x2Mode || hoveredTile === null || !isOpponentGrid) {
      return false;
    }
    return get2x2Tiles(hoveredTile).includes(tileIndex);
  };

  // Check if a tile should be highlighted in peek mode
  const isInPeekArea = (tileIndex: number): boolean => {
    if (!peekMode || hoveredTile === null || !isOpponentGrid) {
      return false;
    }
    return get3x3Tiles(hoveredTile).includes(tileIndex);
  };

  // Check if a tile should be highlighted in revealLine mode
  const isInLineArea = (tileIndex: number): boolean => {
    if (!revealLineMode || hoveredTile === null || !isOpponentGrid) {
      return false;
    }
    const lineTiles = lineDirection === 'row' ? getRowTiles(hoveredTile) : getColTiles(hoveredTile);
    return lineTiles.includes(tileIndex);
  };

  // Handle mouse enter on a tile
  const handleTileHover = (tileIndex: number) => {
    if ((reveal2x2Mode || peekMode || revealLineMode) && isOpponentGrid) {
      setHoveredTile(tileIndex);
    }
  };

  // Handle mouse leave from the entire grid
  const handleGridMouseLeave = () => {
    if ((reveal2x2Mode || peekMode || revealLineMode) && isOpponentGrid) {
      setHoveredTile(null);
    }
  };

  // Get tile URL from server
  const getTileUrl = (tileIndex: number): string => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL 
      || (process.env.NEXT_PUBLIC_SOCKET_URL ? `${process.env.NEXT_PUBLIC_SOCKET_URL}/api` : 'http://localhost:3001/api');
    return `${apiBase}/tiles/${imageHash}/${tileIndex}`;
  };

  return (
    <div className={compact ? "w-full max-w-[min(360px,30vw)] mx-auto" : "w-full max-w-[600px]"}>
      <div 
        className={`grid-container ${compact ? "compact" : ""}`}
        onMouseLeave={handleGridMouseLeave}
      >
        {Array.from({ length: 100 }).map((_, index) => {
          const isRevealed = revealedTiles.includes(index);
          const isPeeking = peekTiles.includes(index); // temporarily visible via Peek
          const showImage = isRevealed || isPeeking;
          const isClickable = isOpponentGrid && isMyTurn && !disabled && (reveal2x2Mode || peekMode || revealLineMode || !isRevealed);
          const isLoading = loadingTile === index;
          const isIn2x2 = isIn2x2Area(index);
          const isInPeek = isInPeekArea(index);
          const isInLine = isInLineArea(index);

          return (
            <motion.div
              key={`${imageHash}-tile-${index}`}
              onClick={() => handleTileClick(index)}
              onMouseEnter={() => handleTileHover(index)}
              whileHover={isClickable && !reveal2x2Mode && !peekMode && !revealLineMode ? { scale: 1.05, zIndex: 10 } : {}}
              whileTap={isClickable ? { scale: 0.95 } : {}}
              className={`
                tile relative
                ${showImage ? 'revealed' : ''}
                ${isClickable && !reveal2x2Mode && !peekMode && !revealLineMode ? 'cursor-pointer' : ''}
                ${isClickable && (reveal2x2Mode || peekMode || revealLineMode) ? 'cursor-crosshair' : ''}
                ${!isClickable && !showImage ? 'bg-gray-300 dark:bg-gray-700' : ''}
                ${disabled ? 'disabled' : ''}
                ${isLoading ? 'animate-pulse' : ''}
                ${isIn2x2 && !isRevealed ? '!bg-purple-300 dark:!bg-purple-700 ring-4 ring-purple-500 scale-[1.08] z-[30] shadow-2xl' : ''}
                ${isIn2x2 && isRevealed ? 'ring-4 ring-purple-400 scale-[1.05] z-[25]' : ''}
                ${isInPeek && !isRevealed ? '!bg-amber-300 dark:!bg-amber-700 ring-4 ring-amber-500 scale-[1.08] z-[30] shadow-2xl' : ''}
                ${isInPeek && isRevealed ? 'ring-4 ring-amber-400 scale-[1.05] z-[25]' : ''}
                ${isInLine && !isRevealed ? '!bg-teal-300 dark:!bg-teal-700 ring-4 ring-teal-500 scale-[1.08] z-[30] shadow-2xl' : ''}
                ${isInLine && isRevealed ? 'ring-4 ring-teal-400 scale-[1.05] z-[25]' : ''}
                ${isPeeking && !isRevealed ? 'ring-2 ring-amber-400 z-[20]' : ''}
                transition-all duration-150 ease-out
              `}
            >
              <AnimatePresence mode="wait">
                {showImage ? (
                  <motion.div
                    key={`${imageHash}-revealed-${index}-${isPeeking ? 'peek' : 'perm'}`}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: isPeeking && !isRevealed ? 0.85 : 1 }}
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
                    {/* Peek shimmer overlay */}
                    {isPeeking && !isRevealed && (
                      <div className="absolute inset-0 bg-amber-400/20 animate-pulse pointer-events-none" />
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key={`${imageHash}-hidden-${index}`}
                    initial={{ rotateY: -90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: 90, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600 font-mono ${compact ? "" : "text-xs"}`}
                  >
                    {compact ? "" : index + 1}
                    {isIn2x2 && reveal2x2Mode && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        className="absolute inset-0 bg-purple-500 pointer-events-none"
                      />
                    )}
                    {isInPeek && peekMode && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        className="absolute inset-0 bg-amber-500 pointer-events-none"
                      />
                    )}
                    {isInLine && revealLineMode && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        className="absolute inset-0 bg-teal-500 pointer-events-none"
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
        <span className="font-semibold">
          {revealedTiles.length}/100 revealed
        </span>
      </div>
    </div>
  );
}
