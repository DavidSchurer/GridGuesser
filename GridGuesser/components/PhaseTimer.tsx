"use client";

import { useState, useEffect } from "react";
import { RoyalePhase } from "@/lib/types";
import { motion } from "framer-motion";

interface PhaseTimerProps {
  phase: RoyalePhase;
  phaseEndTime: number;
  round: number;
  hasActed: boolean; // whether the current player has acted this phase
  compact?: boolean;
}

export default function PhaseTimer({ phase, phaseEndTime, round, hasActed, compact }: PhaseTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, Math.ceil((phaseEndTime - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [phaseEndTime]);

  const isReveal = phase === "reveal";
  const isGuess = phase === "guess";
  const isIdle = phase === "idle";

  const bgColor = isReveal
    ? "from-cyan-500 to-blue-600"
    : isGuess
    ? "from-amber-500 to-orange-600"
    : "from-gray-400 to-gray-500";

  const label = isReveal
    ? "REVEAL PHASE"
    : isGuess
    ? "GUESS PHASE"
    : "WAITING...";

  const sublabel = hasActed
    ? "Waiting for other players..."
    : isReveal
    ? "Click a tile on any opponent's grid"
    : isGuess
    ? "Guess any opponent's image"
    : "";

  const progressPct = phaseEndTime > 0
    ? Math.max(0, Math.min(100, (secondsLeft / 20) * 100))
    : 0;

  return (
    <div className={`w-full rounded-xl bg-gradient-to-r ${bgColor} shadow-lg ${compact ? 'p-3' : 'p-4'}`}>
      <div className={`flex items-center justify-between text-white ${compact ? 'mb-1' : 'mb-2'}`}>
        <div>
          <div className={`font-medium uppercase tracking-wider opacity-80 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            Round {round}
          </div>
          <div className={`font-bold ${compact ? 'text-base' : 'text-xl'}`}>{label}</div>
          {sublabel && (
            <div className={`opacity-80 ${compact ? 'text-xs' : 'text-sm'}`}>{sublabel}</div>
          )}
        </div>
        <div className="text-right">
          <motion.div
            key={secondsLeft}
            initial={{ scale: 1.3, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`font-bold tabular-nums ${compact ? 'text-2xl' : 'text-4xl'} ${secondsLeft <= 5 ? "text-red-200" : ""}`}
          >
            {secondsLeft}s
          </motion.div>
        </div>
      </div>
      <div className={`bg-white/20 rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-2'}`}>
        <motion.div
          className="h-full bg-white/60 rounded-full"
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}
