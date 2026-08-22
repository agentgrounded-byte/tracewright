export type DocType = "tender" | "requirement" | "uat";

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  tender: "Tender Spec",
  requirement: "Requirement Spec",
  uat: "UAT Checksheet",
};

export const DOC_TYPE_ORDER: DocType[] = ["tender", "requirement", "uat"];

export const DISPOSITION_LABEL: Record<string, string> = {
  deviation: "Deviation",
  change_of_scope: "Change of Scope",
  not_applicable: "Not Applicable",
};

export interface Clause {
  id: string;
  no: string;
  desc: string;
  tag: string;
  archived: boolean;
  position: number;
}

export interface DocVersion {
  version: number;
  uploadedBy: string;
  uploadedAt: number;
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
}

export interface TWDocument {
  id: string;
  type: DocType;
  name: string;
  version: number;
  createdBy: string;
  createdAt: number;
  clauses: Clause[];
  versionHistory: DocVersion[];
}

export interface Link {
  id: string;
  clauseKeys: string[]; // "docId::clauseId"
  status: "confirmed" | "suggested";
  score?: number | null;
  createdBy: string;
  createdAt: number;
  confirmedBy?: string | null;
  confirmedAt?: number | null;
  needsReview: boolean;
  needsReviewReason: string;
}

export interface GapMeta {
  owner: string;
  targetDate: string;
  notes: string;
  resolved: boolean;
  disposition: string;
}

export interface AuditEntry {
  ts: number;
  user: string;
  action: string;
  detail: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  createdBy: string;
  autoConfirmThreshold: number;
}

export interface ProjectData {
  documents: TWDocument[];
  links: Link[];
  gapMeta: Record<string, GapMeta>;
  auditLog: AuditEntry[];
  settings: { autoConfirmThreshold: number };
}

export function emptyProjectData(): ProjectData {
  return {
    documents: [],
    links: [],
    gapMeta: {},
    auditLog: [],
    settings: { autoConfirmThreshold: 90 },
  };
}

export function clauseKey(docId: string, clauseId: string) {
  return docId + "::" + clauseId;
}

export interface ClauseRef {
  docType: DocType;
  docName: string;
  no: string;
  desc: string;
}

export interface GapItem {
  key: string;
  type: "clause" | "link";
  refs: ClauseRef[];
  link?: Link;
}

export interface FlatClause {
  docId: string;
  docType: DocType;
  docName: string;
  clauseId: string;
  no: string;
  desc: string;
}
