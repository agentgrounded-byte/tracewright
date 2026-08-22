"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import ManualRows, { EditRow, newRow } from "../ManualRows";
import { parseClauseFile, ParsedRow } from "@/lib/parse";
import * as api from "@/lib/api";
import { normClauseNo } from "@/lib/format";
import { Clause, TWDocument } from "@/lib/types";

export default function ReplaceVersionModal({
  doc,
  onClose,
}: {
  doc: TWDocument;
  onClose: () => void;
}) {
  const { data, setData, audit, toast, me } = useApp();
  const [mode, setMode] = useState<"upload" | "manual">("upload");
  const [uploadRows, setUploadRows] = useState<ParsedRow[] | null>(null);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<EditRow[]>([newRow(), newRow(), newRow()]);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Reading " + file.name + "…");
    try {
      const parsed = await parseClauseFile(file);
      setUploadRows(parsed);
      setStatus(`${parsed.length} clause(s) parsed from ${file.name}`);
    } catch (err) {
      setUploadRows(null);
      setStatus((err as Error).message);
    }
  }

  async function confirm() {
    let newRows: ParsedRow[] = [];
    if (mode === "upload") {
      if (!uploadRows || !uploadRows.length) {
        toast("Upload a file first");
        return;
      }
      newRows = uploadRows;
    } else {
      newRows = rows
        .filter((r) => r.no.trim() || r.desc.trim())
        .map((r) => ({ no: r.no.trim(), desc: r.desc.trim() }));
      if (!newRows.length) {
        toast("Add at least one clause");
        return;
      }
    }

    setBusy(true);
    try {
      // Diff by clause number: matched numbers keep their id (and mapping
      // history); changed text flags any link for re-check instead of silently
      // overwriting it; numbers missing from the new upload are retired.
      const oldByNo = new Map<string, Clause>();
      doc.clauses
        .filter((c) => !c.archived)
        .forEach((c) => oldByNo.set(normClauseNo(c.no), c));

      let added = 0,
        removed = 0,
        changed = 0,
        unchanged = 0;
      const flaggedLinkIds = new Set<string>();
      const resultClauses: Clause[] = [];
      const updates: { id: string; no: string; desc: string; position: number }[] =
        [];
      const inserts: { no: string; desc: string; position: number }[] = [];
      const archives: string[] = [];
      const insertSlots: number[] = [];

      const version = (doc.version || 1) + 1;

      newRows.forEach((r, i) => {
        const key = normClauseNo(r.no);
        const old = key ? oldByNo.get(key) : undefined;
        if (old) {
          if ((old.desc || "").trim() !== (r.desc || "").trim()) {
            changed++;
            // flagged below via link scan
          } else {
            unchanged++;
          }
          updates.push({ id: old.id, no: r.no, desc: r.desc, position: i });
          resultClauses.push({ ...old, no: r.no, desc: r.desc, position: i });
          oldByNo.delete(key);
        } else {
          added++;
          inserts.push({ no: r.no, desc: r.desc, position: i });
          insertSlots.push(resultClauses.length);
          resultClauses.push({
            id: "__pending__" + i,
            no: r.no,
            desc: r.desc,
            tag: "",
            archived: false,
            position: i,
          });
        }
      });

      // Anything left in oldByNo is retired.
      oldByNo.forEach((old) => {
        removed++;
        archives.push(old.id);
        resultClauses.push({ ...old, archived: true });
      });

      // Recompute which links are affected (changed text or retired clause).
      const touchedClauseIds = new Set<string>();
      newRows.forEach((r) => {
        const key = normClauseNo(r.no);
        const old = doc.clauses.find(
          (c) => !c.archived && normClauseNo(c.no) === key
        );
        if (old && (old.desc || "").trim() !== (r.desc || "").trim())
          touchedClauseIds.add(old.id);
      });
      archives.forEach((id) => touchedClauseIds.add(id));

      // Carry over previously archived clauses.
      doc.clauses
        .filter((c) => c.archived)
        .forEach((c) => {
          if (!resultClauses.some((r) => r.id === c.id)) resultClauses.push(c);
        });

      await Promise.all(
        updates.map((u) =>
          api.updateClause(u.id, {
            no: u.no,
            desc: u.desc,
            position: u.position,
          })
        )
      );
      await Promise.all(
        archives.map((id) => api.updateClause(id, { archived: true }))
      );
      const insertedClauses = await api.insertClauses(doc.id, inserts);
      insertSlots.forEach((slot, idx) => {
        const created = insertedClauses[idx];
        if (created) resultClauses[slot] = created;
      });

      const reason = `Clause text changed or was retired in "${doc.name}" v${version}`;
      data.links.forEach((l) => {
        l.clauseKeys.forEach((k) => {
          const cid = k.split("::")[1];
          if (touchedClauseIds.has(cid)) flaggedLinkIds.add(l.id);
        });
      });
      await api.flagLinksForReview(Array.from(flaggedLinkIds), reason);

      await api.bumpDocumentVersion(doc.id, version, {
        uploadedBy: me.displayName,
        added,
        removed,
        changed,
        unchanged,
      });

      setData((d) => ({
        ...d,
        documents: d.documents.map((x) =>
          x.id === doc.id
            ? {
                ...x,
                clauses: resultClauses,
                version,
                versionHistory: [
                  ...x.versionHistory,
                  {
                    version,
                    uploadedBy: me.displayName,
                    uploadedAt: Date.now(),
                    added,
                    removed,
                    changed,
                    unchanged,
                  },
                ],
              }
            : x
        ),
        links: d.links.map((l) =>
          flaggedLinkIds.has(l.id)
            ? { ...l, needsReview: true, needsReviewReason: reason }
            : l
        ),
      }));

      await audit(
        "Uploaded new version",
        `${doc.name} → v${version}: ${added} added, ${removed} retired, ${changed} changed, ${unchanged} unchanged. ${flaggedLinkIds.size} mapping(s) flagged for re-check.`
      );
      toast(
        `v${version}: ${added} added, ${removed} retired, ${changed} changed — ${flaggedLinkIds.size} mapping(s) flagged for re-check`
      );
      onClose();
    } catch (e) {
      console.error(e);
      toast("Could not replace this version");
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
          <h3>Upload new version — {doc.name}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ margin: "0 0 14px", fontSize: 12 }}>
            Rows are matched to the existing document <strong>by clause
            number</strong>. Matching numbers keep their mapping history — if the
            description text changed, any linked mapping is flagged for re-check
            rather than silently updated. Numbers missing from this upload are
            retired (kept for history, removed from active mapping). New numbers
            are added as unmapped.
          </p>

          <div className="field">
            <label>How will the new version be added?</label>
            <div className="seg">
              <button
                className={mode === "upload" ? "active" : ""}
                onClick={() => setMode("upload")}
              >
                Upload file
              </button>
              <button
                className={mode === "manual" ? "active" : ""}
                onClick={() => setMode("manual")}
              >
                Key in manually
              </button>
            </div>
          </div>

          {mode === "upload" ? (
            <div>
              <label className="upload-drop">
                <input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} />
                <div>📄 Click to choose a CSV or Excel file</div>
                <div className="hint">
                  Same columns as before: Clause No, Description.
                </div>
              </label>
              <div className="hint">{status}</div>
            </div>
          ) : (
            <div>
              <ManualRows rows={rows} setRows={setRows} showTag={false} />
              <button
                className="btn small ghost"
                style={{ marginTop: 8 }}
                onClick={() => setRows([...rows, newRow()])}
              >
                + Add row
              </button>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={confirm} disabled={busy}>
            {busy ? "Replacing…" : "Replace version"}
          </button>
        </div>
      </div>
    </div>
  );
}
