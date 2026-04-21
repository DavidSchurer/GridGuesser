/**
 * Gemini-based guess suggestions for the AI opponent (multimodal when possible).
 * Set GEMINI_API_KEY or GOOGLE_API_KEY (free tier: https://aistudio.google.com/apikey).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiDifficulty } from "./types";
import { CATEGORIES } from "./googleImagesApi";

const MODEL = "gemini-2.5-flash";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

export type SuggestGuessInput = {
  difficulty: AiDifficulty;
  /** Raw category key, e.g. landmarks */
  category: string;
  /** Human-readable theme for prompts */
  displayCategory: string;
  customQuery?: string;
  /** Masked opponent title; never pass the full answer */
  maskedTitle: string;
  /** Tiles revealed on the image being guessed (target grid) */
  revealedTileCount: number;
  /** Tiles revealed on that same target image (same as count for normal 1v1) */
  humanTilesRevealedOnTarget: number;
  /** Tiles revealed on AI's own image (human's exploration of opponent grid) */
  aiTilesRevealedOnOwnImage: number;
  /** Human wrong guesses only; pre-formatted or empty */
  guessLogSummary: string;
  /** Opponent image URL for vision (human's image when AI guesses) */
  opponentImageUrl?: string;
};

function getApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

/** Whether Gemini is configured (for tuning AI turn bias). */
export function hasGeminiApiKey(): boolean {
  return !!getApiKey();
}

export function getCategoryDisplayName(categoryKey: string, customQuery?: string): string {
  if (categoryKey === "custom" && customQuery?.trim()) {
    return `Custom topic: ${customQuery.trim()}`;
  }
  const c = CATEGORIES[categoryKey as keyof typeof CATEGORIES];
  return c?.name || categoryKey;
}

export async function fetchImageAsBase64(
  url: string
): Promise<{ mimeType: string; data: string } | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;
    const ct = res.headers.get("content-type") || "";
    let mime = "image/jpeg";
    if (ct.includes("png")) mime = "image/png";
    else if (ct.includes("webp")) mime = "image/webp";
    else if (ct.includes("gif")) mime = "image/gif";
    return { mimeType: mime, data: buf.toString("base64") };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function shouldAttachVision(
  difficulty: AiDifficulty,
  revealedTileCount: number,
  imageAvailable: boolean
): boolean {
  if (!imageAvailable) return false;
  if (difficulty === "hard") return true;
  if (difficulty === "medium") return revealedTileCount >= 6;
  return revealedTileCount >= 12;
}

function temperatureForDifficulty(d: AiDifficulty): number {
  if (d === "easy") return 0.85;
  if (d === "medium") return 0.55;
  return 0.25;
}

function buildPrompt(input: SuggestGuessInput, hasImage: boolean): string {
  const dq = input.customQuery?.trim()
    ? `\nCustom search / user topic (if applicable): ${input.customQuery.trim()}`
    : "";
  const behavior = input.guessLogSummary.trim()
    ? `\nThe human opponent's recent wrong guesses (do not repeat the same dead ends; infer what they might be aiming at): ${input.guessLogSummary}`
    : "\nNo prior wrong guesses from the opponent recorded yet.";

  const strat =
    input.difficulty === "easy"
      ? "Make a reasonable guess even if uncertain; stay within the theme."
      : input.difficulty === "medium"
        ? "Balance literal reading of revealed letters with the theme and image clues."
        : "Be precise: prefer specific well-known titles that match the theme and visible subject matter.";

  return `You are playing GridGuesser against a human. You must guess the SHORT TITLE of their hidden image (what the game calls the answer).

Theme / category: ${input.displayCategory}${dq}
Letters revealed so far in the title (underscores are still hidden): ${input.maskedTitle}
Tiles uncovered on this image grid (out of 100): ${input.revealedTileCount}
Tiles revealed on the picture you are guessing: ${input.humanTilesRevealedOnTarget}.
The human has revealed this many tiles on YOUR image (how much they have seen of your grid): ${input.aiTilesRevealedOnOwnImage}.
${behavior}

${hasImage ? "A reference image of the same subject is attached (same image source as the game grid). Use it together with the revealed letters and theme to infer a concrete title." : "No reference image could be loaded; rely on the theme and revealed letters."}

${strat}

Reply with exactly ONE JSON object and nothing else: {"guess":"your guess here"}
Rules for the guess string:
- English, 1–8 words, a plausible real-world title or name for something in this category.
- Do not output underscores as the answer; fill in a concrete guess.
- Do not copy only punctuation from the masked string; propose an actual title.
- If the opponent guessed something close but wrong, try a variant or more specific name.`;
}

function parseGuessJson(text: string): string | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const raw = jsonMatch ? jsonMatch[0] : text;
  try {
    const parsed = JSON.parse(raw) as { guess?: string };
    const g = (parsed.guess || "").trim();
    return g.length > 0 && g.length <= 200 ? g : null;
  } catch {
    const g = text.replace(/^["']|["']$/g, "").replace(/^```\w*\s*/i, "").replace(/```\s*$/g, "").trim();
    return g.length > 0 && g.length <= 200 ? g.slice(0, 200) : null;
  }
}

/** Heuristic guess when API is unavailable or fails */
export function heuristicGuessFromMasked(
  category: string,
  maskedTitle: string,
  difficulty: AiDifficulty
): string {
  const cat = CATEGORIES[category as keyof typeof CATEGORIES];
  if (cat?.searchTerms?.length) {
    const term = cat.searchTerms[Math.floor(Math.random() * cat.searchTerms.length)];
    const words = term.split(/\s+/).filter((w) => w.length > 1).slice(0, 3);
    if (words.length > 0 && (difficulty === "easy" || Math.random() < 0.7)) {
      return words.join(" ");
    }
  }

  const visible = maskedTitle
    .replace(/_/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9']/g, ""))
    .filter((w) => w.length > 1);
  if (visible.length > 0 && Math.random() < 0.75) {
    return visible.join(" ");
  }

  const words = category.split(/[\s,_-]+/).filter((w) => w.length > 2);
  const pick = () => words[Math.floor(Math.random() * Math.max(1, words.length))] || "landmark";
  return pick();
}

export async function suggestGuessWithGemini(input: SuggestGuessInput): Promise<string | null> {
  const key = getApiKey();
  if (!key) return null;

  let inline: { mimeType: string; data: string } | null = null;
  if (input.opponentImageUrl) {
    const wantVision = shouldAttachVision(
      input.difficulty,
      input.revealedTileCount,
      true
    );
    if (wantVision) {
      inline = await fetchImageAsBase64(input.opponentImageUrl);
    }
  }

  const prompt = buildPrompt(input, !!inline);

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        temperature: temperatureForDifficulty(input.difficulty),
        maxOutputTokens: 256,
      },
    });

    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
      { text: prompt },
    ];
    if (inline) {
      parts.push({ inlineData: { mimeType: inline.mimeType, data: inline.data } });
    }

    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const text = result.response.text().trim();
    return parseGuessJson(text);
  } catch (e) {
    console.warn("Gemini suggestGuess failed:", e);
    return null;
  }
}
