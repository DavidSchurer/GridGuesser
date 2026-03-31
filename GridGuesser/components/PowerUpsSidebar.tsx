"use client";

import { useState } from "react";
import Icon from "./Icon";
import { Player, GameMode } from "@/lib/types";

export interface PowerUp {
  id: string;
  name: string;
  cost: number;
  description: string;
  /** Shown when the (i) button is toggled — replaces the old separate instruction panels */
  detailHint: string;
  icon: string;
  activation: 'instant' | 'selectTile' | 'selectLine';
  needsTarget?: boolean; // in royale, requires choosing an opponent
}

interface PowerUpsSidebarProps {
  myPoints: number;
  opponentPoints: number;
  isMyTurn: boolean;
  /** Tile-select modes (peek, reveal2x2, revealLine) — owned by parent so highlight clears after use */
  selectedPowerUp: string | null;
  onUsePowerUp: (powerUpId: string, tileIndex?: number, lineType?: 'row' | 'col', lineIndex?: number, targetPlayerIndex?: number) => void;
  disabled?: boolean;
  isFrozen?: boolean;
  gameMode?: GameMode;
  players?: Player[];
  myPlayerIndex?: number;
  activePlayers?: number[];
}

const ITEMS_PER_PAGE = 3;

const powerUps: PowerUp[] = [
  {
    id: 'peek',
    name: 'Peek',
    cost: 4,
    description: 'Glimpse a 3x3 area for 5 seconds',
    detailHint: 'Click a tile on the opponent\'s grid to peek at a 3×3 area for 5 seconds.',
    icon: 'peek',
    activation: 'selectTile',
  },
  {
    id: 'skip',
    name: 'Skip Turn',
    cost: 5,
    description: 'Target skips their next reveal phase',
    detailHint: 'Choose a player. They skip their next reveal phase.',
    icon: 'clock',
    activation: 'instant',
    needsTarget: true,
  },
  {
    id: 'revealLine',
    name: 'Reveal Row/Col',
    cost: 6,
    description: 'Reveal an entire row or column',
    detailHint: 'Hover over the grid to preview, then click to reveal. Press R for row mode or C for column mode.',
    icon: 'revealLine',
    activation: 'selectTile',
  },
  {
    id: 'freeze',
    name: 'Freeze',
    cost: 6,
    description: 'Block a player from using power-ups next turn',
    detailHint: 'Choose a player. They cannot use power-ups on their next turn.',
    icon: 'freeze',
    activation: 'instant',
    needsTarget: true,
  },
  {
    id: 'fog',
    name: 'Fog of War',
    cost: 8,
    description: 'Re-hide 4 tiles on your image',
    detailHint: 'Four of your revealed tiles are hidden again for your opponent to re-reveal.',
    icon: 'fog',
    activation: 'instant',
  },
  {
    id: 'reveal2x2',
    name: 'Reveal 2x2',
    cost: 8,
    description: 'Reveal a 2x2 area on an opponent\'s grid',
    detailHint: 'Click a tile on the opponent\'s grid to reveal a 2×2 block of tiles.',
    icon: 'grid2x2',
    activation: 'selectTile',
  },
  {
    id: 'nuke',
    name: 'Nuke',
    cost: 30,
    description: 'Reveal a player\'s entire image (no more guess points)',
    detailHint: 'Choose a player. Their full image is revealed; they can no longer earn guess points from that image.',
    icon: 'nuke',
    activation: 'instant',
    needsTarget: true,
  },
];

