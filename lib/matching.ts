// Shared heuristic matching logic — identical rules to the prototype, but run
// server-side so it scales past a few hundred clauses without freezing the tab.

export const STOPWORDS = new Set([
  "the","a","an","of","to","and","or","in","on","for","shall","must","with","be",
  "is","are","this","that","as","by","at","from","will","all","any","it","its",
  "which","into","not",
]);

export function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w) && w.length > 2);
}

export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  sa.forEach((x) => {
    if (sb.has(x)) inter++;
  });
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

// Rule-based heuristic (not AI-based) for spotting clauses that likely impose no
// testable requirement — background/context text rather than something to map.
export const INFORMATIONAL_PHRASES = [
  "for reference only","for information only","for informational purposes",
  "background context","provides background","does not impose",
  "no specific technical requirement","no requirement is imposed","for context",
  "general information","for clarity only","this section describes",
  "this section provides","introductory","table of contents","glossary of terms",
  "definitions used in this document","purpose of this document",
  "document control","revision history","not a requirement",
];

export const NORMATIVE_KEYWORDS = [
  "shall","must","will provide","required","requires","verify","ensure","provide",
  "support","supports","comply","compliant","able to","capable of","perform",
  "maintain","implement","deliver","submit","demonstrate","integrate",
  "authenticate","encrypt","log ","notify","escalate","retain","shall not",
];

export function looksInformational(desc: string): boolean {
  const t = (desc || "").toLowerCase();
  if (!t.trim()) return false;
  if (INFORMATIONAL_PHRASES.some((p) => t.includes(p))) return true;
  const hasNormative = NORMATIVE_KEYWORDS.some((k) => t.includes(k));
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  return !hasNormative && wordCount > 0 && wordCount <= 25;
}

export const PAIR_THRESHOLD = 0.28;

export interface Candidate {
  key: string; // docId::clauseId
  docType: string;
  no: string;
  desc: string;
}

export interface SuggestCluster {
  keys: string[];
  score: number;
}

export interface SuggestResult {
  informationalKeys: string[];
  clusters: SuggestCluster[];
  compared: number;
}

/**
 * Two-stage: tag likely-informational clauses, then cluster the remainder by
 * token overlap across document types (union-find on pairs above threshold).
 */
export function runSuggest(candidates: Candidate[]): SuggestResult {
  const informationalKeys: string[] = [];
  const pool: (Candidate & { tokens: string[] })[] = [];

  candidates.forEach((c) => {
    if (looksInformational(c.desc)) {
      informationalKeys.push(c.key);
    } else {
      pool.push({ ...c, tokens: tokenize(c.desc + " " + c.no) });
    }
  });

  if (pool.length < 2) {
    return { informationalKeys, clusters: [], compared: 0 };
  }

  const pairs: { a: string; b: string; score: number }[] = [];
  const n = pool.length;
  for (let i = 0; i < n; i++) {
    const a = pool[i];
    for (let j = i + 1; j < n; j++) {
      const b = pool[j];
      if (a.docType === b.docType) continue;
      let score = jaccard(a.tokens, b.tokens);
      if (a.no && b.no && a.no.toLowerCase() === b.no.toLowerCase()) score += 0.3;
      if (score >= PAIR_THRESHOLD) pairs.push({ a: a.key, b: b.key, score });
    }
  }

  pairs.sort((x, y) => y.score - x.score);

  const parent: Record<string, string> = {};
  function find(x: string): string {
    if (parent[x] === undefined) parent[x] = x;
    if (parent[x] === x) return x;
    return (parent[x] = find(parent[x]));
  }
  function union(x: string, y: string) {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent[rx] = ry;
  }
  pool.forEach((c) => find(c.key));
  pairs.forEach((p) => union(p.a, p.b));

  const typeByKey = new Map(pool.map((c) => [c.key, c.docType]));
  const clusterMap: Record<string, string[]> = {};
  pool.forEach((c) => {
    const root = find(c.key);
    (clusterMap[root] ||= []).push(c.key);
  });

  const clusters: SuggestCluster[] = [];
  Object.values(clusterMap).forEach((keys) => {
    if (keys.length < 2) return;
    const types = new Set(keys.map((k) => typeByKey.get(k)));
    if (types.size < 2) return;
    const keySet = new Set(keys);
    const inCluster = pairs.filter((p) => keySet.has(p.a) && keySet.has(p.b));
    const bestScore = inCluster.length
      ? Math.max(...inCluster.map((p) => p.score))
      : 0;
    clusters.push({ keys, score: Math.min(bestScore, 1) });
  });

  return {
    informationalKeys,
    clusters,
    compared: (n * (n - 1)) / 2,
  };
}
