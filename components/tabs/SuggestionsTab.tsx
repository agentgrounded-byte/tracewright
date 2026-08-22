"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import * as api from "@/lib/api";
import { SUGGEST_PAGE_SIZE, clauseLabel } from "@/lib/derive";
import { afterPaint, flashHighlightEl } from "@/lib/format";
import { DOC_TYPE_LABEL, clauseKey } from "@/lib/types";

export default function SuggestionsTab() {
  const {
    data,
    setData,
    me,
    audit,
    toast,
    markSessionConfirmed,
    jumpTarget,
    setJumpTarget,
  } = useApp();
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const suggested = useMemo(() => {
    const list = data.links.filter((l) => l.status === "suggested");
    list.sort((a, b) =>
      sort === "asc"
        ? (a.score || 0) - (b.score || 0)
        : (b.score || 0) - (a.score || 0)
    );
    return list;
  }, [data.links, sort]);

  // drop selections for suggestions no longer pending (accepted/rejected elsewhere)
  useEffect(() => {
    const ids = new Set(suggested.map((l) => l.id));
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (ids.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [suggested]);

  const totalPages = Math.max(1, Math.ceil(suggested.length / SUGGEST_PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), totalPages);
  const startIdx = (current - 1) * SUGGEST_PAGE_SIZE;
  const pageItems = suggested.slice(startIdx, startIdx + SUGGEST_PAGE_SIZE);
  const allOnPageSelected =
    pageItems.length > 0 && pageItems.every((l) => selected.has(l.id));

  useEffect(() => {
    if (!jumpTarget) return;
    const key = clauseKey(jumpTarget.docId, jumpTarget.clauseId);
    const link = data.links.find(
      (l) => l.status === "suggested" && l.clauseKeys.includes(key)
    );
    if (!link) {
      setJumpTarget(null);
      return;
    }
    const idx = suggested.findIndex((l) => l.id === link.id);
    if (idx >= 0) setPage(Math.floor(idx / SUGGEST_PAGE_SIZE) + 1);
    afterPaint(() => {
      const el = document.querySelector(`.suggest-item[data-link-id="${link.id}"]`);
      flashHighlightEl(el);
    });
    setJumpTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTarget]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageItems.forEach((l) => next.delete(l.id));
      else pageItems.forEach((l) => next.add(l.id));
      return next;
    });
  }

  async function bulkAccept() {
    if (!selected.size) {
      toast("Select at least one item");
      return;
    }
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map((id) => api.confirmLink(id, me.displayName)));
      ids.forEach((id) => markSessionConfirmed(id));
      setData((d) => ({
        ...d,
        links: d.links.map((l) =>
          ids.includes(l.id)
            ? {
                ...l,
                status: "confirmed",
                confirmedBy: me.displayName,
                confirmedAt: Date.now(),
              }
            : l
        ),
      }));
      await audit(
        "Bulk-accepted suggested links",
        `${ids.length} suggested link(s) confirmed`
      );
      setSelected(new Set());
      toast(`${ids.length} suggestion(s) accepted`);
    } catch (e) {
      console.error(e);
      toast("Could not accept selected suggestions");
    }
  }

  async function bulkReject() {
    if (!selected.size) {
      toast("Select at least one item");
      return;
    }
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map((id) => api.removeLink(id)));
      setData((d) => ({
        ...d,
        links: d.links.filter((l) => !ids.includes(l.id)),
      }));
      await audit(
        "Bulk-rejected suggested links",
        `${ids.length} suggested link(s) rejected`
      );
      setSelected(new Set());
      toast(`${ids.length} suggestion(s) rejected`);
    } catch (e) {
      console.error(e);
      toast("Could not reject selected suggestions");
    }
  }

  async function accept(linkId: string) {
    const link = data.links.find((l) => l.id === linkId);
    if (!link) return;
    try {
      await api.confirmLink(linkId, me.displayName);
      markSessionConfirmed(linkId);
      setData((d) => ({
        ...d,
        links: d.links.map((l) =>
          l.id === linkId
            ? {
                ...l,
                status: "confirmed",
                confirmedBy: me.displayName,
                confirmedAt: Date.now(),
              }
            : l
        ),
      }));
      await audit(
        "Accepted suggested link",
        link.clauseKeys.length + " clause(s)"
      );
      toast("Suggestion accepted");
    } catch (e) {
      console.error(e);
      toast("Could not accept suggestion");
    }
  }

  async function reject(linkId: string) {
    try {
      await api.removeLink(linkId);
      setData((d) => ({ ...d, links: d.links.filter((l) => l.id !== linkId) }));
      await audit("Rejected suggested link", linkId);
      toast("Suggestion rejected");
    } catch (e) {
      console.error(e);
      toast("Could not reject suggestion");
    }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Suggested Links Pending Review</h2>
          <div className="desc">
            Auto-suggested matches below the auto-confirm threshold. Accept or
            reject each one.
          </div>
        </div>
        <div className="left" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            Sort by % match:
          </span>
          <div className="seg" style={{ width: 200 }}>
            <button
              className={sort === "desc" ? "active" : ""}
              onClick={() => setSort("desc")}
            >
              High → Low
            </button>
            <button
              className={sort === "asc" ? "active" : ""}
              onClick={() => setSort("asc")}
            >
              Low → High
            </button>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <div className="sel-info">
            <strong>{selected.size}</strong> item(s) selected
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn primary small" onClick={bulkAccept}>
              Accept selected
            </button>
            <button className="btn small" onClick={bulkReject}>
              Reject selected
            </button>
            <button className="btn ghost small" onClick={() => setSelected(new Set())}>
              Clear selection
            </button>
          </div>
        </div>
      )}

      {suggested.length ? (
        <>
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
                checked={allOnPageSelected}
                onChange={toggleSelectAllOnPage}
              />{" "}
              Select all on this page
            </label>
          </div>
          <div>
            {pageItems.map((link) => (
              <div className="suggest-item" key={link.id} data-link-id={link.id}>
                <input
                  type="checkbox"
                  className="suggest-select"
                  checked={selected.has(link.id)}
                  onChange={() => toggleSelect(link.id)}
                />
                <div className="cols">
                  {link.clauseKeys.map((k) => {
                    const c = clauseLabel(data, k);
                    if (!c) return null;
                    return (
                      <div className="col" key={k}>
                        <span className="lbl">{DOC_TYPE_LABEL[c.type]}</span>
                        {c.no || "—"} — {(c.desc || "").slice(0, 60)}
                      </div>
                    );
                  })}
                </div>
                <div className="score">
                  {Math.round((link.score || 0) * 100)}% match
                </div>
                <div className="acts">
                  <button
                    className="btn small"
                    onClick={() => reject(link.id)}
                  >
                    Reject
                  </button>
                  <button
                    className="btn small primary"
                    onClick={() => accept(link.id)}
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div
            className="rail-pagination"
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              background: "var(--surface)",
              padding: "10px 14px",
              marginTop: 4,
            }}
          >
            {suggested.length > SUGGEST_PAGE_SIZE ? (
              <>
                <button
                  disabled={current <= 1}
                  onClick={() => setPage(current - 1)}
                >
                  ← Prev
                </button>
                <span>
                  {startIdx + 1}–
                  {Math.min(startIdx + SUGGEST_PAGE_SIZE, suggested.length)} of{" "}
                  {suggested.length}
                </span>
                <button
                  disabled={current >= totalPages}
                  onClick={() => setPage(current + 1)}
                >
                  Next →
                </button>
              </>
            ) : (
              <span>
                {suggested.length} item{suggested.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h3>Nothing pending review</h3>
          <p>
            Run Auto-suggest in the Mapping tab, or check back after your next
            import.
          </p>
        </div>
      )}
    </section>
  );
}
