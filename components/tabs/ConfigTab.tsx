"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import * as api from "@/lib/api";

export default function ConfigTab() {
  const { data, setData, projectId, audit, toast } = useApp();
  const [value, setValue] = useState(String(data.settings.autoConfirmThreshold));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    let val = parseFloat(value);
    if (isNaN(val) || val < 0 || val > 100) {
      toast("Enter a number between 0 and 100");
      return;
    }
    val = Math.round(val * 10) / 10;
    const prev = data.settings.autoConfirmThreshold;
    if (!projectId) return;
    setBusy(true);
    try {
      await api.saveThreshold(projectId, val);
      setData((d) => ({
        ...d,
        settings: { ...d.settings, autoConfirmThreshold: val },
      }));
      await audit("Updated auto-confirm threshold", `${prev}% → ${val}%`);
      setNote("Saved. New auto-suggest runs will use this threshold.");
      toast("Threshold saved");
    } catch (e) {
      console.error(e);
      toast("Could not save threshold");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Configuration</h2>
          <div className="desc">
            Settings that apply to this project&apos;s auto-suggest mapping.
          </div>
        </div>
      </div>

      <div className="coverage-bar-wrap" style={{ maxWidth: 520 }}>
        <h3>Auto-confirm threshold</h3>
        <p className="hint" style={{ margin: "-4px 0 14px" }}>
          When auto-suggest finds a match at or above this confidence, it will
          be confirmed automatically as mapped and skip manual review. Matches
          below this score still appear under “Suggested links pending review.”
        </p>
        <div className="field-row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Threshold (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 0 }}>
            <button className="btn primary" onClick={save} disabled={busy}>
              Save
            </button>
          </div>
        </div>
        <div className="hint">{note}</div>
      </div>
    </section>
  );
}
