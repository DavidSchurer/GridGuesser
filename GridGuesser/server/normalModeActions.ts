/**
 * Normal-mode game mutations shared by socket handlers and the AI opponent.
 */
import type { Server } from "socket.io";
import { getGameRoom, updateGameRoom } from "../lib/gameRoomService";
import type { GameRoom } from "../lib/types";
import { fuzzyMatchStrings } from "../lib/fuzzyMatch";

export function isSyntheticPlayer(room: GameRoom, playerIndex: number): boolean {
  const p = room.players[playerIndex];
  if (!p) return false;
  return !!p.isAi || p.id.startsWith("ai:");
}

export async function applyRevealTileNormal(
  roomId: string,
  playerIndex: number,
  tileIndex: number,
  io: Server
): Promise<{ ok: true; room: GameRoom } | { ok: false; error: string }> {
  const room = await getGameRoom(roomId);
  if (!room) return { ok: false, error: "Room not found" };
  if (room.gameMode !== "normal") return { ok: false, error: "Invalid mode" };
  if (room.gameState !== "playing") return { ok: false, error: "Game not in progress" };
  if (room.currentTurn !== playerIndex) return { ok: false, error: "Not your turn" };

  const opponentIndex = 1 - playerIndex;
  if (room.revealedTiles[opponentIndex].includes(tileIndex)) {
    return { ok: false, error: "Tile already revealed" };
  }

  room.revealedTiles[opponentIndex].push(tileIndex);
  room.points[playerIndex] += 1;

  if (room.freezeActive && room.freezeActive[playerIndex]) {
    room.freezeActive[playerIndex] = false;
  }

  if (room.skipTurnActive) {
    room.skipTurnActive = false;
  } else {
    room.currentTurn = 1 - room.currentTurn;
  }

  await updateGameRoom(room);

  io.to(roomId).emit("tile-revealed", {
    tileIndex,
    playerIndex: opponentIndex,
    revealedBy: playerIndex,
    currentTurn: room.currentTurn,
    imageHash: room.imageHashes[opponentIndex],
    points: room.points,
  });

  return { ok: true, room };
}

export async function applySubmitGuessNormal(
  roomId: string,
  playerIndex: number,
  guess: string,
  io: Server
): Promise<
  | { ok: true; correct: true; room: GameRoom }
  | { ok: true; correct: false; room: GameRoom }
  | { ok: false; error: string }
> {
  const room = await getGameRoom(roomId);
  if (!room) return { ok: false, error: "Room not found" };
  if (room.gameMode !== "normal") return { ok: false, error: "Invalid mode" };
  if (room.gameState !== "playing") return { ok: false, error: "Game not in progress" };

  const opponentIndex = 1 - playerIndex;
  const correctAnswer = room.imageNames[opponentIndex];
  const playerOwnAnswer = room.imageNames[playerIndex];

  const guessedOwnImage = fuzzyMatchStrings(guess, playerOwnAnswer);
  if (guessedOwnImage && !fuzzyMatchStrings(guess, correctAnswer)) {
    return { ok: false, error: "You guessed your own image! Try guessing your opponent's image." };
  }

  const isCorrect = fuzzyMatchStrings(guess, correctAnswer);
  console.log(
    `🎯 Guess check: "${guess}" vs answer "${correctAnswer}" → ${isCorrect ? "CORRECT ✅" : "WRONG ❌"}`
  );

  if (isCorrect) {
    room.gameState = "finished";
    room.winner = playerIndex;
    await updateGameRoom(room);

    const winnerPlayer = room.players[playerIndex];
    const loserPlayer = room.players[opponentIndex];
    const { updateUserStats, getUserById } = await import("../lib/userService");

    if (!isSyntheticPlayer(room, playerIndex)) {
      const winnerUser = await getUserById(winnerPlayer.id);
      if (winnerUser) {
        await updateUserStats(winnerPlayer.id, {
          won: true,
          points: room.points[playerIndex],
          tilesRevealed: room.revealedTiles[playerIndex].length,
          guessedCorrectly: true,
        }).catch((error) => console.error("Error updating winner stats:", error));
      }
    }

    if (!isSyntheticPlayer(room, opponentIndex)) {
      const loserUser = await getUserById(loserPlayer.id);
      if (loserUser) {
        await updateUserStats(loserPlayer.id, {
          won: false,
          points: room.points[opponentIndex],
          tilesRevealed: room.revealedTiles[opponentIndex].length,
          guessedCorrectly: false,
        }).catch((error) => console.error("Error updating loser stats:", error));
      }
    }

    io.to(roomId).emit("guess-made", {
      playerIndex,
      playerName: room.players[playerIndex]?.name || `Player ${playerIndex + 1}`,
      guess,
      correct: true,
    });

    io.to(roomId).emit("game-end", {
      winner: playerIndex,
      winnerGuess: guess,
      correctAnswer,
      imageNames: room.imageNames,
    });

    return { ok: true, correct: true, room };
  }

  const usedNuke = room.nukeUsed && room.nukeUsed[playerIndex];
  if (!usedNuke) {
    room.points[playerIndex] += 1;
  }
  room.currentTurn = 1 - room.currentTurn;

  if (!room.guessLog) room.guessLog = [];
  room.guessLog.push({ playerIndex, text: guess.trim().slice(0, 120) });
  if (room.guessLog.length > 12) {
    room.guessLog = room.guessLog.slice(-12);
  }

  await updateGameRoom(room);

  io.to(roomId).emit("guess-made", {
    playerIndex,
    playerName: room.players[playerIndex]?.name || `Player ${playerIndex + 1}`,
    guess,
    correct: false,
  });

  io.to(roomId).emit("wrong-guess", {
    playerIndex,
    guess,
    currentTurn: room.currentTurn,
    points: room.points,
  });

  return { ok: true, correct: false, room };
}

