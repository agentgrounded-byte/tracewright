"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import ManualRows, { EditRow, newRow } from "../ManualRows";
import * as api from "@/lib/api";
import { DOC_TYPE_LABEL, TWDocument } from "@/lib/types";

export default function ViewDocModal({
  doc,
  onClose,
}: {
  doc: TWDocument;
  onClose: () => void;
}) {
  const { setData, audit, toast, confirmDialog } = useApp();
  const [rows, setRows] = useState<EditRow[]>(
    doc.clauses.map((c) => newRow(c.no, c.desc, c.tag, c.id))
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const kept = rows.filter((r) => r.no.trim() || r.desc.trim());
      const keptIds = new Set(kept.map((r) => r.id).filter(Boolean) as string[]);
      const removedIds = doc.clauses
        .filter((c) => !keptIds.has(c.id))
        .map((c) => c.id);

      // Update existing rows that changed.
      const existingById = new Map(doc.clauses.map((c) => [c.id, c]));
      const updates = kept
        .map((r, i) => ({ r, i }))
        .filter(({ r, i }) => {
          if (!r.id) return false;
          const c = existingById.get(r.id);
          return (
            !c ||
            c.no !== r.no.trim() ||
            c.desc !== r.desc.trim() ||
            c.tag !== r.tag ||
            c.position !== i
          );
        });
      await Promise.all(
        updates.map(({ r, i }) =>
          api.updateClause(r.id!, {
            no: r.no.trim(),
            desc: r.desc.trim(),
            tag: r.tag,
            position: i,
          })
        )
      );

      await api.deleteClauses(removedIds);

      // Insert brand-new rows.
      const newOnes = kept
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => !r.id);
      const inserted = await api.insertClauses(
        doc.id,
        newOnes.map(({ r, i }) => ({
          no: r.no.trim(),
          desc: r.desc.trim(),
          position: i,
        }))
      );
      // insertClauses does not carry tag; apply informational tags after insert.
      const taggedIds = inserted
        .filter((_, idx) => newOnes[idx]?.r.tag === "informational")
        .map((c) => c.id);
      await api.tagClausesInformational(taggedIds);

      let insertIdx = 0;
      const nextClauses = kept.map((r, i) => {
        if (r.id) {
          const prev = existingById.get(r.id)!;
          return {
            ...prev,
            no: r.no.trim(),
            desc: r.desc.trim(),
            tag: r.tag,
            position: i,
          };
        }
        const created = inserted[insertIdx++];
        return {
          id: created.id,
          no: r.no.trim(),
          desc: r.desc.trim(),
          tag: r.tag,
          archived: false,
          position: i,
        };
      });

      setData((d) => ({
        ...d,
        documents: d.documents.map((x) =>
          x.id === doc.id ? { ...x, clauses: nextClauses } : x
        ),
        links: d.links
          .map((l) => ({
            ...l,
            clauseKeys: l.clauseKeys.filter(
              (k) => !removedIds.includes(k.split("::")[1])
            ),
          }))
          .filter((l) => l.clauseKeys.length > 0),
      }));

      await audit(
        "Edited document clauses",
        `${doc.name} now has ${nextClauses.length} clauses`
      );
      toast("Document updated");
      onClose();
    } catch (e) {
      console.error(e);
      toast("Could not save changes");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirmDialog(
      `Delete "${doc.name}"? This will remove its clauses from any links.`,
      "Delete document"
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteDocument(doc.id);
      setData((d) => ({
        ...d,
        documents: d.documents.filter((x) => x.id !== doc.id),
        links: d.links
          .map((l) => ({
            ...l,
            clauseKeys: l.clauseKeys.filter((k) => !k.startsWith(doc.id + "::")),
          }))
          .filter((l) => l.clauseKeys.length > 0),
      }));
      await audit("Deleted document", doc.name);
      toast("Document deleted");
      onClose();
    } catch (e) {
      console.error(e);
      toast("Could not delete document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>
            {doc.name} — {DOC_TYPE_LABEL[doc.type]}
          </h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <ManualRows rows={rows} setRows={setRows} />
          <button
            className="btn small ghost"
            style={{ marginTop: 8 }}
            onClick={() => setRows([...rows, newRow()])}
          >
            + Add row
          </button>
        </div>
        <div className="modal-foot">
          <button className="btn danger ghost" onClick={remove} disabled={busy}>
            Delete document
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
