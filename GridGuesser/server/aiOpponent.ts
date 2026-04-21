/**
 * Server-side AI opponent for normal mode (player index 1, human is 0).
 */
import type { Server } from "socket.io";
import { getGameRoom } from "../lib/gameRoomService";
import type { AiDifficulty, GameRoom } from "../lib/types";
import {
  applyPowerUpNormal,
  applyRevealTileNormal,
  applySubmitGuessNormal,
  applyUseHintNormal,
  type NormalPowerUpPayload,
} from "./normalModeActions";
import {
  getCategoryDisplayName,
  hasGeminiApiKey,
  heuristicGuessFromMasked,
  suggestGuessWithGemini,
} from "../lib/aiGuessService";

const AI_INDEX = 1;
const HUMAN_INDEX = 0;

export function scheduleAiTurn(roomId: string, io: Server): void {
  const delay = 400 + Math.random() * 800;
  setTimeout(() => {
    runAiTurn(roomId, io).catch((e) => console.error("AI turn error:", e));
  }, delay);
}

function buildMaskedForGuesser(room: GameRoom, guesserIndex: number): string {
  const opponentIdx = 1 - guesserIndex;
  const name = room.imageNames[opponentIdx] || "";
  const revealed = new Set(room.revealedHints?.[guesserIndex] || []);
  return Array.from(name)
    .map((ch, i) => {
      if (/\s/.test(ch)) return " ";
      if (!/[a-zA-Z0-9]/.test(ch)) return ch;
      return revealed.has(i) ? ch : "_";
    })
    .join("");
}

function unrevealedTilesOnOpponent(room: GameRoom, aiIndex: number): number[] {
  const opp = 1 - aiIndex;
  const revealed = new Set(room.revealedTiles[opp]);
  return Array.from({ length: 100 }, (_, i) => i).filter((i) => !revealed.has(i));
}

function shouldTryHint(room: GameRoom, diff: AiDifficulty): boolean {
  const masked = buildMaskedForGuesser(room, AI_INDEX);
  const hidden = (masked.match(/_/g) || []).length;
  if (hidden === 0) return false;
  if (diff === "easy") return Math.random() < 0.05;
  if (diff === "medium") return Math.random() < 0.35;
  return Math.random() < 0.65;
}

