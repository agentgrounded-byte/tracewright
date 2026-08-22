import { tokenize } from "./matching";
import {
  Clause,
  clauseKey,
  DOC_TYPE_LABEL,
  DocType,
  FlatClause,
  GapItem,
  GapMeta,
  Link,
  ProjectData,
  TWDocument,
} from "./types";

export function docTypesPresent(data: ProjectData): DocType[] {
  return Array.from(new Set(data.documents.map((d) => d.type)));
}

export function allClausesFlat(data: ProjectData): FlatClause[] {
  const out: FlatClause[] = [];
  data.documents.forEach((doc) => {
    doc.clauses
      .filter((c) => !c.archived && c.tag !== "informational")
      .forEach((c) =>
        out.push({
          docId: doc.id,
          docType: doc.type,
          docName: doc.name,
          clauseId: c.id,
          no: c.no,
          desc: c.desc,
        })
      );
  });
  return out;
}

export function confirmedLinksCoveringKey(data: ProjectData, key: string) {
  return data.links.filter(
    (l) => l.status === "confirmed" && l.clauseKeys.includes(key)
  );
}

export function linkCoverageTypes(data: ProjectData, link: Link): Set<DocType> {
  const types = new Set<DocType>();
  link.clauseKeys.forEach((k) => {
    const docId = k.split("::")[0];
    const doc = data.documents.find((d) => d.id === docId);
    if (doc) types.add(doc.type);
  });
  return types;
}

export function linkStatus(data: ProjectData, link: Link) {
  if (link.status === "suggested") return "suggested";
  const present = docTypesPresent(data);
  const covered = linkCoverageTypes(data, link);
  if (present.length > 1 && covered.size >= present.length) return "mapped";
  if (covered.size >= 1 && present.length > 1) return "partial";
  return present.length <= 1 ? "mapped" : "partial";
}

export function clauseStatus(data: ProjectData, docId: string, clauseId: string) {
  const key = clauseKey(docId, clauseId);
  const links = confirmedLinksCoveringKey(data, key);
  if (links.length) {
    const anyMapped = links.some((l) => linkStatus(data, l) === "mapped");
    return anyMapped ? "mapped" : "partial";
  }
  const suggested = data.links.filter(
    (l) => l.status === "suggested" && l.clauseKeys.includes(key)
  );
  if (suggested.length) return "suggested";
  return "unmapped";
}

export function gapItems(data: ProjectData): GapItem[] {
  const items: GapItem[] = [];
  allClausesFlat(data).forEach((c) => {
    const key = clauseKey(c.docId, c.clauseId);
    if (confirmedLinksCoveringKey(data, key).length === 0) {
      items.push({
        key,
        type: "clause",
        refs: [
          { docType: c.docType, docName: c.docName, no: c.no, desc: c.desc },
        ],
      });
    }
  });
  data.links
    .filter((l) => l.status === "confirmed")
    .forEach((l) => {
      if (linkStatus(data, l) === "partial") {
        const refs = l.clauseKeys
          .map((k) => {
            const [docId, clauseId] = k.split("::");
            const doc = data.documents.find((d) => d.id === docId);
            const cl = doc && doc.clauses.find((c) => c.id === clauseId);
            return doc && cl
              ? {
                  docType: doc.type,
                  docName: doc.name,
                  no: cl.no,
                  desc: cl.desc,
                }
              : null;
          })
          .filter(Boolean) as GapItem["refs"];
        items.push({ key: l.id, type: "link", refs, link: l });
      }
    });
  return items;
}

export const DEFAULT_GAP_META: GapMeta = {
  owner: "",
  targetDate: "",
  notes: "",
  resolved: false,
  disposition: "",
};

export function gapMetaFor(data: ProjectData, key: string): GapMeta {
  return data.gapMeta[key] ?? { ...DEFAULT_GAP_META };
}

export function gapIsOpen(meta: GapMeta) {
  return !meta.resolved && !meta.disposition;
}

