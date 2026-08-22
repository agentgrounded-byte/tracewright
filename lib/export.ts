import * as XLSX from "xlsx";
import {
  allClausesFlat,
  clauseLabel,
  confirmedLinksCoveringKey,
  gapMetaFor,
  linkStatus,
} from "./derive";
import { fmtDateTime } from "./format";
import {
  clauseKey,
  DISPOSITION_LABEL,
  DOC_TYPE_LABEL,
  DocType,
  ProjectData,
} from "./types";

type Row = Record<string, string>;

const BLANK_ROW: Row = {
  "Tender Clause": "",
  "Tender Description": "",
  "Requirement Clause": "",
  "Requirement Description": "",
  "UAT Clause": "",
  "UAT Description": "",
  Status: "",
  Disposition: "",
  Owner: "",
  "Target Date": "",
  Notes: "",
};

const COL_PREFIX: Record<DocType, string> = {
  tender: "Tender",
  requirement: "Requirement",
  uat: "UAT",
};

export function exportRTM(data: ProjectData, projectName: string) {
  const rows: Row[] = [];

  data.links
    .filter((l) => l.status === "confirmed")
    .forEach((link) => {
      const byType: Record<DocType, string[]> = {
        tender: [],
        requirement: [],
        uat: [],
      };
      const descByType: Record<DocType, string[]> = {
        tender: [],
        requirement: [],
        uat: [],
      };
      link.clauseKeys.forEach((k) => {
        const c = clauseLabel(data, k);
        if (c) {
          byType[c.type].push(c.no);
          descByType[c.type].push(c.desc);
        }
      });
      const meta = gapMetaFor(data, link.id);
      rows.push({
        "Tender Clause": byType.tender.join("; "),
        "Tender Description": descByType.tender.join("; "),
        "Requirement Clause": byType.requirement.join("; "),
        "Requirement Description": descByType.requirement.join("; "),
        "UAT Clause": byType.uat.join("; "),
        "UAT Description": descByType.uat.join("; "),
        Status: linkStatus(data, link),
        Disposition: meta.disposition
          ? DISPOSITION_LABEL[meta.disposition] || meta.disposition
          : "",
        Owner: meta.owner || "",
        "Target Date": meta.targetDate || "",
        Notes: meta.notes || "",
      });
    });

  allClausesFlat(data).forEach((c) => {
    const key = clauseKey(c.docId, c.clauseId);
    if (confirmedLinksCoveringKey(data, key).length === 0) {
      const meta = gapMetaFor(data, key);
      const row: Row = {
        ...BLANK_ROW,
        Status: "unmapped",
        Disposition: meta.disposition
          ? DISPOSITION_LABEL[meta.disposition] || meta.disposition
          : "",
        Owner: meta.owner || "",
        "Target Date": meta.targetDate || "",
        Notes: meta.notes || "",
      };
      row[`${COL_PREFIX[c.docType]} Clause`] = c.no;
      row[`${COL_PREFIX[c.docType]} Description`] = c.desc;
      rows.push(row);
    }
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  (ws as any)["!cols"] = [
    { wch: 14 }, { wch: 32 }, { wch: 16 }, { wch: 32 }, { wch: 12 },
    { wch: 32 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 24 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "RTM");

  const auditRows = (data.auditLog || []).map((a) => ({
    Time: fmtDateTime(a.ts),
    User: a.user,
    Action: a.action,
    Detail: a.detail,
  }));
  if (auditRows.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(auditRows),
      "Audit Log"
    );
  }

  XLSX.writeFile(wb, `RTM_${projectName.replace(/[^a-z0-9]+/gi, "_")}.xlsx`);
  return rows.length;
}

export { DOC_TYPE_LABEL };
