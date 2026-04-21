"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import GameGrid from "@/components/GameGrid";
import PlayerInfo from "@/components/PlayerInfo";
import Icon from "@/components/Icon";
import SpectatorFeed, { FeedEvent } from "@/components/SpectatorFeed";
import { motion } from "framer-motion";

// Minimal shape of the sanitized spectator state sent by the server
interface SpectatorRoom {
  roomId: string;
  gameState: "waiting" | "playing" | "finished";
  gameMode: "normal" | "royale";
  maxPlayers: number;
  category?: string;
  customQuery?: string;
  players: { id: string; playerIndex: number; name: string; isAi?: boolean }[];
  points: number[];
  currentTurn: number;
  revealedTiles: number[][];
  imageHashes: string[];
  maskedImageNames: string[];
  imageNames?: string[];
  winner?: number;
  nukeUsed?: boolean[];
  freezeActive?: boolean[];
  skipTurnActive?: boolean;
  spectatorCount: number;
}

// Same power-up catalog as the player sidebar, in ascending cost order.
// Used to show which power-ups each player can currently afford.
const POWER_UPS = [
  { id: "peek", name: "Peek", cost: 4, icon: "peek" },
  { id: "skip", name: "Skip Turn", cost: 5, icon: "clock" },
  { id: "revealLine", name: "Reveal Row/Col", cost: 6, icon: "revealLine" },
  { id: "freeze", name: "Freeze", cost: 6, icon: "freeze" },
  { id: "fog", name: "Fog of War", cost: 8, icon: "fog" },
  { id: "reveal2x2", name: "Reveal 2x2", cost: 8, icon: "grid2x2" },
  { id: "nuke", name: "Nuke", cost: 30, icon: "nuke" },
];

function eventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function powerUpLabel(id: string): string {
  const match = POWER_UPS.find((p) => p.id === id);
  return match ? match.name : id;
}

