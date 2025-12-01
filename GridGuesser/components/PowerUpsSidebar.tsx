"use client";

import { useState } from "react";
import Icon from "./Icon";

export interface PowerUp {
  id: 'skip' | 'reveal2x2' | 'nuke';
  name: string;
  cost: number;
  description: string;
  icon: string;
}

interface PowerUpsSidebarProps {
  myPoints: number;
  opponentPoints: number;
  isMyTurn: boolean;
  onUsePowerUp: (powerUpId: string, tileIndex?: number) => void;
  disabled?: boolean;
}

const powerUps: PowerUp[] = [
  {
    id: 'skip',
    name: 'Skip Turn',
    cost: 5,
    description: 'Force opponent to skip their next turn',
    icon: 'clock',
  },
  {
    id: 'reveal2x2',
    name: 'Reveal 2x2',
    cost: 8,
    description: 'Reveal a 2x2 area on opponent\'s grid',
    icon: 'target',
  },
  {
    id: 'nuke',
    name: 'Nuke',
    cost: 15,
    description: 'Reveal the entire opponent\'s image',
    icon: 'alert',
  },
];

export default function PowerUpsSidebar({
  myPoints,
  opponentPoints,
  isMyTurn,
  onUsePowerUp,
  disabled = false,
}: PowerUpsSidebarProps) {
  const [selectedPowerUp, setSelectedPowerUp] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const handlePowerUpClick = (powerUp: PowerUp) => {
    if (disabled || myPoints < powerUp.cost || !isMyTurn) return;

    if (powerUp.id === 'reveal2x2') {
      // For reveal2x2, we need the user to select a tile
      setSelectedPowerUp(powerUp.id);
      setShowInstructions(true);
      // Notify parent component to enable 2x2 mode
      onUsePowerUp(powerUp.id);
    } else {
      // For skip and nuke, execute immediately
      onUsePowerUp(powerUp.id);
      setSelectedPowerUp(null);
    }
  };

  const canAfford = (cost: number) => myPoints >= cost;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Icon name="gamepad" size={28} className="text-purple-500" />
          Power-Ups
        </h2>
      </div>

      {/* Turn Indicator */}
      {!isMyTurn && !disabled && (
        <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center flex items-center justify-center gap-2">
            <Icon name="clock" size={18} className="text-gray-500" />
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

      {/* Instructions */}
      {showInstructions && selectedPowerUp === 'reveal2x2' && (
        <div className="bg-purple-100 dark:bg-purple-900 border-2 border-purple-400 dark:border-purple-600 rounded-lg p-4 animate-fade-in">
          <div className="flex items-start gap-2">
            <Icon name="target" size={24} className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-purple-900 dark:text-purple-100 font-bold mb-1">
                2x2 Reveal Mode Active!
              </p>
              <p className="text-xs text-purple-800 dark:text-purple-200 mb-2">
                Hover over the opponent's grid to see the 2x2 area. Click anywhere to reveal all 4 tiles!
              </p>
              <button
                onClick={() => {
                  setSelectedPowerUp(null);
                  setShowInstructions(false);
                  // Notify parent to exit 2x2 mode
                  onUsePowerUp('cancel' as any);
                }}
                className="text-xs text-purple-700 dark:text-purple-300 bg-purple-200 dark:bg-purple-800 px-2 py-1 rounded hover:bg-purple-300 dark:hover:bg-purple-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Power-Ups List */}
      <div className="space-y-3">
        {powerUps.map((powerUp) => {
          const affordable = canAfford(powerUp.cost);
          const isSelected = selectedPowerUp === powerUp.id;
          const canUse = affordable && isMyTurn && !disabled;

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

      {/* Info Footer */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Icon name="lightbulb" size={14} className="text-yellow-500" />
          Earn points by revealing tiles on opponent's grid!
        </p>
      </div>
    </div>
  );
}