function pickRevealTile(room: GameRoom, diff: AiDifficulty, unrevealed: number[]): number | null {
  if (unrevealed.length === 0) return null;
  if (diff === "easy") {
    return unrevealed[Math.floor(Math.random() * unrevealed.length)];
  }
  const existing = room.revealedTiles[HUMAN_INDEX];
  if (existing.length === 0) {
    return unrevealed[Math.floor(Math.random() * unrevealed.length)];
  }
  let best = unrevealed[0];
  let bestScore = -1;
  for (const t of unrevealed) {
    const tr = Math.floor(t / 10);
    const tc = t % 10;
    let minD = 999;
    for (const e of existing) {
      const er = Math.floor(e / 10);
      const ec = e % 10;
      const d = Math.abs(tr - er) + Math.abs(tc - ec);
      if (d < minD) minD = d;
    }
    const score = minD + (diff === "hard" ? Math.random() * 3 : Math.random() * 1.5);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function pickPowerUpAction(room: GameRoom, diff: AiDifficulty): NormalPowerUpPayload | null {
  const p = room.points[AI_INDEX];
  const unr = unrevealedTilesOnOpponent(room, AI_INDEX);
  if (unr.length === 0) return null;

  const roll = Math.random();
  if (diff === "easy") {
    if (p >= 4 && roll < 0.1) {
      return { powerUpId: "peek", tileIndex: unr[Math.floor(Math.random() * unr.length)] };
    }
    return null;
  }
  if (diff === "medium") {
    if (p >= 6 && unr.length > 55 && roll < 0.22) {
      return {
        powerUpId: "revealLine",
        lineType: Math.random() < 0.5 ? "row" : "col",
        lineIndex: Math.floor(Math.random() * 10),
      };
    }
    if (p >= 4 && roll < 0.28) {
      return { powerUpId: "peek", tileIndex: unr[Math.floor(Math.random() * unr.length)] };
    }
    if (p >= 8 && roll < 0.18) {
      return { powerUpId: "reveal2x2", tileIndex: unr[Math.floor(Math.random() * unr.length)] };
    }
    return null;
  }
  if (p >= 30 && roll < 0.1) {
    return { powerUpId: "nuke" };
  }
  if (p >= 8 && roll < 0.32) {
    return { powerUpId: "reveal2x2", tileIndex: unr[Math.floor(Math.random() * unr.length)] };
  }
  if (p >= 6 && roll < 0.28) {
    return {
      powerUpId: "revealLine",
      lineType: Math.random() < 0.5 ? "row" : "col",
      lineIndex: Math.floor(Math.random() * 10),
    };
  }
  if (p >= 4 && roll < 0.32) {
    return { powerUpId: "peek", tileIndex: unr[Math.floor(Math.random() * unr.length)] };
  }
  if (p >= 6 && roll < 0.22) {
    return { powerUpId: "freeze" };
  }
  if (p >= 5 && roll < 0.18) {
    return { powerUpId: "skip" };
  }
  return null;
}

function formatHumanGuessLog(room: GameRoom): string {
  const entries = (room.guessLog || []).filter((e) => e.playerIndex === HUMAN_INDEX).slice(-8);
  if (entries.length === 0) return "";
  return entries.map((e) => `"${e.text}"`).join(" | ");
}

async function produceGuess(room: GameRoom, diff: AiDifficulty, masked: string): Promise<string> {
  const category = room.category || "landmarks";
  const customQuery = room.customQuery;
  const revealedTileCount = room.revealedTiles[HUMAN_INDEX].length;
  const displayCategory = getCategoryDisplayName(category, customQuery);
  const meta = room.imageMetadata?.[HUMAN_INDEX];
  const imageUrl = meta?.thumbnailUrl || room.images?.[HUMAN_INDEX] || meta?.url || undefined;

  const g = await suggestGuessWithGemini({
    difficulty: diff,
    category,
    displayCategory,
    customQuery,
    maskedTitle: masked,
    revealedTileCount,
    humanTilesRevealedOnTarget: revealedTileCount,
    aiTilesRevealedOnOwnImage: room.revealedTiles[AI_INDEX].length,
    guessLogSummary: formatHumanGuessLog(room),
    opponentImageUrl: imageUrl,
  });
  if (g) return g;
  return heuristicGuessFromMasked(category, masked, diff);
}

async function runAiTurn(roomId: string, io: Server): Promise<void> {
  const room = await getGameRoom(roomId);
  if (!room || !room.vsAi || room.gameState !== "playing" || room.currentTurn !== AI_INDEX) {
    return;
  }
  const diff: AiDifficulty = room.aiDifficulty || "medium";

  if (room.points[AI_INDEX] >= 3 && shouldTryHint(room, diff)) {
    const hr = await applyUseHintNormal(roomId, AI_INDEX, io);
    if (hr.ok) {
      scheduleAiTurn(roomId, io);
      return;
    }
  }

  const pu = pickPowerUpAction(room, diff);
  if (pu) {
    const pr = await applyPowerUpNormal(roomId, AI_INDEX, pu, io);
    if (pr.ok) {
      if (pr.room.currentTurn === HUMAN_INDEX) return;
      scheduleAiTurn(roomId, io);
      return;
    }
  }

  const fresh = await getGameRoom(roomId);
  if (!fresh || fresh.currentTurn !== AI_INDEX || fresh.gameState !== "playing") return;

  const masked = buildMaskedForGuesser(fresh, AI_INDEX);
  const unrevealed = unrevealedTilesOnOpponent(fresh, AI_INDEX);
  const underscoreRatio = (masked.match(/_/g) || []).length / Math.max(1, masked.length);

  const gemini = hasGeminiApiKey();
  const guessBias = gemini
    ? diff === "hard"
      ? 0.55
      : diff === "medium"
        ? 0.4
        : 0.28
    : diff === "hard"
      ? 0.42
      : diff === "medium"
        ? 0.28
        : 0.14;
  const preferGuess =
    Math.random() < guessBias ||
    (diff === "hard" && underscoreRatio < 0.45 && unrevealed.length < 35);

  if (preferGuess) {
    const guess = await produceGuess(fresh, diff, masked);
    const gr = await applySubmitGuessNormal(roomId, AI_INDEX, guess, io);
    if (!gr.ok) {
      const tile = pickRevealTile(fresh, diff, unrevealed);
      if (tile !== null) await applyRevealTileNormal(roomId, AI_INDEX, tile, io);
      return;
    }
    if (gr.correct) return;
    return;
  }

  const tile = pickRevealTile(fresh, diff, unrevealed);
  if (tile === null) {
    const guess = await produceGuess(fresh, diff, masked);
    await applySubmitGuessNormal(roomId, AI_INDEX, guess, io);
    return;
  }

  const rr = await applyRevealTileNormal(roomId, AI_INDEX, tile, io);
  if (!rr.ok) {
    const guess = await produceGuess(fresh, diff, masked);
    await applySubmitGuessNormal(roomId, AI_INDEX, guess, io);
    return;
  }
  if (rr.room.currentTurn === HUMAN_INDEX) return;
  scheduleAiTurn(roomId, io);
}
