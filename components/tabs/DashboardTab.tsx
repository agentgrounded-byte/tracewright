"use client";

import { useMemo } from "react";
import { useApp } from "../AppContext";
import {
  allClausesFlat,
  CategoryRow,
  clausesByCategory,
  clauseStatus,
  docTypesPresent,
  gapItems,
  gapIsOpen,
  gapMetaFor,
} from "@/lib/derive";
import { daysUntil, fmtDate } from "@/lib/format";
import { DOC_TYPE_LABEL, DocType } from "@/lib/types";

const CATEGORY_SEGMENT_DEFS: { key: keyof CategoryRow["counts"]; label: string }[] = [
  { key: "mapped", label: "Mapped" },
  { key: "partial", label: "Partial" },
  { key: "suggested", label: "Suggested" },
  { key: "unmapped", label: "Unmapped" },
];
const CATEGORY_STAGGER = ["near", "mid", "far"];

function CategoryRowView({ cat }: { cat: CategoryRow }) {
  const t = cat.total;
  const pct = (n: number) => (t ? (n / t) * 100 : 0);

  let cum = 0;
  const present: { key: string; label: string; count: number; mid: number }[] = [];
  CATEGORY_SEGMENT_DEFS.forEach((seg) => {
    const segPct = pct(cat.counts[seg.key]);
    if (cat.counts[seg.key] > 0) {
      present.push({ key: seg.key, label: seg.label, count: cat.counts[seg.key], mid: cum + segPct / 2 });
    }
    cum += segPct;
  });

  return (
    <div className="cat-row">
      <div className="cat-label">
        <div className="cat-label-top">
          <span className="cat-name">{cat.label}</span>
          <span className="cat-count">{t}</span>
        </div>
        <div className="cat-desc">{cat.description}</div>
      </div>
      <div className="cat-track-wrap">
        <div className="cat-bar-wrap">
          <div
            className="cat-track"
            title={`Mapped ${cat.counts.mapped} · Partial ${cat.counts.partial} · Suggested ${cat.counts.suggested} · Unmapped ${cat.counts.unmapped}`}
          >
            <div className="cat-seg mapped" style={{ width: `${pct(cat.counts.mapped)}%` }} />
            <div className="cat-seg partial" style={{ width: `${pct(cat.counts.partial)}%` }} />
            <div className="cat-seg suggested" style={{ width: `${pct(cat.counts.suggested)}%` }} />
            <div className="cat-seg unmapped" style={{ width: `${pct(cat.counts.unmapped)}%` }} />
          </div>
          <div className="cat-callouts">
            {present.map((seg, i) => (
              <div
                key={seg.key}
                className={`cat-callout ${seg.key} ${CATEGORY_STAGGER[i % CATEGORY_STAGGER.length]}`}
                style={{ left: `${seg.mid}%` }}
              >
                <span className="callout-tick" />
                <span className="callout-label">
                  {seg.label} ({seg.count})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardTab() {
  const { data } = useApp();

  const stats = useMemo(() => {
    const items = gapItems(data);
    const openItems = items.filter((i) => gapIsOpen(gapMetaFor(data, i.key)));
    const flat = allClausesFlat(data);
    const total = flat.length;
    const mapped = flat.filter(
      (c) => clauseStatus(data, c.docId, c.clauseId) === "mapped"
    ).length;
    const overdue = openItems.filter((i) => {
      const d = daysUntil(gapMetaFor(data, i.key).targetDate);
      return d !== null && d < 0;
    }).length;
    const dueSoon = openItems.filter((i) => {
      const d = daysUntil(gapMetaFor(data, i.key).targetDate);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    const flagged = data.links.filter(
      (l) => l.status === "confirmed" && l.needsReview
    ).length;
    const dispositioned = items.filter((i) => {
      const m = gapMetaFor(data, i.key);
      return m.disposition && !m.resolved;
    }).length;

    const types = docTypesPresent(data);
    const pairs: [DocType, DocType][] = [];
    for (let i = 0; i < types.length; i++)
      for (let j = i + 1; j < types.length; j++) pairs.push([types[i], types[j]]);

    const coverage = pairs.map(([t1, t2]) => {
      const sel = flat.filter((c) => c.docType === t1 || c.docType === t2);
      const relevantTotal = sel.length;
      let m = 0,
        p = 0;
      sel.forEach((c) => {
        const st = clauseStatus(data, c.docId, c.clauseId);
        if (st === "mapped") m++;
        else if (st === "partial") p++;
      });
      return {
        t1,
        t2,
        pctMapped: relevantTotal ? (m / relevantTotal) * 100 : 0,
        pctPartial: relevantTotal ? (p / relevantTotal) * 100 : 0,
      };
    });

    const urgent = [...openItems]
      .sort((a, b) => {
        const da = daysUntil(gapMetaFor(data, a.key).targetDate);
        const db = daysUntil(gapMetaFor(data, b.key).targetDate);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      })
      .slice(0, 8);

    return {
      total,
      pctMapped: total ? Math.round((mapped / total) * 100) : 0,
      open: openItems.length,
      overdue,
      dueSoon,
      dispositioned,
      flagged,
      coverage,
      urgent,
      hasPairs: pairs.length > 0,
    };
  }, [data]);

  const catData = useMemo(() => clausesByCategory(data), [data]);
  const nonEmptyCategories = catData.categories.filter((c) => c.total > 0);

  return (
    <section>
      <div className="section-head">
        <h2>Dashboard</h2>
      </div>

      <div className="stat-grid">
        <div className="stat-card accent-blue">
          <div className="num">{stats.total}</div>
          <div className="lbl">Total clauses</div>
        </div>
        <div className="stat-card accent-green">
          <div className="num">{stats.pctMapped}%</div>
          <div className="lbl">Fully mapped</div>
        </div>
        <div className="stat-card accent-amber">
          <div className="num">{stats.open}</div>
          <div className="lbl">Open gaps</div>
        </div>
        <div className="stat-card accent-red">
          <div className="num">{stats.overdue}</div>
          <div className="lbl">Overdue</div>
        </div>
        <div className="stat-card accent-amber">
          <div className="num">{stats.dueSoon}</div>
          <div className="lbl">Due within 7d</div>
        </div>
        <div className="stat-card accent-blue">
          <div className="num">{stats.dispositioned}</div>
          <div className="lbl">Dispositioned</div>
        </div>
        <div className="stat-card accent-red">
          <div className="num">{stats.flagged}</div>
          <div className="lbl">Flagged for re-check</div>
        </div>
      </div>

      <div className="coverage-bar-wrap">
        <h3>Clauses by Category</h3>
        <div className="hint" style={{ margin: "0 0 10px" }}>
          {!catData.total
            ? "Add documents to see the category breakdown."
            : catData.detectedCount < 9
            ? `${catData.detectedCount} major section(s) identified from clause numbers in this project (fewer than 9 — the document may have fewer distinct sections); everything else falls under "Others".`
            : `The 9 largest major sections identified from clause numbers in this project, plus "Others" for smaller sections and clauses with no parseable section number.`}
        </div>
        {nonEmptyCategories.length ? (
          nonEmptyCategories.map((cat, i) => <CategoryRowView key={i} cat={cat} />)
        ) : (
          <div className="hint">No clauses to categorize yet.</div>
        )}
      </div>

      <div className="coverage-bar-wrap">
        <h3>Coverage by document pair</h3>
        {stats.hasPairs ? (
          stats.coverage.map((c, i) => (
            <div className="cov-row" key={i}>
              <div className="cov-label">
                {DOC_TYPE_LABEL[c.t1]} ↔ {DOC_TYPE_LABEL[c.t2]}
              </div>
              <div className="cov-track">
                <div
                  className="cov-fill-mapped"
                  style={{ width: `${c.pctMapped}%` }}
                />
                <div
                  className="cov-fill-partial"
                  style={{ width: `${c.pctPartial}%` }}
                />
              </div>
              <div className="cov-pct">{Math.round(c.pctMapped)}%</div>
            </div>
          ))
        ) : (
          <div className="hint">
            Add at least two document types to see coverage.
          </div>
        )}
      </div>

      <div className="gap-priority-list">
        <div className="gpl-head">Most urgent open gaps</div>
        {stats.urgent.length ? (
          stats.urgent.map((i) => {
            const meta = gapMetaFor(data, i.key);
            const d = daysUntil(meta.targetDate);
            const cls =
              d !== null && d < 0 ? "overdue" : d !== null && d <= 7 ? "soon" : "ontrack";
            return (
              <div className="gpl-row" key={i.key}>
                <div className="info">
                  <span className="ref">{i.refs[0]?.no || "—"}</span>
                  {(i.refs[0]?.desc || "").slice(0, 70)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="due">{meta.owner || "unassigned"}</span>
                  <span className={"badge " + cls}>
                    {meta.targetDate
                      ? fmtDate(new Date(meta.targetDate + "T00:00:00").getTime())
                      : "No target set"}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="gpl-row">
            <div className="hint">
              No open gaps with target dates — nice work.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
