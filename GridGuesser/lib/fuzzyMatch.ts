/** Shared fuzzy string match for guesses (server + tests). */

export function normStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function levenshteinDist(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function fuzzyMatchStrings(guess: string, answer: string): boolean {
  const g = normStr(guess);
  const a = normStr(answer);
  if (g === a) return true;
  if (a.includes(g) || g.includes(a)) return true;
  const maxDist = Math.max(2, Math.floor(a.length * 0.3));
  if (levenshteinDist(g, a) <= maxDist) return true;
  const gWords = g.split(" ").filter((w) => w.length > 1);
  const aWords = a.split(" ").filter((w) => w.length > 1);
  let matched = 0;
  for (const aw of aWords) {
    for (const gw of gWords) {
      if (aw === gw || aw.includes(gw) || gw.includes(aw) || levenshteinDist(gw, aw) <= 1) {
        matched++;
        break;
      }
    }
  }
  if (aWords.length <= 2 && matched >= 1) return true;
  if (aWords.length > 2 && matched >= Math.ceil(aWords.length * 0.5)) return true;
  return false;
}
