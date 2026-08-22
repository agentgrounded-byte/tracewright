"use client";

import { useMemo, useState } from "react";
import { useApp } from "../AppContext";
import * as api from "@/lib/api";
import { gapItems, gapIsOpen, gapMetaFor } from "@/lib/derive";
import { daysUntil } from "@/lib/format";
import { DISPOSITION_LABEL, DOC_TYPE_LABEL, GapItem } from "@/lib/types";

type Filter = "open" | "dispositioned" | "resolved" | "all";

export default function GapsTab() {
  const {
    data,
    setData,
    projectId,
    projectName,
    me,
    audit,
    toast,
    saveGapMeta,
  } = useApp();
  const [filter, setFilter] = useState<Filter>("open");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOwner, setBulkOwner] = useState("");
  const [bulkDate, setBulkDate] = useState("");

  const items = useMemo(() => gapItems(data), [data]);

  const visible = items.filter((item) => {
    const meta = gapMetaFor(data, item.key);
    if (filter === "open") return gapIsOpen(meta);
    if (filter === "dispositioned") return !!meta.disposition && !meta.resolved;
    if (filter === "resolved") return meta.resolved;
    return true;
  });
  const visibleKeys = visible.map((i) => i.key);

  function refLabel(item: GapItem) {
    return item.refs[0]?.no || item.key;
  }

  async function markInformational(item: GapItem) {
    const [, clauseId] = item.key.split("::");
    try {
      await api.tagClausesInformational([clauseId]);
      setData((d) => ({
        ...d,
        documents: d.documents.map((doc) => ({
          ...doc,
          clauses: doc.clauses.map((c) =>
            c.id === clauseId ? { ...c, tag: "informational" } : c
          ),
        })),
      }));
      await audit(
        "Marked clause informational",
        refLabel(item) + " — excluded from mapping"
      );
      toast("Marked informational — removed from mapping and gap tracking");
    } catch (e) {
      console.error(e);
      toast("Could not update this clause");
    }
  }

  function sendReminder(item: GapItem) {
    const meta = gapMetaFor(data, item.key);
    const refDesc = item.refs
      .map((r) => DOC_TYPE_LABEL[r.docType] + " " + (r.no || "—"))
      .join(", ");
    const subject = `Reminder: RTM gap — ${refDesc}`;
    const body = [
      `Hi ${meta.owner || "there"},`,
      ``,
      `This is a reminder regarding an open item in the traceability matrix for project "${projectName}":`,
      ``,
      `Reference: ${refDesc}`,
      `Description: ${item.refs[0]?.desc || ""}`,
      `Target end date: ${meta.targetDate || "not set"}`,
      `Notes: ${meta.notes || "—"}`,
      ``,
      `Please update the status or close this out by the target date.`,
      ``,
      `Thanks,`,
      me.displayName,
    ].join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    audit("Sent reminder", refDesc);
  }

  async function applyBulkOwner() {
    const val = bulkOwner.trim();
    if (!val) {
      toast("Enter an owner name first");
      return;
    }
    if (!selected.size) {
      toast("Select at least one item");
      return;
    }
    const affected: string[] = [];
    for (const key of Array.from(selected)) {
      const item = items.find((i) => i.key === key);
      await saveGapMeta(key, { owner: val });
      affected.push(item?.refs[0]?.no || key);
    }
    await audit(
      "Bulk-reassigned owner",
      `${affected.length} item(s) reassigned to ${val}: ${affected
        .slice(0, 8)
        .join(", ")}${affected.length > 8 ? "…" : ""}`
    );
    setSelected(new Set());
    setBulkOwner("");
    toast(`Owner set to "${val}" for ${affected.length} item(s)`);
  }

  async function applyBulkDate() {
    if (!bulkDate) {
      toast("Pick a date first");
      return;
    }
    if (!selected.size) {
      toast("Select at least one item");
      return;
    }
    const affected: string[] = [];
    for (const key of Array.from(selected)) {
      const item = items.find((i) => i.key === key);
      await saveGapMeta(key, { targetDate: bulkDate });
      affected.push(item?.refs[0]?.no || key);
    }
    await audit(
      "Bulk-updated target date",
      `${affected.length} item(s) set to ${bulkDate}: ${affected
        .slice(0, 8)
        .join(", ")}${affected.length > 8 ? "…" : ""}`
    );
    setSelected(new Set());
    setBulkDate("");
    toast(`Target date applied to ${affected.length} item(s)`);
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Gap Tracker</h2>
          <div className="desc">
            Unmapped and partially mapped items. Assign an owner and target
            date, then send a reminder.
          </div>
        </div>
      </div>

      <div className="gap-filters">
        {(["open", "dispositioned", "resolved", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            className={filter === f ? "active" : ""}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <div className="sel-info">
            <strong>{selected.size}</strong> item(s) selected
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              placeholder="Assign to…"
              value={bulkOwner}
              onChange={(e) => setBulkOwner(e.target.value)}
              style={{
                padding: "6px 8px",
                border: "1px solid var(--line)",
                borderRadius: 4,
                fontSize: 12.5,
                width: 150,
              }}
            />
            <button className="btn primary small" onClick={applyBulkOwner}>
              Apply owner to selected
            </button>
            <span style={{ width: 1, height: 20, background: "var(--line)" }} />
            <input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
            />
            <button className="btn primary small" onClick={applyBulkDate}>
              Apply date to selected
            </button>
            <button
              className="btn ghost small"
              onClick={() => setSelected(new Set())}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <label
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={
              visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k))
            }
            onChange={(e) =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (e.target.checked) visibleKeys.forEach((k) => next.add(k));
                else visibleKeys.forEach((k) => next.delete(k));
                return next;
              })
            }
          />{" "}
          Select all visible
        </label>
      </div>

      {visible.length ? (
        visible.map((item) => {
          const meta = gapMetaFor(data, item.key);
          const due = daysUntil(meta.targetDate);
          const kind = item.type === "clause" ? "unmapped" : "partial";
          let dueBadge: React.ReactNode = null;
          if (meta.resolved)
            dueBadge = <span className="badge resolved">resolved</span>;
          else if (meta.disposition)
            dueBadge = (
              <span className="badge disposition">
                {DISPOSITION_LABEL[meta.disposition] || meta.disposition}
              </span>
            );
          else if (meta.targetDate && due !== null) {
            if (due < 0)
              dueBadge = (
                <span className="badge overdue">overdue {Math.abs(due)}d</span>
              );
            else if (due <= 7)
              dueBadge = <span className="badge soon">due in {due}d</span>;
            else dueBadge = <span className="badge ontrack">on track</span>;
          }

          return (
            <div
              key={item.key}
              className={
                "gap-card" +
                (meta.resolved
                  ? " is-resolved"
                  : meta.disposition
                  ? " is-dispositioned"
                  : "")
              }
            >
              <div className="gap-card-top">
                <div className="refs">
                  <input
                    type="checkbox"
                    className="gap-select"
                    checked={selected.has(item.key)}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(item.key);
                        else next.delete(item.key);
                        return next;
                      })
                    }
                  />
                  <span className={"badge " + kind}>{kind}</span>
                  &nbsp;
                  {item.refs.map((r, i) => (
                    <span key={i}>
                      <span className="lbl">{DOC_TYPE_LABEL[r.docType]}</span>
                      <span className="chip-inline">{r.no || "—"}</span>{" "}
                    </span>
                  ))}
                  <div className="hint" style={{ marginTop: 4 }}>
                    {(item.refs[0]?.desc || "").slice(0, 140)}
                  </div>
                </div>
                {dueBadge}
              </div>

              <div className="gap-fields">
                <div className="f">
                  <label>Owner</label>
                  <input
                    type="text"
                    defaultValue={meta.owner}
                    placeholder="Assign to…"
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v === meta.owner) return;
                      await saveGapMeta(item.key, { owner: v });
                      await audit(
                        "Updated gap tracking",
                        `${refLabel(item)} — owner: ${v || "—"}, target: ${
                          meta.targetDate || "—"
                        }`
                      );
                    }}
                  />
                </div>
                <div className="f">
                  <label>Target date</label>
                  <input
                    type="date"
                    defaultValue={meta.targetDate}
                    onChange={async (e) => {
                      const v = e.target.value;
                      await saveGapMeta(item.key, { targetDate: v });
                      await audit(
                        "Updated gap tracking",
                        `${refLabel(item)} — owner: ${
                          meta.owner || "—"
                        }, target: ${v || "—"}`
                      );
                    }}
                  />
                </div>
                <div className="f">
                  <label>Disposition</label>
                  <select
                    value={meta.disposition}
                    onChange={async (e) => {
                      const v = e.target.value;
                      await saveGapMeta(item.key, { disposition: v });
                      await audit(
                        "Set gap disposition",
                        `${refLabel(item)} — ${
                          v ? DISPOSITION_LABEL[v] || v : "cleared"
                        }`
                      );
                    }}
                  >
                    <option value="">— none —</option>
                    <option value="deviation">Deviation</option>
                    <option value="change_of_scope">Change of Scope</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                </div>
                <div className="f">
                  <label>Notes</label>
                  <input
                    type="text"
                    defaultValue={meta.notes}
                    placeholder="Optional notes"
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v === meta.notes) return;
                      await saveGapMeta(item.key, { notes: v });
                      await audit(
                        "Updated gap tracking",
                        `${refLabel(item)} — notes updated`
                      );
                    }}
                  />
                </div>
                <div className="f">
                  <label>&nbsp;</label>
                  <button
                    className={"btn small " + (meta.resolved ? "" : "primary")}
                    onClick={async () => {
                      const next = !meta.resolved;
                      await saveGapMeta(item.key, { resolved: next });
                      await audit(
                        next ? "Marked gap resolved" : "Reopened gap",
                        refLabel(item)
                      );
                    }}
                  >
                    {meta.resolved ? "Reopen" : "Mark resolved"}
                  </button>
                </div>
                <div className="f">
                  <label>&nbsp;</label>
                  <button
                    className="btn small"
                    onClick={() => sendReminder(item)}
                  >
                    ✉ Remind
                  </button>
                </div>
                {item.type === "clause" && (
                  <div className="f">
                    <label>&nbsp;</label>
                    <button
                      className="btn small ghost"
                      onClick={() => markInformational(item)}
                    >
                      Mark informational
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="empty-state">
          <h3>No gaps here</h3>
          <p>Nothing matches this filter right now.</p>
        </div>
      )}
    </section>
  );
}