const HINT_COST = 3;

export async function applyUseHintNormal(
  roomId: string,
  playerIndex: number,
  io: Server
): Promise<{ ok: true; room: GameRoom } | { ok: false; error: string }> {
  const room = await getGameRoom(roomId);
  if (!room) return { ok: false, error: "Room not found" };
  if (room.gameMode !== "normal") return { ok: false, error: "Invalid mode" };
  if (room.gameState !== "playing") return { ok: false, error: "Game not in progress" };
  if (room.points[playerIndex] < HINT_COST) {
    return { ok: false, error: "Not enough points (need 3)" };
  }

  const targetIdx = 1 - playerIndex;
  const answer = room.imageNames[targetIdx];
  if (!answer) return { ok: false, error: "No image to hint" };

  if (!room.revealedHints) room.revealedHints = Array.from({ length: room.maxPlayers }, () => []);

  const alreadyRevealed = new Set(room.revealedHints[playerIndex]);
  const revealable: number[] = [];
  for (let i = 0; i < answer.length; i++) {
    if (/[a-zA-Z0-9]/.test(answer[i]) && !alreadyRevealed.has(i)) {
      revealable.push(i);
    }
  }

  if (revealable.length === 0) {
    return { ok: false, error: "All letters already revealed for this image" };
  }

  const idx = revealable[Math.floor(Math.random() * revealable.length)];
  room.points[playerIndex] -= HINT_COST;
  room.revealedHints[playerIndex].push(idx);

  await updateGameRoom(room);

  io.to(roomId).emit("hint-revealed", {
    playerIndex,
    targetPlayerIndex: targetIdx,
    charIndex: idx,
    char: answer[idx],
    revealedHints: room.revealedHints,
    royaleLetterHints: room.royaleLetterHints,
    points: room.points,
  });

  console.log(
    `💡 Hint: Player ${playerIndex} revealed letter "${answer[idx]}" (index ${idx}) for target ${targetIdx} (${HINT_COST} pts)`
  );

  return { ok: true, room };
}

const powerUpCosts: Record<string, number> = {
  skip: 5,
  reveal2x2: 8,
  nuke: 30,
  fog: 8,
  revealLine: 6,
  freeze: 6,
  peek: 4,
};

export type NormalPowerUpPayload = {
  powerUpId: string;
  tileIndex?: number;
  lineType?: "row" | "col";
  lineIndex?: number;
};

