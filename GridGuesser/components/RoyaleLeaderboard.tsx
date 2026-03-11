"use client";

import { RoyalePlacement } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface RoyaleLeaderboardProps {
  placements: RoyalePlacement[];
  imageNames: string[];
  myPlayerIndex: number | null;
  onClose?: () => void;
}

const PLACE_STYLES: Record<number, { label: string; color: string; icon: string }> = {
  1: { label: "1st", color: "from-yellow-400 to-amber-500", icon: "\uD83E\uDD47" },
  2: { label: "2nd", color: "from-gray-300 to-gray-400", icon: "\uD83E\uDD48" },
  3: { label: "3rd", color: "from-orange-400 to-orange-500", icon: "\uD83E\uDD49" },
  4: { label: "4th", color: "from-gray-500 to-gray-600", icon: "4th" },
};

export default function RoyaleLeaderboard({
  placements,
  imageNames,
  myPlayerIndex,
  onClose,
}: RoyaleLeaderboardProps) {
  const router = useRouter();

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
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-lg w-full"
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
                <div className="text-3xl w-12 text-center shrink-0">
                  {style.icon}
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
                  className={`text-xl font-bold bg-gradient-to-r ${style.color} bg-clip-text text-transparent`}
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
                  P{i + 1}: {name}
                </span>
              ))}
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
