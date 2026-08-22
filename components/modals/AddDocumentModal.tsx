"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import ManualRows, { EditRow, newRow } from "../ManualRows";
import { parseClauseFile, ParsedRow } from "@/lib/parse";
import * as api from "@/lib/api";
import { DOC_TYPE_LABEL, DocType } from "@/lib/types";

export default function AddDocumentModal({ onClose }: { onClose: () => void }) {
  const { projectId, me, setData, audit, toast } = useApp();
  const [type, setType] = useState<DocType>("tender");
  const [name, setName] = useState("");
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
    if (!projectId) return;
    let payload: { no: string; desc: string; tag?: string }[] = [];
    if (mode === "upload") {
      if (!uploadRows || !uploadRows.length) {
        toast("Upload a file first");
        return;
      }
      payload = uploadRows.map((r) => ({ no: r.no, desc: r.desc, tag: "" }));
    } else {
      payload = rows
        .filter((r) => r.no.trim() || r.desc.trim())
        .map((r) => ({ no: r.no.trim(), desc: r.desc.trim(), tag: r.tag }));
      if (!payload.length) {
        toast("Add at least one clause");
        return;
      }
    }
    setBusy(true);
    try {
      const docName = name.trim() || DOC_TYPE_LABEL[type];
      const doc = await api.insertDocument(
        projectId,
        type,
        docName,
        me.displayName,
        payload
      );
      setData((d) => ({ ...d, documents: [...d.documents, doc] }));
      await audit(
        "Added document",
        `${DOC_TYPE_LABEL[type]} "${docName}" (${payload.length} clauses)`
      );
      toast("Document added");
      onClose();
    } catch (e) {
      console.error(e);
      toast("Could not add document");
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
          <h3>Add document</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <div className="field">
              <label>Document type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DocType)}
              >
                <option value="tender">Tender Spec</option>
                <option value="requirement">Requirement Spec</option>
                <option value="uat">UAT Checksheet</option>
              </select>
            </div>
            <div className="field">
              <label>Document name</label>
              <input
                value={name}
                placeholder="e.g. Volume 2 — Technical"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>How will clauses be added?</label>
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
                  Expected columns: Clause No, Description (header names are
                  matched loosely; otherwise first two columns are used)
                </div>
              </label>
              <div className="hint">{status}</div>
            </div>
          ) : (
            <div>
              <ManualRows rows={rows} setRows={setRows} />
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
            {busy ? "Adding…" : "Add document"}
          </button>
        </div>
      </div>
    </div>
  );
}
