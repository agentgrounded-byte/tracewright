"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import Pagination from "../Pagination";
import AddDocumentModal from "../modals/AddDocumentModal";
import ViewDocModal from "../modals/ViewDocModal";
import ReplaceVersionModal from "../modals/ReplaceVersionModal";
import * as api from "@/lib/api";
import { GENERIC_PAGE_SIZE } from "@/lib/derive";
import { afterPaint, flashHighlightEl } from "@/lib/format";
import { Clause, DOC_TYPE_LABEL, TWDocument, clauseKey } from "@/lib/types";

export default function DocumentsTab() {
  const { data, setData, audit, toast, jumpTarget, setJumpTarget } = useApp();
  const [adding, setAdding] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [infoPage, setInfoPage] = useState(1);

  const viewing = data.documents.find((d) => d.id === viewingId) ?? null;
  const replacing = data.documents.find((d) => d.id === replacingId) ?? null;

  const infoItems = useMemo(() => {
    const out: { doc: TWDocument; clause: Clause }[] = [];
    data.documents.forEach((doc) => {
      doc.clauses.forEach((clause) => {
        if (clause.tag === "informational") out.push({ doc, clause });
      });
    });
    return out;
  }, [data.documents]);

  const totalPages = Math.max(1, Math.ceil(infoItems.length / GENERIC_PAGE_SIZE));
  const currentInfoPage = Math.min(Math.max(infoPage, 1), totalPages);
  const infoStartIdx = (currentInfoPage - 1) * GENERIC_PAGE_SIZE;
  const infoPageItems = infoItems.slice(infoStartIdx, infoStartIdx + GENERIC_PAGE_SIZE);

  useEffect(() => {
    if (!jumpTarget) return;
    const doc = data.documents.find((d) => d.id === jumpTarget.docId);
    const clause = doc?.clauses.find((c) => c.id === jumpTarget.clauseId);
    if (!doc || !clause) {
      setJumpTarget(null);
      return;
    }
    if (clause.tag !== "informational" && clause.archived) {
      setViewingId(doc.id);
      setJumpTarget(null);
      return;
    }
    if (clause.tag !== "informational") {
      setJumpTarget(null);
      return;
    }
    const idx = infoItems.findIndex(
      (i) => i.doc.id === doc.id && i.clause.id === clause.id
    );
    if (idx >= 0) setInfoPage(Math.floor(idx / GENERIC_PAGE_SIZE) + 1);
    const key = clauseKey(doc.id, clause.id);
    afterPaint(() => {
      const el = document.querySelector(`.info-clause-row[data-key="${CSS.escape(key)}"]`);
      flashHighlightEl(el);
    });
    setJumpTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTarget]);

  async function revertInformational(docId: string, clauseId: string, no: string, docName: string) {
    try {
      await api.updateClause(clauseId, { tag: "" });
      setData((d) => ({
        ...d,
        documents: d.documents.map((doc) =>
          doc.id === docId
            ? {
                ...doc,
                clauses: doc.clauses.map((c) =>
                  c.id === clauseId ? { ...c, tag: "" } : c
                ),
              }
            : doc
        ),
      }));
      await audit(
        "Reverted informational tag",
        `${no || "clause"} in ${docName} — back to needs mapping`
      );
      toast("Reverted — clause now needs mapping");
    } catch (e) {
      console.error(e);
      toast("Could not update this clause");
    }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Documents</h2>
          <div className="desc">
            Upload files or key clauses in manually, grouped by document type.
          </div>
        </div>
      </div>

      <div className="doc-grid">
        {data.documents.map((doc) => {
          const archivedCount = doc.clauses.filter((c) => c.archived).length;
          const infoCount = doc.clauses.filter(
            (c) => !c.archived && c.tag === "informational"
          ).length;
          const needsMapping = doc.clauses.length - archivedCount - infoCount;
          return (
            <div className="doc-card" key={doc.id}>
              <span className={"doc-type-badge " + doc.type}>
                {DOC_TYPE_LABEL[doc.type]}
              </span>
              <span className="version-badge">v{doc.version || 1}</span>
              <h4>{doc.name}</h4>
              <div className="meta">
                {needsMapping} clause{needsMapping === 1 ? "" : "s"}
                {infoCount ? ` · ${infoCount} informational` : ""}
                {archivedCount ? ` · ${archivedCount} retired` : ""} · added by{" "}
                {doc.createdBy}
              </div>
              <div className="doc-actions">
                <button
                  className="btn small"
                  onClick={() => setViewingId(doc.id)}
                >
                  View / edit
                </button>
                <button
                  className="btn small"
                  onClick={() => setReplacingId(doc.id)}
                >
                  New version…
                </button>
              </div>
            </div>
          );
        })}
        <button className="add-doc-card" onClick={() => setAdding(true)}>
          + Add document
        </button>
      </div>

      <div className="section-head" style={{ marginTop: 8 }}>
        <div>
          <h2 style={{ fontSize: 15 }}>Informational Clauses</h2>
          <div className="desc">
            Excluded from mapping, the Gap Tracker, and Dashboard stats. Revert
            any of these back to &quot;Needs mapping&quot; if it was tagged by
            mistake.
          </div>
        </div>
      </div>
      {infoItems.length ? (
        <>
          <div>
            {infoPageItems.map(({ doc, clause }) => (
              <div
                className="info-clause-row"
                key={clauseKey(doc.id, clause.id)}
                data-key={clauseKey(doc.id, clause.id)}
              >
                <div className="txt">
                  <span
                    className={"doc-type-badge " + doc.type}
                    style={{ margin: "0 6px 0 0", verticalAlign: "middle" }}
                  >
                    {DOC_TYPE_LABEL[doc.type]}
                  </span>
                  <span className="no">{clause.no || "—"}</span>
                  <span className="desc">{clause.desc || ""}</span>
                  <div className="meta">
                    {doc.name}
                    {clause.archived ? " · retired" : ""}
                  </div>
                </div>
                <button
                  className="btn small ghost"
                  onClick={() =>
                    revertInformational(doc.id, clause.id, clause.no, doc.name)
                  }
                >
                  Revert to needs mapping
                </button>
              </div>
            ))}
          </div>
          <Pagination
            page={currentInfoPage}
            totalPages={totalPages}
            totalItems={infoItems.length}
            pageSize={GENERIC_PAGE_SIZE}
            startIdx={infoStartIdx}
            onPrev={() => setInfoPage(currentInfoPage - 1)}
            onNext={() => setInfoPage(currentInfoPage + 1)}
          />
        </>
      ) : (
        <div className="empty-state">
          <h3>No informational clauses yet</h3>
          <p>
            Tag a clause as informational from a document&apos;s
            &quot;View/edit&quot; screen, from the Gap Tracker, or
            automatically via Auto-suggest.
          </p>
        </div>
      )}

      {adding && <AddDocumentModal onClose={() => setAdding(false)} />}
      {viewing && (
        <ViewDocModal doc={viewing} onClose={() => setViewingId(null)} />
      )}
      {replacing && (
        <ReplaceVersionModal
          doc={replacing}
          onClose={() => setReplacingId(null)}
        />
      )}
    </section>
  );
}
