"use client";

import { useState } from "react";
import { useApp } from "../AppContext";

export default function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { addProject, toast } = useApp();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const v = name.trim();
    if (!v) {
      toast("Enter a project name");
      return;
    }
    setBusy(true);
    try {
      await addProject(v);
      onClose();
    } catch (e) {
      console.error(e);
      toast("Could not create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>New project</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Project name</label>
            <input
              autoFocus
              value={name}
              placeholder="e.g. Campus Network Upgrade RFP"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={create} disabled={busy}>
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}
