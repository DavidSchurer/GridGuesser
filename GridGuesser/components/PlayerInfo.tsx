"use client";

interface PlayerInfoProps {
  playerName: string;
  points: number;
  isActive: boolean;
  isYou?: boolean;
  compact?: boolean;
}

export default function PlayerInfo({
  playerName,
  points,
  isActive,
  isYou = false,
  compact = false,
}: PlayerInfoProps) {
  return (
    <div className={`
      flex items-center rounded-xl transition-all duration-300 shrink-0
      ${compact ? 'px-2 py-1.5 gap-1.5 max-w-[115px]' : 'px-6 py-4 gap-3'}
      ${isActive 
        ? 'bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg' 
        : 'bg-gray-200 dark:bg-gray-700'
      }
    `}>
      <div className={`
        rounded-full flex items-center justify-center font-bold shrink-0
        ${compact ? 'w-6 h-6 text-xs' : 'w-12 h-12 text-xl'}
        ${isActive 
          ? 'bg-white text-blue-600' 
          : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
        }
      `}>
        {playerName.charAt(0).toUpperCase()}
      </div>
      
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1">
          <h3 className={`font-bold truncate ${compact ? 'text-xs' : 'text-lg'} ${isActive ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
            {playerName}
          </h3>
          {isYou && (
            <span className={`shrink-0 text-[10px] px-1 py-0.5 rounded ${isActive ? 'bg-white/30 text-white' : 'bg-blue-500 text-white'}`}>
              You
            </span>
          )}
        </div>
        <div className={`${compact ? 'text-[10px]' : 'text-sm'} ${isActive ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}`}>
          <span className="font-semibold">{points}</span> pts
        </div>
      </div>

      {isActive && !compact && (
        <div className="animate-pulse shrink-0 text-2xl">
          ▶
        </div>
      )}
    </div>
  );
}



