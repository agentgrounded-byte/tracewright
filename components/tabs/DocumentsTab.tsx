"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import AddDocumentModal from "../modals/AddDocumentModal";
import ViewDocModal from "../modals/ViewDocModal";
import ReplaceVersionModal from "../modals/ReplaceVersionModal";
import { DOC_TYPE_LABEL } from "@/lib/types";

export default function DocumentsTab() {
  const { data } = useApp();
  const [adding, setAdding] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const viewing = data.documents.find((d) => d.id === viewingId) ?? null;
  const replacing = data.documents.find((d) => d.id === replacingId) ?? null;

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
