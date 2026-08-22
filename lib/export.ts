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

export function exportRTM(data: ProjectData, projectName: string) {
  // --- Sheet 1: RTM (confirmed links only)
  const rtmRows: Row[] = [];
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
      rtmRows.push({
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

  // --- Sheet 2: Informational clauses (excluded from mapping entirely)
  const informationalRows: Row[] = [];
  data.documents.forEach((doc) => {
    doc.clauses.forEach((c) => {
      if (c.tag === "informational") {
        informationalRows.push({
          "Document Type": DOC_TYPE_LABEL[doc.type],
          "Document Name": doc.name,
          "Clause No": c.no || "",
          Description: c.desc || "",
          Retired: c.archived ? "Yes" : "",
        });
      }
    });
  });

  // --- Sheet 3: Unmapped clauses (no confirmed link at all)
  const unmappedRows: Row[] = [];
  allClausesFlat(data).forEach((c) => {
    const key = clauseKey(c.docId, c.clauseId);
    if (confirmedLinksCoveringKey(data, key).length === 0) {
      const meta = gapMetaFor(data, key);
      unmappedRows.push({
        "Document Type": DOC_TYPE_LABEL[c.docType],
        "Document Name": c.docName,
        "Clause No": c.no || "",
        Description: c.desc || "",
        Disposition: meta.disposition
          ? DISPOSITION_LABEL[meta.disposition] || meta.disposition
          : "",
        Owner: meta.owner || "",
        "Target Date": meta.targetDate || "",
        Notes: meta.notes || "",
      });
    }
  });

  const wb = XLSX.utils.book_new();

  const wsRtm = XLSX.utils.json_to_sheet(
    rtmRows.length ? rtmRows : [{ "Tender Clause": "(none yet)" }]
  );
  (wsRtm as any)["!cols"] = [
    { wch: 14 }, { wch: 32 }, { wch: 16 }, { wch: 32 }, { wch: 12 },
    { wch: 32 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRtm, "RTM");

  const wsInfo = XLSX.utils.json_to_sheet(
    informationalRows.length ? informationalRows : [{ "Document Type": "(none yet)" }]
  );
  (wsInfo as any)["!cols"] = [
    { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 44 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Informational");

  const wsUnmapped = XLSX.utils.json_to_sheet(
    unmappedRows.length ? unmappedRows : [{ "Document Type": "(none yet)" }]
  );
  (wsUnmapped as any)["!cols"] = [
    { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 44 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsUnmapped, "Unmapped");

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
  return {
    confirmed: rtmRows.length,
    informational: informationalRows.length,
    unmapped: unmappedRows.length,
  };
}

export { DOC_TYPE_LABEL };
