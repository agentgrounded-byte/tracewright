import {
  clauseKey,
  DocType,
  FlatClause,
  GapItem,
  GapMeta,
  Link,
  ProjectData,
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