export default function SpectatePage() {
  const params = useParams();
  const router = useRouter();
  const rawCode = params.code as string;
  const code = (rawCode || "").toUpperCase();

  const [socket, setSocket] = useState<ReturnType<typeof connectSocket> | null>(null);
  const [room, setRoom] = useState<SpectatorRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [joined, setJoined] = useState(false);

  // Use a ref for the latest room so event handlers don't close over stale state
  const roomRef = useRef<SpectatorRoom | null>(null);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const pushEvent = (ev: Omit<FeedEvent, "id" | "timestamp">) => {
    setEvents((prev) =>
      [
        { ...ev, id: eventId(), timestamp: Date.now() },
        ...prev,
      ].slice(0, 60)
    );
  };

  useEffect(() => {
    if (!code || code.length < 4) {
      setError("Invalid spectator code");
      return;
    }

    const sock = connectSocket();
    setSocket(sock);

    sock.emit("join-as-spectator", { code }, (result: { success: boolean; state?: SpectatorRoom; error?: string }) => {
      if (!result.success || !result.state) {
        setError(result.error || "Failed to join as spectator");
        return;
      }
      setRoom(result.state);
      setJoined(true);
      pushEvent({
        type: "info",
        message: `Joined as spectator. ${result.state.spectatorCount} watching.`,
      });
    });

    // Re-fetch full state on significant events to stay in sync.
    const refetch = () => {
      sock.emit("get-spectator-state", { code }, (state: SpectatorRoom | null) => {
        if (state) setRoom(state);
      });
    };

    // ── Event listeners ──────────────────────────────────────────────
    sock.on("tile-revealed", (data: { tileIndex: number; playerIndex: number; revealedBy: number }) => {
      // playerIndex here is the OWNER of the tile (whose image was revealed on);
      // revealedBy is the player who acted.
      const current = roomRef.current;
      const actorName = current?.players[data.revealedBy]?.name || `Player ${data.revealedBy + 1}`;
      const targetName = current?.players[data.playerIndex]?.name || `Player ${data.playerIndex + 1}`;
      pushEvent({
        type: "tile",
        playerIndex: data.revealedBy,
        playerName: actorName,
        message: `revealed a tile on ${targetName}'s grid`,
      });
      refetch();
    });

    sock.on("guess-made", (data: { playerIndex: number; playerName: string; guess: string; correct: boolean; targetPlayerIndex?: number }) => {
      pushEvent({
        type: data.correct ? "guessCorrect" : "guessWrong",
        playerIndex: data.playerIndex,
        playerName: data.playerName,
        message: `guessed "${data.guess}" — ${data.correct ? "correct!" : "wrong"}`,
      });
      refetch();
    });

    sock.on("hint-revealed", (data: { playerIndex: number; char: string; targetPlayerIndex?: number }) => {
      const current = roomRef.current;
      const actorName = current?.players[data.playerIndex]?.name || `Player ${data.playerIndex + 1}`;
      pushEvent({
        type: "hint",
        playerIndex: data.playerIndex,
        playerName: actorName,
        message: `bought a hint — letter "${data.char?.toUpperCase?.() || data.char}" revealed`,
      });
      refetch();
    });

    sock.on("power-up-used", (data: { powerUpId: string; usedBy: number; targetPlayer?: number; message?: string }) => {
      const current = roomRef.current;
      const actorName = current?.players[data.usedBy]?.name || `Player ${data.usedBy + 1}`;
      const targetName =
        data.targetPlayer !== undefined && data.targetPlayer !== data.usedBy
          ? current?.players[data.targetPlayer]?.name || `Player ${data.targetPlayer + 1}`
          : null;
      pushEvent({
        type: "powerup",
        playerIndex: data.usedBy,
        playerName: actorName,
        message: `used ${powerUpLabel(data.powerUpId)}${targetName ? ` on ${targetName}` : ""}`,
      });
      refetch();
    });

    sock.on("game-end", (data: { winner: number; winnerGuess: string; correctAnswer: string; imageNames?: string[] }) => {
      const current = roomRef.current;
      const winnerName = current?.players[data.winner]?.name || `Player ${data.winner + 1}`;
      pushEvent({
        type: "guessCorrect",
        playerIndex: data.winner,
        playerName: winnerName,
        message: `won with "${data.winnerGuess}"! Answer: ${data.correctAnswer}`,
      });
      refetch();
    });

    sock.on("spectator-count-changed", (data: { count: number }) => {
      setRoom((prev) => (prev ? { ...prev, spectatorCount: data.count } : prev));
    });

    sock.on("player-disconnected", (data: { playerIndex: number; message: string }) => {
      const current = roomRef.current;
      const name = current?.players[data.playerIndex]?.name || `Player ${data.playerIndex + 1}`;
      pushEvent({ type: "info", message: `${name} disconnected` });
    });

    sock.on("player-reconnected", (data: { playerIndex: number; message: string }) => {
      const current = roomRef.current;
      const name = current?.players[data.playerIndex]?.name || `Player ${data.playerIndex + 1}`;
      pushEvent({ type: "info", message: `${name} reconnected` });
    });

    sock.on("game-start", () => {
      pushEvent({ type: "info", message: "Game starting..." });
      refetch();
    });

    sock.on("rematch-start", () => {
      pushEvent({ type: "info", message: "Rematch started — new images loaded" });
      setEvents((prev) => prev.slice(0, 1)); // keep only rematch event
      refetch();
    });

    return () => {
      if (sock.connected) {
        sock.emit("leave-spectator");
      }
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ── Render states ───────────────────────────────────────────────────

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-5xl mb-3" aria-hidden>
            &#9888;
          </div>
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-3">Can&apos;t Spectate</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold transition-all duration-200"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  if (!room || !joined) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="animate-pulse-slow mb-4 flex justify-center">
            <Icon name="gamepad" size={64} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Joining as Spectator&hellip;
          </h2>
          <p className="text-gray-600 dark:text-gray-400 font-mono">{code}</p>
        </div>
      </main>
    );
  }

  const isRoyale = room.gameMode === "royale";
  const p0 = room.players[0];
  const p1 = room.players[1];

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center gap-2">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors shrink-0"
          >
            ← Leave
          </button>
          <div className="text-center flex-1 min-w-0">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent mb-1">
              Spectating
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {room.players.map((p) => p.name).join(" vs ")}
              {room.category && <> &middot; {room.category}</>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-lg text-xs font-mono font-bold">
              {code}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span aria-hidden>&#128065;</span> {room.spectatorCount} watching
            </span>
          </div>
        </div>

        {/* Game state banner */}
        {room.gameState === "waiting" && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-center text-blue-700 dark:text-blue-300">
            Waiting for the game to start&hellip;
          </div>
        )}
        {room.gameState === "finished" && room.winner !== undefined && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-xl text-center"
          >
            <p className="text-lg font-bold text-green-800 dark:text-green-200">
              <span aria-hidden>&#127942; </span>
              {room.players[room.winner]?.name} won!
            </p>
          </motion.div>
        )}

        {/* Player cards (only for normal 2-player mode; royale has its own layout) */}
        {!isRoyale && p0 && p1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <PlayerInfo
              playerName={p0.name}
              points={room.points[0] || 0}
              isActive={room.currentTurn === 0 && room.gameState === "playing"}
              aiBadge={p0.isAi}
            />
            <PlayerInfo
              playerName={p1.name}
              points={room.points[1] || 0}
              isActive={room.currentTurn === 1 && room.gameState === "playing"}
              aiBadge={p1.isAi}
            />
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            {/* Grids */}
            <div className={`grid gap-6 ${room.players.length > 2 ? "grid-cols-1 lg:grid-cols-2 xl:grid-cols-2" : "grid-cols-1 lg:grid-cols-2"}`}>
              {room.players.map((player, idx) => {
                const points = room.points[idx] || 0;
                const nameRevealed = room.gameState === "finished" && room.imageNames?.[idx];
                const masked = (() => {
                  // Royale masked names are JSON arrays per viewer; spectator server returns
                  // a flattened per-image masked string. If parse fails, show raw string.
                  const raw = room.maskedImageNames?.[idx] || "";
                  try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                      const self = parsed.find((e: any) => e.playerIndex === idx);
                      return self?.masked || raw;
                    }
                  } catch {}
                  return raw;
                })();

                const affordable = POWER_UPS.filter((p) => points >= p.cost);

                return (
                  <div key={player.id} className="flex flex-col items-center">
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                      <span className="text-amber-600 dark:text-amber-400">{player.name}</span>
                      {room.currentTurn === idx && room.gameState === "playing" && (
                        <span className="text-xs px-2 py-0.5 bg-amber-500 text-white rounded-full">Turn</span>
                      )}
                    </h3>

                    <GameGrid
                      imageHash={room.imageHashes[idx] || ""}
                      revealedTiles={room.revealedTiles[idx] || []}
                      isMyTurn={false}
                      isOpponentGrid={true}
                      disabled={true}
                    />

                    {/* Masked / revealed answer */}
                    <div className="mt-3 w-full max-w-[600px]">
                      {nameRevealed ? (
                        <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg px-4 py-3 text-center">
                          <p className="text-xs text-green-600 dark:text-green-400 mb-1 font-medium">Answer</p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-300 capitalize">
                            {room.imageNames?.[idx]}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg px-4 py-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Image Name</p>
                          <div className="font-mono text-xl tracking-[0.3em] text-gray-800 dark:text-gray-100 overflow-x-auto whitespace-nowrap">
                            {masked.split("").map((ch, i) => (
                              <span
                                key={i}
                                className={ch === "_" ? "text-gray-400 dark:text-gray-500" : "text-green-600 dark:text-green-400 font-bold"}
                              >
                                {ch === " " ? "\u00A0\u00A0" : ch}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Player stat bar: points + unlocked power-ups */}
                    <div className="mt-3 w-full max-w-[600px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {points} pts
                        </span>
                        {room.nukeUsed?.[idx] && (
                          <span className="text-xs text-red-500">Nuke used</span>
                        )}
                        {room.freezeActive?.[idx] && (
                          <span className="text-xs text-cyan-500">Frozen</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {POWER_UPS.map((pu) => {
                          const canAfford = points >= pu.cost;
                          return (
                            <span
                              key={pu.id}
                              title={`${pu.name} (${pu.cost} pts)`}
                              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 ${
                                canAfford
                                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 line-through"
                              }`}
                            >
                              {pu.name} · {pu.cost}
                            </span>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                        {affordable.length} of {POWER_UPS.length} power-ups unlocked
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center text-xs text-gray-500 dark:text-gray-400 italic">
              <span aria-hidden>&#128065;</span> Spectator view — you cannot interact with the game
            </div>
          </div>

          {/* Event feed sidebar */}
          <div className="xl:sticky xl:top-8 xl:self-start">
            <SpectatorFeed events={events} />
          </div>
        </div>
      </div>
    </main>
  );
}
