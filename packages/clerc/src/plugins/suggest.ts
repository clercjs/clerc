/**
 * Lightweight 1-row Wagner-Fischer Levenshtein distance with early threshold
 * exit. Zero startup allocations (no global 256 KB typed arrays) and pure ESM.
 */
function levenshtein(a: string, b: string, maxDistance: number): number {
  if (a === b) {
    return 0;
  }
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > maxDistance) {
    return maxDistance + 1;
  }
  if (m === 0) {
    return n;
  }
  if (n === 0) {
    return m;
  }

  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    let rowMin = i;
    const ca = a.charCodeAt(i - 1);

    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(temp + 1, row[j - 1] + 1, prev + cost);
      row[j] = val;
      prev = temp;
      if (val < rowMin) {
        rowMin = val;
      }
    }

    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }
  }

  return row[n];
}

export function findClosest(
  target: string,
  candidates: readonly string[],
  maxDistance: number,
): string | undefined {
  let best: string | undefined;
  let bestDist = maxDistance + 1;

  for (const candidate of candidates) {
    const dist = levenshtein(target, candidate, bestDist - 1);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  return best;
}