export function clauseLabel(data: ProjectData, k: string) {
  const [docId, clauseId] = k.split("::");
  const doc = data.documents.find((d) => d.id === docId);
  const c = doc && doc.clauses.find((x) => x.id === clauseId);
  if (!doc || !c) return null;
  return {
    type: doc.type,
    docName: doc.name,
    no: c.no,
    desc: c.desc,
    archived: !!c.archived,
    tag: c.tag,
  };
}

export function linkSource(link: Link) {
  const createdByAuto = (link.createdBy || "").startsWith("Auto-suggest");
  if (createdByAuto) {
    if ((link.createdBy || "").includes("auto-confirmed")) {
      return {
        kind: "auto" as const,
        label: "Auto — threshold",
        title:
          "Auto-confirmed by auto-suggest (score ≥ threshold, no manual review needed)",
      };
    }
    const reviewer =
      link.confirmedBy && link.confirmedBy !== "Auto-suggest"
        ? link.confirmedBy
        : null;
    return {
      kind: "auto" as const,
      label: "Auto — reviewed",
      title: reviewer
        ? `Suggested by auto-suggest, accepted by ${reviewer}`
        : "Suggested by auto-suggest, accepted on review",
    };
  }
  return {
    kind: "manual" as const,
    label: "Manual",
    title: `Linked manually by ${link.createdBy || "unknown"}`,
  };
}

export const RAIL_PAGE_SIZE = 40;
export const SUGGEST_PAGE_SIZE = 20;
export const GENERIC_PAGE_SIZE = 20;
export const SEARCH_DROPDOWN_CAP = 6;

/* ============================= SEARCH ============================= */

export type SearchStatus =
  | "mapped"
  | "partial"
  | "suggested"
  | "unmapped"
  | "informational"
  | "retired";

export interface SearchResult {
  doc: TWDocument;
  clause: Clause;
  status: SearchStatus;
}

export const SEARCH_STATUS_BADGE_CLASS: Record<SearchStatus, string> = {
  mapped: "mapped",
  partial: "partial",
  suggested: "suggested",
  unmapped: "unmapped",
  informational: "info",
  retired: "unmapped",
};

export const SEARCH_STATUS_LABEL: Record<SearchStatus, string> = {
  mapped: "mapped",
  partial: "partial",
  suggested: "suggested (pending)",
  unmapped: "unmapped",
  informational: "informational",
  retired: "retired",
};

export function searchStatusFor(
  data: ProjectData,
  doc: TWDocument,
  clause: Clause
): SearchStatus {
  const key = clauseKey(doc.id, clause.id);
  const inAnyLink = data.links.some((l) => l.clauseKeys.includes(key));
  if (clause.tag === "informational" && !inAnyLink) return "informational";
  if (clause.archived && !inAnyLink) return "retired";
  return clauseStatus(data, doc.id, clause.id) as SearchStatus;
}

export function runSearch(data: ProjectData, query: string): SearchResult[] {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];
  data.documents.forEach((doc) => {
    doc.clauses.forEach((clause) => {
      const hay = [clause.no, clause.desc, doc.name, DOC_TYPE_LABEL[doc.type]]
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) {
        results.push({ doc, clause, status: searchStatusFor(data, doc, clause) });
      }
    });
  });
  return results;
}

/* ============================= CATEGORY BREAKDOWN (Dashboard) ============================= */
// Heuristic, not AI: groups clauses by the first integer run in their own clause
// number ("major section") across all document types, ranks the 9 largest
// sections, buckets everything else under "Others", and picks 1-2 descriptive
// keywords per section via a simple TF-style score (in-section frequency over
// project-wide document frequency) to label it.

export function extractMajorSection(no: string): string | null {
  const m = String(no || "").match(/(\d+)/); // first integer run, e.g. "1" from "TS-1.2"
  return m ? String(parseInt(m[1], 10)) : null;
}

export interface CategoryCounts {
  mapped: number;
  partial: number;
  suggested: number;
  unmapped: number;
}

export interface CategoryRow {
  label: string;
  description: string;
  total: number;
  counts: CategoryCounts;
}

export interface CategoryBreakdown {
  categories: CategoryRow[];
  detectedCount: number;
  total: number;
}

