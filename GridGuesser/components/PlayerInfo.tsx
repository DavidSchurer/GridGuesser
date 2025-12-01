"use client";

import Icon from "./Icon";

interface PlayerInfoProps {
  playerName: string;
  points: number;
  isActive: boolean;
  isYou?: boolean;
}

export default function PlayerInfo({
  playerName,
  points,
  isActive,
  isYou = false,
}: PlayerInfoProps) {
  return (
    <div className={`
      flex items-center gap-3 px-6 py-4 rounded-xl transition-all duration-300
      ${isActive 
        ? 'bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg scale-105' 
        : 'bg-gray-200 dark:bg-gray-700'
      }
    `}>
      <div className={`
        w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl
        ${isActive 
          ? 'bg-white text-blue-600' 
          : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
        }
      `}>
        {playerName.charAt(0).toUpperCase()}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className={`font-bold text-lg ${isActive ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
            {playerName}
          </h3>
          {isYou && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-white/30 text-white' : 'bg-blue-500 text-white'}`}>
              You
            </span>
          )}
        </div>
        <div className={`text-sm flex items-center gap-1 ${isActive ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}`}>
          <Icon name="target" size={14} />
          <span className="font-semibold">{points}</span> points
        </div>
      </div>

      {isActive && (
        <div className="animate-pulse">
          <Icon name="pointer" size={24} className="text-white" />
        </div>
      )}
    </div>
  );
}