export async function applyPowerUpNormal(
  roomId: string,
  playerIndex: number,
  data: NormalPowerUpPayload,
  io: Server
): Promise<{ ok: true; room: GameRoom } | { ok: false; error: string }> {
  const { powerUpId, tileIndex, lineType, lineIndex } = data;
  const room = await getGameRoom(roomId);
  if (!room) return { ok: false, error: "Room not found" };
  if (room.gameMode !== "normal") return { ok: false, error: "Invalid mode" };
  if (room.gameState !== "playing") return { ok: false, error: "Game not in progress" };

  const opponentIndex = 1 - playerIndex;

  if (room.freezeActive && room.freezeActive[playerIndex]) {
    return { ok: false, error: "You're frozen! Can't use power-ups this turn." };
  }

  const cost = powerUpCosts[powerUpId];
  if (!cost) return { ok: false, error: "Invalid power-up" };
  if (room.points[playerIndex] < cost) return { ok: false, error: "Not enough points" };

  room.points[playerIndex] -= cost;

  switch (powerUpId) {
    case "skip": {
      room.skipTurnActive = true;
      io.to(roomId).emit("power-up-used", {
        powerUpId,
        usedBy: playerIndex,
        targetPlayer: opponentIndex,
        points: room.points,
        message: `${room.players[playerIndex].name} used Skip Turn on ${room.players[opponentIndex]?.name}!`,
      });
      break;
    }

    case "reveal2x2": {
      if (tileIndex === undefined) {
        room.points[playerIndex] += cost;
        return { ok: false, error: "Tile index required for reveal2x2" };
      }
      const row = Math.floor(tileIndex / 10);
      const col = tileIndex % 10;
      const tilesToReveal: number[] = [];
      for (let r = row; r < Math.min(row + 2, 10); r++) {
        for (let c = col; c < Math.min(col + 2, 10); c++) {
          const tile = r * 10 + c;
          if (!room.revealedTiles[opponentIndex].includes(tile)) {
            room.revealedTiles[opponentIndex].push(tile);
            tilesToReveal.push(tile);
          }
        }
      }
      room.currentTurn = 1 - room.currentTurn;
      io.to(roomId).emit("power-up-used", {
        powerUpId,
        usedBy: playerIndex,
        targetPlayer: opponentIndex,
        revealedTiles: tilesToReveal,
        allRevealedTiles: room.revealedTiles,
        points: room.points,
        currentTurn: room.currentTurn,
        message: `${room.players[playerIndex].name} used Reveal 2x2!`,
      });
      break;
    }

    case "nuke": {
      const allTiles = Array.from({ length: 100 }, (_, i) => i);
      room.revealedTiles[opponentIndex] = allTiles;
      if (!room.nukeUsed) room.nukeUsed = [false, false];
      room.nukeUsed[playerIndex] = true;
      room.currentTurn = 1 - room.currentTurn;
      io.to(roomId).emit("power-up-used", {
        powerUpId,
        usedBy: playerIndex,
        targetPlayer: opponentIndex,
        revealedTiles: allTiles,
        allRevealedTiles: room.revealedTiles,
        points: room.points,
        currentTurn: room.currentTurn,
        message: `${room.players[playerIndex].name} used Nuke!`,
      });
      break;
    }

    case "fog": {
      const opponentRevealed = room.revealedTiles[playerIndex];
      if (opponentRevealed.length === 0) {
        room.points[playerIndex] += cost;
        return { ok: false, error: "No revealed tiles to hide" };
      }
      const shuffled = [...opponentRevealed].sort(() => Math.random() - 0.5);
      const numToHide = Math.min(4, shuffled.length);
      const hiddenTiles = shuffled.slice(0, numToHide);
      room.revealedTiles[playerIndex] = opponentRevealed.filter((t) => !hiddenTiles.includes(t));
      io.to(roomId).emit("power-up-used", {
        powerUpId,
        usedBy: playerIndex,
        targetPlayer: playerIndex,
        foggedTiles: hiddenTiles,
        allRevealedTiles: room.revealedTiles,
        points: room.points,
        message: `${room.players[playerIndex].name} used Fog of War! ${numToHide} tiles hidden!`,
      });
      break;
    }

    case "revealLine": {
      if (lineType === undefined || lineIndex === undefined || lineIndex < 0 || lineIndex > 9) {
        room.points[playerIndex] += cost;
        return { ok: false, error: "Row/column selection required" };
      }
      const lineTiles: number[] = [];
      for (let i = 0; i < 10; i++) {
        const tile = lineType === "row" ? lineIndex * 10 + i : i * 10 + lineIndex;
        if (!room.revealedTiles[opponentIndex].includes(tile)) {
          room.revealedTiles[opponentIndex].push(tile);
          lineTiles.push(tile);
        }
      }
      room.currentTurn = 1 - room.currentTurn;
      io.to(roomId).emit("power-up-used", {
        powerUpId,
        usedBy: playerIndex,
        targetPlayer: opponentIndex,
        revealedTiles: lineTiles,
        allRevealedTiles: room.revealedTiles,
        points: room.points,
        currentTurn: room.currentTurn,
        lineType,
        lineIndex,
        message: `${room.players[playerIndex].name} revealed ${lineType} ${lineIndex + 1}!`,
      });
      break;
    }

    case "freeze": {
      if (!room.freezeActive) room.freezeActive = [false, false];
      room.freezeActive[opponentIndex] = true;
      io.to(roomId).emit("power-up-used", {
        powerUpId,
        usedBy: playerIndex,
        targetPlayer: opponentIndex,
        points: room.points,
        freezeActive: room.freezeActive,
        message: `${room.players[playerIndex].name} used Freeze!`,
      });
      break;
    }

    case "peek": {
      if (tileIndex === undefined) {
        room.points[playerIndex] += cost;
        return { ok: false, error: "Tile position required for peek" };
      }
      const peekRow = Math.floor(tileIndex / 10);
      const peekCol = tileIndex % 10;
      const peekTiles: number[] = [];
      for (let r = peekRow - 1; r <= peekRow + 1; r++) {
        for (let c = peekCol - 1; c <= peekCol + 1; c++) {
          if (r >= 0 && r < 10 && c >= 0 && c < 10) {
            peekTiles.push(r * 10 + c);
          }
        }
      }
      room.currentTurn = 1 - room.currentTurn;
      io.to(roomId).emit("power-up-used", {
        powerUpId,
        usedBy: playerIndex,
        targetPlayer: opponentIndex,
        peekTiles,
        peekPlayerIndex: playerIndex,
        points: room.points,
        currentTurn: room.currentTurn,
        message: `${room.players[playerIndex].name} used Peek!`,
      });
      break;
    }

    default:
      room.points[playerIndex] += cost;
      return { ok: false, error: "Invalid power-up" };
  }

  await updateGameRoom(room);
  return { ok: true, room };
}