function categoryCountsFor(data: ProjectData, clauses: FlatClause[]): CategoryCounts {
  const counts: CategoryCounts = { mapped: 0, partial: 0, suggested: 0, unmapped: 0 };
  clauses.forEach((c) => {
    const st = clauseStatus(data, c.docId, c.clauseId) as keyof CategoryCounts;
    counts[st] = (counts[st] || 0) + 1;
  });
  return counts;
}

export function clausesByCategory(data: ProjectData): CategoryBreakdown {
  const clauses = allClausesFlat(data);

  // Group by the clause's own major section number, across all document types —
  // e.g. "TS-1.2", "REQ-1.4", and "UAT-1.1" all belong to section "1". This
  // mirrors how the source documents are actually structured, rather than
  // guessing a theme from wording.
  const bySection = new Map<string, FlatClause[]>();
  const noSection: FlatClause[] = [];
  clauses.forEach((c) => {
    const sec = extractMajorSection(c.no);
    if (sec === null) {
      noSection.push(c);
      return;
    }
    if (!bySection.has(sec)) bySection.set(sec, []);
    bySection.get(sec)!.push(c);
  });

  const sectionsRanked = Array.from(bySection.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );
  const top = sectionsRanked.slice(0, 9);
  const overflowClauses = sectionsRanked.slice(9).flatMap(([, arr]) => arr);

  // Project-wide word frequency, used only to pick a descriptive keyword or two
  // per section for the label/description — the grouping itself is purely by
  // section number.
  const docFreq = new Map<string, Set<string>>();
  clauses.forEach((c) => {
    new Set(tokenize(c.desc)).forEach((t) => {
      if (!docFreq.has(t)) docFreq.set(t, new Set());
      docFreq.get(t)!.add(clauseKey(c.docId, c.clauseId));
    });
  });
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

  const categories: CategoryRow[] = top.map(([sectionNum, secClauses]) => {
    const withinCount = new Map<string, number>();
    secClauses.forEach((c) =>
      new Set(tokenize(c.desc)).forEach((t) => {
        withinCount.set(t, (withinCount.get(t) || 0) + 1);
      })
    );
    const scored = Array.from(withinCount.entries())
      .filter(([, n]) => n >= 2)
      .map(([t, n]): [string, number] => [t, n / (docFreq.get(t)?.size || 1)])
      .sort((a, b) => b[1] - a[1]);
    const topWords = scored.slice(0, 2).map(([t]) => cap(t));
    const label = topWords.length
      ? `Section ${sectionNum} — ${topWords.join(" ")}`
      : `Section ${sectionNum}`;

    const docCounts: Record<DocType, number> = { tender: 0, requirement: 0, uat: 0 };
    secClauses.forEach((c) => {
      docCounts[c.docType] = (docCounts[c.docType] || 0) + 1;
    });
    const countsPhrase = [
      docCounts.tender ? `${docCounts.tender} tender` : null,
      docCounts.requirement ? `${docCounts.requirement} requirement` : null,
      docCounts.uat ? `${docCounts.uat} UAT` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const extra = scored.slice(2, 4).map(([t]) => t);

    let description: string;
    if (topWords.length && extra.length) {
      description = `Groups every clause numbered under section ${sectionNum}, largely about ${topWords
        .join(" and ")
        .toLowerCase()} and ${extra.join(
        " and "
      )}, across ${countsPhrase} clause(s) in this project.`;
    } else if (topWords.length) {
      description = `Groups every clause numbered under section ${sectionNum}, largely about ${topWords
        .join(" and ")
        .toLowerCase()}, across ${countsPhrase} clause(s) in this project.`;
    } else {
      description = `Groups every clause numbered under section ${sectionNum} of this project's documents, across ${countsPhrase} clause(s), with no single dominant keyword.`;
    }

    return {
      label,
      description,
      total: secClauses.length,
      counts: categoryCountsFor(data, secClauses),
    };
  });

  const othersClauses = [...overflowClauses, ...noSection];
  categories.push({
    label: "Others",
    description:
      "Clauses with no parseable section number, or belonging to a section outside the 9 largest in this project — worth a manual look to confirm grouping.",
    total: othersClauses.length,
    counts: categoryCountsFor(data, othersClauses),
  });

  return { categories, detectedCount: top.length, total: clauses.length };
}
