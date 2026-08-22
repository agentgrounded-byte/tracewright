"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../AppContext";
import Pagination from "../Pagination";
import * as api from "@/lib/api";
import {
  GENERIC_PAGE_SIZE,
  RAIL_PAGE_SIZE,
  clauseLabel,
  clauseStatus,
  docTypesPresent,
  linkStatus,
} from "@/lib/derive";
import { afterPaint, flashHighlightEl } from "@/lib/format";
import {
  DOC_TYPE_LABEL,
  DOC_TYPE_ORDER,
  DocType,
  clauseKey,
} from "@/lib/types";

type RailFilter = "unmapped" | "partial" | "mapped" | "all";

export default function MappingTab({
  pendingSuggestions,
  setPendingSuggestions,
  goToSuggestions,
}: {
  pendingSuggestions: number;
  setPendingSuggestions: (n: number) => void;
  goToSuggestions: () => void;
}) {
  const {
    data,
    setData,
    projectId,
    me,
    audit,
    toast,
    reload,
    sessionConfirmed,
    markSessionConfirmed,
    unmarkSessionConfirmed,
    confirmDialog,
    jumpTarget,
    setJumpTarget,
  } = useApp();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [railFilter, setRailFilter] = useState<RailFilter>("unmapped");
  const [search, setSearch] = useState<Record<string, string>>({});
  const [page, setPage] = useState<Record<string, number>>({
    tender: 1,
    requirement: 1,
    uat: 1,
  });
  const [running, setRunning] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [sessionPage, setSessionPage] = useState(1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const types = useMemo(() => docTypesPresent(data), [data]);
  const ordered = useMemo(
    () => DOC_TYPE_ORDER.filter((t) => types.includes(t)),
    [types]
  );

  const railClauses = useMemo(() => {
    const map: Record<string, { docId: string; clauseId: string; no: string; desc: string }[]> = {};
    ordered.forEach((type) => {
      const list: { docId: string; clauseId: string; no: string; desc: string }[] = [];
      data.documents
        .filter((d) => d.type === type)
        .forEach((doc) =>
          doc.clauses
            .filter((c) => !c.archived && c.tag !== "informational")
            .forEach((c) =>
              list.push({
                docId: doc.id,
                clauseId: c.id,
                no: c.no,
                desc: c.desc,
              })
            )
        );
      map[type] = list;
    });
    return map;
  }, [data, ordered]);

  const filtered = useMemo(() => {
    const out: Record<string, typeof railClauses[string]> = {};
    ordered.forEach((type) => {
      const ft = (search[type] || "").trim().toLowerCase();
      out[type] = (railClauses[type] || []).filter((c) => {
        const st = clauseStatus(data, c.docId, c.clauseId);
        if (railFilter === "unmapped" && st !== "unmapped") return false;
        if (railFilter === "partial" && st !== "partial" && st !== "suggested")
          return false;
        if (railFilter === "mapped" && st !== "mapped") return false;
        if (
          ft &&
          !c.no.toLowerCase().includes(ft) &&
          !c.desc.toLowerCase().includes(ft)
        )
          return false;
        return true;
      });
    });
    return out;
  }, [railClauses, ordered, railFilter, search, data]);

  /* ------------------------- jump-to from search ------------------------- */
  useEffect(() => {
    if (!jumpTarget) return;
    const doc = data.documents.find((d) => d.id === jumpTarget.docId);
    const clause = doc?.clauses.find((c) => c.id === jumpTarget.clauseId);
    if (!doc || !clause) {
      setJumpTarget(null);
      return;
    }
    setRailFilter("all");
    setPage({ tender: 1, requirement: 1, uat: 1 });
    setSearch((s) => ({ ...s, [doc.type]: clause.no || "" }));
    const key = clauseKey(doc.id, clause.id);
    afterPaint(() => {
      const chip = document.querySelector(`.chip[data-key="${CSS.escape(key)}"]`);
      flashHighlightEl(chip);
    });
    setJumpTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTarget]);

  /* --------------------------- connector lines --------------------------- */
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    svg.setAttribute("width", String(wrapRect.width));
    svg.setAttribute("height", String(wrapRect.height));
    svg.innerHTML = "";

    const chipPos: Record<string, { x: number; y: number; w: number }> = {};
    wrap.querySelectorAll<HTMLElement>(".chip").forEach((chip) => {
      const r = chip.getBoundingClientRect();
      chipPos[chip.dataset.key!] = {
        x: r.left - wrapRect.left,
        y: r.top - wrapRect.top + r.height / 2,
        w: r.width,
      };
    });

    const colorFor = (status: string) =>
      status === "mapped"
        ? "#4F7A5B"
        : status === "partial" || status === "suggested"
        ? "#B8752A"
        : "#A6432F";

    data.links.forEach((link) => {
      const status = linkStatus(data, link);
      const pts = link.clauseKeys.map((k) => chipPos[k]).filter(Boolean);
      if (pts.length < 2) return;
      pts.sort((a, b) => a.x - b.x);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const x1 = a.x + a.w;
        const y1 = a.y;
        const x2 = b.x;
        const y2 = b.y;
        const midX = (x1 + x2) / 2;
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        path.setAttribute(
          "d",
          `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
        );
        path.setAttribute("stroke", colorFor(status));
        path.setAttribute("stroke-width", "1.75");
        path.setAttribute("fill", "none");
        path.setAttribute("opacity", "0.55");
        if (status === "suggested") path.setAttribute("stroke-dasharray", "4,3");
        svg.appendChild(path);
      }
    });
  }, [data, filtered, page, selected]);

  /* ------------------------------- actions ------------------------------- */
  const selTypes = useMemo(() => {
    const s = new Set<DocType>();
    selected.forEach((k) => {
      const doc = data.documents.find((d) => d.id === k.split("::")[0]);
      if (doc) s.add(doc.type);
    });
    return s;
  }, [selected, data.documents]);

  async function linkSelected() {
    if (selected.size < 2 || !projectId) return;
    const keys = Array.from(selected);
    try {
      const created = await api.insertLink(
        projectId,
        keys.map((k) => k.split("::")[1]),
        { status: "confirmed", createdBy: me.displayName, confirmedBy: me.displayName }
      );
      markSessionConfirmed(created.id);
      setData((d) => ({
        ...d,
        links: [
          ...d.links,
          {
            id: created.id,
            clauseKeys: keys,
            status: "confirmed",
            score: null,
            createdBy: me.displayName,
            createdAt: created.createdAt,
            confirmedBy: me.displayName,
            confirmedAt: created.confirmedAt,
            needsReview: false,
            needsReviewReason: "",
          },
        ],
      }));
      setSelected(new Set());
      await audit("Linked clauses manually", keys.length + " clause(s) linked");
      toast("Clauses linked");
    } catch (e) {
      console.error(e);
      toast("Could not link clauses");
    }
  }

  async function removeLink(linkId: string) {
    const ok = await confirmDialog(
      "Remove this link? Clauses will return to unmapped.",
      "Remove link"
    );
    if (!ok) return;
    try {
      await api.removeLink(linkId);
      unmarkSessionConfirmed(linkId);
      setData((d) => ({ ...d, links: d.links.filter((l) => l.id !== linkId) }));
      await audit("Removed confirmed link", linkId);
    } catch (e) {
      console.error(e);
      toast("Could not remove link");
    }
  }

  async function runAutoSuggest() {
    if (!projectId) return;
    if (types.length < 2) {
      toast("Add at least two document types first");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/auto-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, userName: me.displayName }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Auto-suggest failed");
        return;
      }
      await reload();
      setPendingSuggestions(json.pendingReview);
      setBannerDismissed(false);
      const infoPrefix = json.informational
        ? `${json.informational} informational, `
        : "";
      if (json.created === 0) {
        toast(
          json.informational
            ? `${json.informational} informational clause(s) tagged — no confident mapping matches found`
            : "No confident matches found — try mapping manually"
        );
      } else {
        toast(
          `${infoPrefix}${json.autoConfirmed} auto-confirmed, ${json.pendingReview} pending review`
        );
      }
    } catch (e) {
      console.error(e);
      toast("Auto-suggest failed");
    } finally {
      setRunning(false);
    }
  }

  const sessionLinks = data.links.filter(
    (l) => l.status === "confirmed" && sessionConfirmed.has(l.id)
  );
  const sessionTotalPages = Math.max(
    1,
    Math.ceil(sessionLinks.length / GENERIC_PAGE_SIZE)
  );
  const sessionCurrent = Math.min(Math.max(sessionPage, 1), sessionTotalPages);
  const sessionStartIdx = (sessionCurrent - 1) * GENERIC_PAGE_SIZE;
  const sessionPageItems = sessionLinks.slice(
    sessionStartIdx,
    sessionStartIdx + GENERIC_PAGE_SIZE
  );

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Mapping</h2>
          <div className="desc">
            Select clauses across rails and link them, or run auto-suggest for a
            baseline.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={runAutoSuggest} disabled={running}>
            {running ? "Running…" : "⚡ Auto-suggest mapping"}
          </button>
        </div>
      </div>

      {pendingSuggestions > 0 && !bannerDismissed && (
        <div className="suggest-banner">
          <div className="txt">
            Generated <strong>{pendingSuggestions}</strong> suggested link(s)
            pending review.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn small primary" onClick={goToSuggestions}>
              Review now →
            </button>
            <button
              className="btn small ghost"
              onClick={() => setBannerDismissed(true)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="mapping-toolbar">
        <div className="left">
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            Rail filter:
          </span>
          <div className="seg" style={{ width: 360 }}>
            {(["unmapped", "partial", "mapped", "all"] as RailFilter[]).map(
              (f) => (
                <button
                  key={f}
                  className={railFilter === f ? "active" : ""}
                  onClick={() => {
                    setRailFilter(f);
                    setPage({ tender: 1, requirement: 1, uat: 1 });
                  }}
                >
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {types.length < 2 ? (
        <div className="empty-state">
          <h3>Add documents first</h3>
          <p>
            Upload or key in clauses for at least two document types before
            mapping.
          </p>
        </div>
      ) : (
        <>
          <div className="rails-wrap" ref={wrapRef}>
            <svg className="connector-svg" ref={svgRef} />
            <div
              className="rails"
              style={{
                gridTemplateColumns: ordered.map(() => "1fr").join(" "),
              }}
            >
              {ordered.map((type) => {
                const matches = filtered[type] || [];
                const totalPages = Math.max(
                  1,
                  Math.ceil(matches.length / RAIL_PAGE_SIZE)
                );
                const current = Math.min(
                  Math.max(page[type] || 1, 1),
                  totalPages
                );
                const startIdx = (current - 1) * RAIL_PAGE_SIZE;
                const pageItems = matches.slice(
                  startIdx,
                  startIdx + RAIL_PAGE_SIZE
                );
                return (
                  <div className="rail" key={type}>
                    <div className="rail-head">
                      <span className="name">{DOC_TYPE_LABEL[type]}</span>
                      <span className="n">
                        {(railClauses[type] || []).length}
                      </span>
                    </div>
                    <div className="rail-search">
                      <input
                        placeholder="Find by clause no…"
                        value={search[type] || ""}
                        onChange={(e) => {
                          setSearch((s) => ({ ...s, [type]: e.target.value }));
                          setPage((p) => ({ ...p, [type]: 1 }));
                        }}
                      />
                    </div>
                    <div className="rail-body">
                      {pageItems.map((c) => {
                        const st = clauseStatus(data, c.docId, c.clauseId);
                        const key = clauseKey(c.docId, c.clauseId);
                        return (
                          <div
                            key={key}
                            data-key={key}
                            className={
                              "chip " + st + (selected.has(key) ? " selected" : "")
                            }
                            onClick={() =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              })
                            }
                          >
                            <span className="stat-dot">{st}</span>
                            <span className="no">{c.no || "—"}</span>
                            <span className="desc">
                              {(c.desc || "").slice(0, 90)}
                              {(c.desc || "").length > 90 ? "…" : ""}
                            </span>
                          </div>
                        );
                      })}
                      {!pageItems.length && (
                        <div className="hint" style={{ padding: "10px 4px" }}>
                          Nothing to show.
                        </div>
                      )}
                    </div>
                    <div className="rail-pagination">
                      {matches.length > RAIL_PAGE_SIZE ? (
                        <>
                          <button
                            disabled={current <= 1}
                            onClick={() =>
                              setPage((p) => ({ ...p, [type]: current - 1 }))
                            }
                          >
                            ← Prev
                          </button>
                          <span>
                            {startIdx + 1}–
                            {Math.min(startIdx + RAIL_PAGE_SIZE, matches.length)}{" "}
                            of {matches.length}
                          </span>
                          <button
                            disabled={current >= totalPages}
                            onClick={() =>
                              setPage((p) => ({ ...p, [type]: current + 1 }))
                            }
                          >
                            Next →
                          </button>
                        </>
                      ) : matches.length ? (
                        <span>
                          {matches.length} item{matches.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="link-bar">
            <div className="sel-info">
              <strong>{selected.size}</strong> clause(s) selected across{" "}
              <strong>{selTypes.size}</strong> document type(s)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn ghost small"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
              <button
                className="btn primary small"
                disabled={selected.size < 2}
                onClick={linkSelected}
              >
                Link selected →
              </button>
            </div>
          </div>
        </>
      )}

      <div className="confirmed-list">
        <div className="section-head">
          <div>
            <h2 style={{ fontSize: 15 }}>Confirmed links (this session)</h2>
            <div className="desc">
              Only links confirmed since you opened this tab. See the “Confirmed
              RTM” tab for the full history.
            </div>
          </div>
        </div>
        <table className="links-table">
          <thead>
            <tr>
              <th>Tender</th>
              <th>Requirement</th>
              <th>UAT</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessionPageItems.map((link) => {
              const byType: Record<DocType, string[]> = {
                tender: [],
                requirement: [],
                uat: [],
              };
              link.clauseKeys.forEach((k) => {
                const c = clauseLabel(data, k);
                if (c) byType[c.type].push(c.no || "—");
              });
              const st = linkStatus(data, link);
              return (
                <tr key={link.id}>
                  <td>
                    {byType.tender.join(", ") || <span className="hint">—</span>}
                  </td>
                  <td>
                    {byType.requirement.join(", ") || (
                      <span className="hint">—</span>
                    )}
                  </td>
                  <td>
                    {byType.uat.join(", ") || <span className="hint">—</span>}
                  </td>
                  <td>
                    <span className={"badge " + st}>{st}</span>
                  </td>
                  <td>
                    <button
                      className="btn small ghost"
                      onClick={() => removeLink(link.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!sessionLinks.length && (
          <div className="hint" style={{ padding: "12px 0" }}>
            No links confirmed in this session yet.
          </div>
        )}
        <Pagination
          page={sessionCurrent}
          totalPages={sessionTotalPages}
          totalItems={sessionLinks.length}
          pageSize={GENERIC_PAGE_SIZE}
          startIdx={sessionStartIdx}
          onPrev={() => setSessionPage(sessionCurrent - 1)}
          onNext={() => setSessionPage(sessionCurrent + 1)}
        />
      </div>
    </section>
  );
}