export default function PowerUpsSidebar({
  myPoints,
  opponentPoints,
  isMyTurn,
  selectedPowerUp,
  onUsePowerUp,
  disabled = false,
  isFrozen = false,
  gameMode = 'normal',
  players = [],
  myPlayerIndex,
  activePlayers = [],
}: PowerUpsSidebarProps) {
  const [selectingTarget, setSelectingTarget] = useState<string | null>(null);
  /** Which power-up card has its (i) details expanded */
  const [infoOpenId, setInfoOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const isRoyale = gameMode === 'royale';
  const totalPages = Math.ceil(powerUps.length / ITEMS_PER_PAGE);
  const visiblePowerUps = powerUps.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const opponents = isRoyale
    ? players.filter(p => p.playerIndex !== myPlayerIndex && activePlayers.includes(p.playerIndex))
    : [];

  const handlePowerUpClick = (powerUp: PowerUp) => {
    if (disabled || isFrozen || myPoints < powerUp.cost || !isMyTurn) return;

    // In royale, if the power-up needs a target, show target picker
    if (isRoyale && powerUp.needsTarget) {
      setSelectingTarget(powerUp.id);
      return;
    }

    if (powerUp.activation === 'selectTile') {
      onUsePowerUp(powerUp.id);
    } else {
      onUsePowerUp(powerUp.id);
    }
  };

  const togglePowerUpInfo = (powerUpId: string) => {
    setInfoOpenId((prev) => (prev === powerUpId ? null : powerUpId));
  };

  const handleTargetSelected = (targetPlayerIndex: number) => {
    if (!selectingTarget) return;
    // For targeted instant power-ups in royale
    onUsePowerUp(selectingTarget, undefined, undefined, undefined, targetPlayerIndex);
    setSelectingTarget(null);
  };

  const handleCancel = () => {
    setSelectingTarget(null);
    onUsePowerUp('cancel');
  };

  const canAfford = (cost: number) => myPoints >= cost;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Power-Ups
        </h2>
      </div>

      {/* Frozen Warning */}
      {isFrozen && isMyTurn && !disabled && (
        <div className="bg-cyan-100 dark:bg-cyan-900/30 border border-cyan-400 dark:border-cyan-600 rounded-lg p-3">
          <p className="text-sm text-cyan-800 dark:text-cyan-200 text-center font-semibold">
            ❄️ You&apos;re frozen! No power-ups this turn.
          </p>
        </div>
      )}

      {/* Turn Indicator */}
      {!isMyTurn && !disabled && (
        <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Power-ups available on your turn
          </p>
        </div>
      )}

      {/* Points Display */}
      <div className="space-y-3">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Your Points</span>
            <span className="text-3xl font-bold">{myPoints}</span>
          </div>
          <p className="text-xs mt-1 opacity-90">+1 point per tile revealed</p>
        </div>

        <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Opponent Points</span>
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{opponentPoints}</span>
          </div>
        </div>
      </div>

      {/* Target Picker (Royale) */}
      {selectingTarget && isRoyale && (
        <div className="bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-400 dark:border-orange-600 rounded-lg p-4 animate-fade-in">
          <p className="text-sm text-orange-900 dark:text-orange-100 font-bold mb-2">
            Choose target for {powerUps.find(p => p.id === selectingTarget)?.name}:
          </p>
          <div className="space-y-2">
            {opponents.map((p) => (
              <button
                key={p.playerIndex}
                onClick={() => handleTargetSelected(p.playerIndex)}
                className="w-full px-3 py-2 bg-orange-200 dark:bg-orange-800 hover:bg-orange-300 dark:hover:bg-orange-700 text-orange-900 dark:text-orange-100 rounded-lg font-medium text-sm transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
          <button onClick={handleCancel} className="mt-2 text-xs text-orange-700 dark:text-orange-300 hover:underline">
            Cancel
          </button>
        </div>
      )}

      {/* Power-Ups List (paginated) */}
      <div className="space-y-3">
        {visiblePowerUps.map((powerUp) => {
          const affordable = canAfford(powerUp.cost);
          const isSelected = selectedPowerUp === powerUp.id;
          const canUse = affordable && isMyTurn && !disabled && !isFrozen;
          const isTileSelectActive = isSelected && powerUp.activation === 'selectTile';

          return (
            <div
              key={powerUp.id}
              className={`
                relative rounded-lg border-2 transition-all duration-200
                ${canUse
                  ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 opacity-50'
                }
                ${isSelected && canUse ? 'ring-4 ring-purple-400 scale-[1.02]' : ''}
              `}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePowerUpInfo(powerUp.id);
                }}
                className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-400 bg-white text-xs font-bold text-gray-600 shadow-sm transition-colors hover:border-purple-500 hover:bg-purple-50 hover:text-purple-700 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-purple-400 dark:hover:bg-purple-900/40 dark:hover:text-purple-200"
                aria-expanded={infoOpenId === powerUp.id}
                aria-label={`${infoOpenId === powerUp.id ? 'Hide' : 'Show'} details for ${powerUp.name}`}
              >
                i
              </button>
              <button
                type="button"
                onClick={() => handlePowerUpClick(powerUp)}
                disabled={!canUse}
                className={`
                  w-full p-4 pr-12 text-left rounded-lg transition-all duration-200
                  ${canUse ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed'}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${canUse ? 'bg-purple-500' : 'bg-gray-400'}`}>
                    <Icon name={powerUp.icon} size={24} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0 text-left pr-1">
                    <div className="flex items-start justify-between gap-2 mb-1 pr-1">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100">
                        {powerUp.name}
                      </h3>
                      <span
                        className={`
                          shrink-0 px-2 py-1 rounded-full text-xs font-bold tabular-nums
                          ${canUse
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-400 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                          }
                        `}
                      >
                        {powerUp.cost} pts
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {powerUp.description}
                    </p>
                  </div>
                </div>
              </button>
              {isTileSelectActive && (
                <div className="px-4 pb-3 pt-0">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="text-xs font-semibold text-purple-700 underline underline-offset-2 hover:text-purple-900 dark:text-purple-300 dark:hover:text-purple-100"
                  >
                    Cancel selection
                  </button>
                </div>
              )}
              {infoOpenId === powerUp.id && (
                <div className="border-t border-purple-200/80 bg-white/60 px-4 py-3 dark:border-purple-800/50 dark:bg-gray-900/40">
                  <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">{powerUp.detailHint}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className={`
            p-2 rounded-lg transition-colors
            ${page === 0
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
            }
          `}
          aria-label="Previous power-ups"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {page + 1} / {totalPages}
        </span>

        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page === totalPages - 1}
          className={`
            p-2 rounded-lg transition-colors
            ${page === totalPages - 1
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
            }
          `}
          aria-label="Next power-ups"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Info Footer */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Earn points by revealing tiles on opponent&apos;s grid!
        </p>
      </div>
    </div>
  );
}
