"use client";

import { useState } from "react";

interface RoomCodeDisplayProps {
  roomCode: string;
}

export default function RoomCodeDisplay({ roomCode }: RoomCodeDisplayProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const getInviteLink = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/game/${roomCode}`;
    }
    return `/game/${roomCode}`;
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(getInviteLink());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch gap-2 text-sm">
      {/* Invite Link */}
      <button
        onClick={copyInviteLink}
        className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/50 px-3 py-2 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors cursor-pointer min-w-0"
        title="Copy invite link"
      >
        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">Link:</span>
        <span className="font-mono text-xs text-blue-600 dark:text-blue-300 break-all">
          {getInviteLink()}
        </span>
        <span className="shrink-0 text-xs font-semibold text-blue-500 dark:text-blue-400">
          {copiedLink ? "Copied!" : "Copy"}
        </span>
      </button>

      <span className="text-gray-400 dark:text-gray-600 text-xs hidden sm:flex items-center">|</span>

      {/* Room Code */}
      <button
        onClick={copyRoomCode}
        className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900/50 px-3 py-2 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors cursor-pointer"
        title="Copy room code"
      >
        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">Code:</span>
        <span className="font-mono font-bold text-sm text-purple-600 dark:text-purple-300">
          {roomCode}
        </span>
        <span className="shrink-0 text-xs font-semibold text-purple-500 dark:text-purple-400">
          {copiedCode ? "Copied!" : "Copy"}
        </span>
      </button>
    </div>
  );
}
