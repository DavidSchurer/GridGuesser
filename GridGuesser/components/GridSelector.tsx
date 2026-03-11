"use client";

import { Player } from "@/lib/types";

interface GridSelectorProps {
  players: Player[];
  myPlayerIndex: number;
  activePlayers: number[];
  placedPlayers: number[];
  selectedTarget: number | null;
  onSelectTarget: (playerIndex: number) => void;
}

export default function GridSelector({
  players,
  myPlayerIndex,
  activePlayers,
  placedPlayers,
  selectedTarget,
  onSelectTarget,
}: GridSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {players.map((player) => {
        if (player.playerIndex === myPlayerIndex) return null;

        const isPlaced = placedPlayers.includes(player.playerIndex);
        const isActive = activePlayers.includes(player.playerIndex);
        const isSelected = selectedTarget === player.playerIndex;

        return (
          <button
            key={player.playerIndex}
            onClick={() => !isPlaced && onSelectTarget(player.playerIndex)}
            disabled={isPlaced}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
              ${isSelected
                ? "bg-orange-500 text-white shadow-md ring-2 ring-orange-300"
                : isPlaced
                ? "bg-gray-600 text-gray-400 cursor-not-allowed line-through"
                : "bg-gray-700 text-gray-200 hover:bg-gray-600"
              }
            `}
          >
            {player.name}
            {isPlaced && " (placed)"}
          </button>
        );
      })}
    </div>
  );
}
