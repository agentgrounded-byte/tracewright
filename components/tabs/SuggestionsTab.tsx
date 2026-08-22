"use client";

import { useMemo, useState } from "react";
import { useApp } from "../AppContext";
import * as api from "@/lib/api";
import { SUGGEST_PAGE_SIZE, clauseLabel } from "@/lib/derive";
import { DOC_TYPE_LABEL } from "@/lib/types";

export default function SuggestionsTab() {
  const { data, setData, me, audit, toast, markSessionConfirmed } = useApp();
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  const suggested = useMemo(() => {
    const list = data.links.filter((l) => l.status === "suggested");
    list.sort((a, b) =>
      sort === "asc"
        ? (a.score || 0) - (b.score || 0)
        : (b.score || 0) - (a.score || 0)
    );
    return list;
  }, [data.links, sort]);

  const totalPages = Math.max(1, Math.ceil(suggested.length / SUGGEST_PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), totalPages);
  const startIdx = (current - 1) * SUGGEST_PAGE_SIZE;
  const pageItems = suggested.slice(startIdx, startIdx + SUGGEST_PAGE_SIZE);

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

      {suggested.length ? (
        <>
          <div>
            {pageItems.map((link) => (
              <div className="suggest-item" key={link.id}>
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
