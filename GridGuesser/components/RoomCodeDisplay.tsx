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
    <div className="flex flex-col sm:flex-row items-center gap-2">
      {/* Invite Link */}
      <button
        onClick={copyInviteLink}
        className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/50 px-3 py-1.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors cursor-pointer"
        title="Copy invite link"
      >
        <span className="text-xs text-gray-500 dark:text-gray-400">Link:</span>
        <span className="font-mono text-xs text-blue-600 dark:text-blue-300 max-w-[180px] truncate">
          {getInviteLink()}
        </span>
        <span className="text-xs font-medium text-blue-500 dark:text-blue-400">
          {copiedLink ? "Copied!" : "Copy"}
        </span>
      </button>

      <span className="text-gray-400 dark:text-gray-600 text-xs hidden sm:inline">|</span>

      {/* Room Code */}
      <button
        onClick={copyRoomCode}
        className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900/50 px-3 py-1.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors cursor-pointer"
        title="Copy room code"
      >
        <span className="text-xs text-gray-500 dark:text-gray-400">Code:</span>
        <span className="font-mono font-bold text-lg text-purple-600 dark:text-purple-300">
          {roomCode}
        </span>
        <span className="text-xs font-medium text-purple-500 dark:text-purple-400">
          {copiedCode ? "Copied!" : "Copy"}
        </span>
      </button>
    </div>
  );
}
