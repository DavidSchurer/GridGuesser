/**
 * Content Filter for Custom Categories — SERVER-ONLY
 *
 * Two-layer NSFW filter for user-supplied custom category strings:
 *   1. keywordCheck: a fast, deterministic blocklist of regexes loaded at
 *      runtime from CONTENT_FILTER_BLOCKLIST_B64. Catches obvious explicit/
 *      violent/slur terms after normalization (lowercase, strip diacritics,
 *      l33t-speak swaps, strip punctuation).
 *   2. llmSafetyCheck: a Google Gemini classification call that catches
 *      obfuscated or nuanced attempts.
 *
 * The blocklist patterns live in .env.local (gitignored) so they never appear
 * in the public repo. This module must NEVER be imported from client code —
 * the Node-only Buffer API plus reading process.env directly would either
 * break the bundle or leak the patterns into client JS. Use the
 * `validate-category` socket event from the client instead.
 *
 * validateCategory runs the keyword check first, then (unless skipLlm is set)
 * the LLM check. Results are cached in-memory by normalized query.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface FilterResult {
  allowed: boolean;
  reason?: string;
}

const GENERIC_REASON =
  "That category isn't allowed. Please pick something age-appropriate.";

// ─── Normalization ──────────────────────────────────────────────────────

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
  "|": "i",
};

/**
 * Normalize a query for keyword matching:
 *   - lowercase
 *   - NFKD strip diacritics
 *   - apply l33t substitutions
 *   - strip punctuation (keep letters, digits, spaces)
 *   - collapse whitespace
 */
export function normalizeQuery(q: string): string {
  let s = q.toLowerCase();
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/./g, (ch) => LEET_MAP[ch] ?? ch);
  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// ─── Blocklist (loaded from env at module init) ─────────────────────────
// Format: CONTENT_FILTER_BLOCKLIST_B64 is base64-encoded JSON of an array of
// regex source strings. Patterns run against the normalized string, so most
// use \b boundaries and lowercase character classes.

function loadBlockedPatterns(): RegExp[] {
  const encoded = process.env.CONTENT_FILTER_BLOCKLIST_B64;
  if (!encoded) {
    console.warn(
      "[contentFilter] CONTENT_FILTER_BLOCKLIST_B64 is not set; keyword filter disabled. " +
        "The LLM safety check is the only line of defense."
    );
    return [];
  }

  try {
    const json = Buffer.from(encoded, "base64").toString("utf-8");
    const sources = JSON.parse(json);
    if (!Array.isArray(sources)) {
      throw new Error("Decoded blocklist is not a JSON array");
    }
    const patterns: RegExp[] = [];
    for (const src of sources) {
      if (typeof src !== "string") continue;
      try {
        patterns.push(new RegExp(src));
      } catch (err) {
        console.warn(
          `[contentFilter] Skipping invalid regex in blocklist: ${src}`
        );
      }
    }
    console.log(
      `[contentFilter] Loaded ${patterns.length} keyword pattern(s) from env`
    );
    return patterns;
  } catch (error: any) {
    console.error(
      "[contentFilter] Failed to decode CONTENT_FILTER_BLOCKLIST_B64:",
      error?.message || error
    );
    return [];
  }
}

const BLOCKED_PATTERNS: RegExp[] = loadBlockedPatterns();

// ─── Keyword check ──────────────────────────────────────────────────────

export function keywordCheck(query: string): FilterResult {
  const normalized = normalizeQuery(query);
  if (!normalized) return { allowed: true };

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return { allowed: false, reason: GENERIC_REASON };
    }
  }

  return { allowed: true };
}

// ─── LLM safety check ───────────────────────────────────────────────────

function getGeminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

const SAFETY_PROMPT =
  "You moderate custom topics for a kid-friendly image-guessing game. " +
  "A topic is UNSAFE if it relates to: explicit sexual content, nudity, " +
  "graphic violence, gore, real-world death/torture imagery, hate speech " +
  "or slurs, sexual content involving minors, illegal drug instructions, " +
  "or weapon-making instructions. " +
  "A topic is SAFE if it could plausibly produce age-appropriate Google Image " +
  "results for kids 8 and up (animals, places, food, sports, art, vehicles, " +
  "fictional characters, science, nature, etc.). " +
  "Reply with EXACTLY one word: SAFE or UNSAFE. No punctuation, no explanation.";

export async function llmSafetyCheck(query: string): Promise<FilterResult> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    console.warn(
      "[contentFilter] No Gemini API key; skipping LLM safety check"
    );
    return { allowed: true };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(
      `${SAFETY_PROMPT}\n\nTopic: "${query}"`
    );
    const verdict = result.response.text().trim().toUpperCase();

    console.log(
      `[contentFilter] Gemini safety verdict for "${query}": ${verdict}`
    );

    if (verdict.startsWith("UNSAFE")) {
      return { allowed: false, reason: GENERIC_REASON };
    }
    return { allowed: true };
  } catch (error: any) {
    console.warn(
      `[contentFilter] Gemini safety call failed for "${query}":`,
      error?.message || error
    );
    return { allowed: true };
  }
}

// ─── Combined check with caching ────────────────────────────────────────

const resultCache = new Map<string, FilterResult>();

export interface ValidateOptions {
  skipLlm?: boolean;
}

export async function validateCategory(
  query: string,
  options: ValidateOptions = {}
): Promise<FilterResult> {
  const normalized = normalizeQuery(query);
  if (!normalized) return { allowed: true };

  const cacheKey = `${options.skipLlm ? "kw" : "full"}:${normalized}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return cached;

  const kw = keywordCheck(query);
  if (!kw.allowed) {
    resultCache.set(cacheKey, kw);
    return kw;
  }

  if (options.skipLlm) {
    resultCache.set(cacheKey, kw);
    return kw;
  }

  const llm = await llmSafetyCheck(query);
  resultCache.set(cacheKey, llm);
  return llm;
}
