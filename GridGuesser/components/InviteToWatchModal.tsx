"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InviteToWatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  spectatorCode: string | null;
  watcherCount?: number;
}

export default function InviteToWatchModal({ isOpen, onClose, spectatorCode, watcherCount = 0 }: InviteToWatchModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const getSpectatorLink = () => {
    if (!spectatorCode || typeof window === "undefined") return "";
    return `${window.location.origin}/spectate/${spectatorCode}`;
  };

  const handleCopyCode = async () => {
    if (!spectatorCode) return;
    try {
      await navigator.clipboard.writeText(spectatorCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleCopyLink = async () => {
    const link = getSpectatorLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span aria-hidden>&#128065;</span> Invite to Watch
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Share this code with a friend so they can watch the game live. Spectators
              can see tile reveals, guesses, hints, and power-ups — but they can&apos;t play.
            </p>

            {spectatorCode ? (
              <>
                <div className="mb-6 p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl text-center">
                  <p className="text-xs uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-2 font-semibold">
                    Spectator Code
                  </p>
                  <p className="font-mono font-bold text-4xl tracking-[0.3em] text-amber-900 dark:text-amber-100 select-all">
                    {spectatorCode}
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleCopyCode}
                    className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    {copiedCode ? "Copied!" : "Copy Code"}
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-3 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg font-semibold transition-colors"
                  >
                    {copiedLink ? "Link copied!" : "Copy Spectator Link"}
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-600 dark:text-gray-400">
                  <span aria-hidden>&#128065;</span>{" "}
                  {watcherCount === 0
                    ? "No one watching yet"
                    : watcherCount === 1
                    ? "1 person watching"
                    : `${watcherCount} people watching`}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                Loading spectator code&hellip;
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
