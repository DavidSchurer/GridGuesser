"use client";

import { useState } from "react";
import Icon from "./Icon";

interface RoomCodeDisplayProps {
  roomCode: string;
}

export default function RoomCodeDisplay({ roomCode }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900 px-4 py-2 rounded-lg">
      <span className="text-sm text-gray-600 dark:text-gray-300">Room Code:</span>
      <span className="font-mono font-bold text-xl text-blue-600 dark:text-blue-300">
        {roomCode}
      </span>
      <button
        onClick={copyToClipboard}
        className="ml-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors flex items-center gap-1"
        title="Copy room code"
      >
        {copied ? (
          <>
            <Icon name="check" size={16} />
            Copied!
          </>
        ) : (
          <>
            <Icon name="clipboard" size={16} />
            Copy
          </>
        )}
      </button>
    </div>
  );
}

