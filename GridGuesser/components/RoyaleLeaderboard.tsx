"use client";

import { Player, RoyalePlacement } from "@/lib/types";
import GameGrid from "@/components/GameGrid";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const FULL_GRID = Array.from({ length: 100 }, (_, i) => i);

interface RoyaleLeaderboardProps {
  placements: RoyalePlacement[];
  imageNames: string[];
  players: Player[];
  imageHashes: string[];
  myPlayerIndex: number | null;
  onClose?: () => void;
}

const PLACE_STYLES: Record<number, { label: string; color: string; icon: string }> = {
  1: { label: "1st", color: "from-yellow-400 to-amber-500", icon: "\uD83E\uDD47" },
  2: { label: "2nd", color: "from-gray-300 to-gray-400", icon: "\uD83E\uDD48" },
  3: { label: "3rd", color: "from-orange-400 to-orange-500", icon: "\uD83E\uDD49" },
  4: { label: "4th", color: "text-gray-400", icon: "" },
};

/**
 * Same silhouette as 🥇🥈🥉 (disc + ribbon) but monochrome: disc fill matches modal `bg-gray-900`,
 * ribbon in muted grays — no gold/silver/bronze tint.
 */
function FourthPlaceMedal() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={48}
      height={48}
      className="shrink-0"
      aria-hidden
    >
      {/* Ribbon tails (behind disc, same family as emoji medals) */}
      <path
        d="M11 31 L14.5 25 L18 31 L16.2 43.5 L13.8 43.5 Z"
        fill="#1f2937"
        stroke="#4b5563"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
      <path
        d="M37 31 L33.5 25 L30 31 L31.8 43.5 L34.2 43.5 Z"
        fill="#1f2937"
        stroke="#4b5563"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
      {/* Medal disc — #111827 = Tailwind gray-900 (modal panel background) */}
      <circle cx={24} cy={19} r={12} fill="#111827" stroke="#6b7280" strokeWidth={1.2} />
      <text
        x={24}
        y={23.5}
        textAnchor="middle"
        fill="#e5e7eb"
        fontSize={14}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
      >
        4
      </text>
    </svg>
  );
}

function playerLabel(players: Player[], index: number): string {
  return players.find((p) => p.playerIndex === index)?.name ?? `Player ${index + 1}`;
}

export default function RoyaleLeaderboard({
  placements,
  imageNames,
  players,
  imageHashes,
  myPlayerIndex,
  onClose,
}: RoyaleLeaderboardProps) {
  const router = useRouter();

  const sortedBySlot = [...players].sort((a, b) => a.playerIndex - b.playerIndex);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-3xl font-bold text-center text-white mb-2">
          Grid Royale Results
        </h2>
        <p className="text-gray-400 text-center mb-6 text-sm">
          Final Standings
        </p>

        <div className="space-y-3">
          {placements.map((p, i) => {
            const style = PLACE_STYLES[p.place] || PLACE_STYLES[4];
            const isMe = p.playerIndex === myPlayerIndex;

            return (
              <motion.div
                key={p.playerIndex}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className={`
                  flex items-center gap-4 p-4 rounded-xl
                  ${isMe ? "ring-2 ring-blue-400 bg-gray-800" : "bg-gray-800/50"}
                `}
              >
                <div className="w-12 shrink-0 flex items-center justify-center">
                  {p.place === 4 ? <FourthPlaceMedal /> : <span className="text-3xl text-center">{style.icon}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-lg truncate">
                      {p.name}
                    </span>
                    {isMe && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    {p.points} points
                    {p.guess && (
                      <span className="ml-2 text-green-400">
                        &mdash; guessed &quot;{p.guess}&quot;
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={
                    p.place === 4
                      ? "text-xl font-bold text-gray-400"
                      : `text-xl font-bold bg-gradient-to-r ${style.color} bg-clip-text text-transparent`
                  }
                >
                  {style.label}
                </div>
              </motion.div>
            );
          })}
        </div>

        {imageNames.length > 0 && (
          <div className="mt-6 p-4 bg-gray-800/50 rounded-xl">
            <p className="text-xs text-gray-400 mb-2 font-medium">Answers:</p>
            <div className="flex flex-wrap gap-2">
              {imageNames.map((name, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-700 text-gray-200 rounded-lg text-sm capitalize"
                >
                  {playerLabel(players, i)}: {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {sortedBySlot.some((p) => imageHashes[p.playerIndex]) && (
          <div className="mt-6">
            <p className="text-xs text-gray-400 mb-3 font-medium">Images</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedBySlot.filter((p) => imageHashes[p.playerIndex]).map((p) => {
                const hash = imageHashes[p.playerIndex] || "";
                const isMe = p.playerIndex === myPlayerIndex;
                return (
                  <div
                    key={p.playerIndex}
                    className={`flex flex-col items-center rounded-xl border p-3 ${
                      isMe ? "border-blue-500/60 bg-gray-800/80" : "border-gray-700 bg-gray-800/40"
                    }`}
                  >
                    <h3 className="text-sm font-semibold text-gray-100 mb-2 flex items-center gap-2">
                      <span className="truncate max-w-[200px]">{p.name}</span>
                      {isMe && (
                        <span className="text-[10px] shrink-0 bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </h3>
                    <GameGrid
                      imageHash={hash}
                      revealedTiles={FULL_GRID}
                      isMyTurn={false}
                      isOpponentGrid={true}
                      disabled={true}
                      compact
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-200"
          >
            Back to Home
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-all duration-200"
            >
              Close
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
