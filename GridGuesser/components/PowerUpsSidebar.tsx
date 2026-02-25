"use client";

import { useState } from "react";
import Icon from "./Icon";

export interface PowerUp {
  id: string;
  name: string;
  cost: number;
  description: string;
  icon: string;
  // How the power-up is activated
  activation: 'instant' | 'selectTile' | 'selectLine';
}

interface PowerUpsSidebarProps {
  myPoints: number;
  opponentPoints: number;
  isMyTurn: boolean;
  onUsePowerUp: (powerUpId: string, tileIndex?: number, lineType?: 'row' | 'col', lineIndex?: number) => void;
  disabled?: boolean;
  isFrozen?: boolean; // player is frozen and can't use power-ups this turn
}

const ITEMS_PER_PAGE = 3;

const powerUps: PowerUp[] = [
  {
    id: 'peek',
    name: 'Peek',
    cost: 4,
    description: 'Glimpse a 3x3 area for 5 seconds',
    icon: 'peek',
    activation: 'selectTile',
  },
  {
    id: 'skip',
    name: 'Skip Turn',
    cost: 5,
    description: 'Opponent skips their next turn',
    icon: 'clock',
    activation: 'instant',
  },
  {
    id: 'revealLine',
    name: 'Reveal Row/Col',
    cost: 6,
    description: 'Reveal an entire row or column',
    icon: 'revealLine',
    activation: 'selectTile',
  },
  {
    id: 'freeze',
    name: 'Freeze',
    cost: 6,
    description: 'Block opponent from using power-ups next turn',
    icon: 'freeze',
    activation: 'instant',
  },
  {
    id: 'fog',
    name: 'Fog of War',
    cost: 8,
    description: 'Re-hide 4 tiles on your image',
    icon: 'fog',
    activation: 'instant',
  },
  {
    id: 'reveal2x2',
    name: 'Reveal 2x2',
    cost: 8,
    description: 'Reveal a 2x2 area on opponent\'s grid',
    icon: 'grid2x2',
    activation: 'selectTile',
  },
  {
    id: 'nuke',
    name: 'Nuke',
    cost: 30,
    description: 'Reveal the entire opponent\'s image (no more guess points)',
    icon: 'nuke',
    activation: 'instant',
  },
];

export default function PowerUpsSidebar({
  myPoints,
  opponentPoints,
  isMyTurn,
  onUsePowerUp,
  disabled = false,
  isFrozen = false,
}: PowerUpsSidebarProps) {
  const [selectedPowerUp, setSelectedPowerUp] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(powerUps.length / ITEMS_PER_PAGE);
  const visiblePowerUps = powerUps.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const handlePowerUpClick = (powerUp: PowerUp) => {
    if (disabled || isFrozen || myPoints < powerUp.cost || !isMyTurn) return;

    if (powerUp.activation === 'selectTile') {
      setSelectedPowerUp(powerUp.id);
      onUsePowerUp(powerUp.id); // Notify parent to enter tile-select mode
    } else {
      // Instant power-ups
      onUsePowerUp(powerUp.id);
      setSelectedPowerUp(null);
    }
  };

  const handleCancel = () => {
    setSelectedPowerUp(null);
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

      {/* Instructions for active power-ups */}
      {selectedPowerUp === 'reveal2x2' && (
        <div className="bg-purple-100 dark:bg-purple-900 border-2 border-purple-400 dark:border-purple-600 rounded-lg p-4 animate-fade-in">
          <p className="text-sm text-purple-900 dark:text-purple-100 font-bold mb-1">2x2 Reveal Mode</p>
          <p className="text-xs text-purple-800 dark:text-purple-200 mb-2">Click a tile on opponent&apos;s grid to reveal a 2x2 area.</p>
          <button onClick={handleCancel} className="text-xs text-purple-700 dark:text-purple-300 bg-purple-200 dark:bg-purple-800 px-2 py-1 rounded hover:bg-purple-300 dark:hover:bg-purple-700 transition-colors">Cancel</button>
        </div>
      )}

      {selectedPowerUp === 'peek' && (
        <div className="bg-amber-100 dark:bg-amber-900 border-2 border-amber-400 dark:border-amber-600 rounded-lg p-4 animate-fade-in">
          <p className="text-sm text-amber-900 dark:text-amber-100 font-bold mb-1">Peek Mode</p>
          <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">Click a tile on opponent&apos;s grid to peek at a 3x3 area for 5 seconds.</p>
          <button onClick={handleCancel} className="text-xs text-amber-700 dark:text-amber-300 bg-amber-200 dark:bg-amber-800 px-2 py-1 rounded hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors">Cancel</button>
        </div>
      )}

      {selectedPowerUp === 'revealLine' && (
        <div className="bg-teal-100 dark:bg-teal-900 border-2 border-teal-400 dark:border-teal-600 rounded-lg p-4 animate-fade-in">
          <p className="text-sm text-teal-900 dark:text-teal-100 font-bold mb-1">Reveal Row/Col Mode</p>
          <p className="text-xs text-teal-800 dark:text-teal-200 mb-1">Hover over the grid to preview. Click to reveal.</p>
          <p className="text-xs text-teal-800 dark:text-teal-200 mb-2">
            Press <kbd className="px-1.5 py-0.5 bg-teal-200 dark:bg-teal-800 rounded font-mono font-bold">R</kbd> for row, <kbd className="px-1.5 py-0.5 bg-teal-200 dark:bg-teal-800 rounded font-mono font-bold">C</kbd> for column.
          </p>
          <button onClick={handleCancel} className="text-xs text-teal-700 dark:text-teal-300 bg-teal-200 dark:bg-teal-800 px-2 py-1 rounded hover:bg-teal-300 dark:hover:bg-teal-700 transition-colors">Cancel</button>
        </div>
      )}

      {/* Power-Ups List (paginated) */}
      <div className="space-y-3">
        {visiblePowerUps.map((powerUp) => {
          const affordable = canAfford(powerUp.cost);
          const isSelected = selectedPowerUp === powerUp.id;
          const canUse = affordable && isMyTurn && !disabled && !isFrozen;

          return (
            <button
              key={powerUp.id}
              onClick={() => handlePowerUpClick(powerUp)}
              disabled={!canUse}
              className={`
                w-full p-4 rounded-lg border-2 transition-all duration-200
                ${canUse
                  ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 hover:shadow-lg hover:scale-105 cursor-pointer'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed'
                }
                ${isSelected ? 'ring-4 ring-purple-400 scale-105' : ''}
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${canUse ? 'bg-purple-500' : 'bg-gray-400'}`}>
                  <Icon name={powerUp.icon} size={24} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">
                      {powerUp.name}
                    </h3>
                    <span className={`
                      px-2 py-1 rounded-full text-xs font-bold
                      ${canUse
                        ? 'bg-purple-500 text-white' 
                        : 'bg-gray-400 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                      }
                    `}>
                      {powerUp.cost} pts
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {powerUp.description}
                  </p>
                </div>
              </div>
            </button>
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
