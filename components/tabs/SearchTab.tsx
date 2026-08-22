"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import Pagination from "../Pagination";
import {
  GENERIC_PAGE_SIZE,
  runSearch,
  SEARCH_STATUS_BADGE_CLASS,
  SEARCH_STATUS_LABEL,
  SearchResult,
} from "@/lib/derive";
import { DOC_TYPE_LABEL } from "@/lib/types";

export default function SearchTab({
  query,
  setQuery,
  onJump,
}: {
  query: string;
  setQuery: (q: string) => void;
  onJump: (r: SearchResult) => void;
}) {
  const { data } = useApp();
  const [page, setPage] = useState(1);

  const results = useMemo(() => runSearch(data, query), [data, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(results.length / GENERIC_PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), totalPages);
  const startIdx = (current - 1) * GENERIC_PAGE_SIZE;
  const pageItems = results.slice(startIdx, startIdx + GENERIC_PAGE_SIZE);

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Search</h2>
          <div className="desc">
            Search every clause in this project by number, text, or document
            name — see its mapping status and jump straight to it.
          </div>
        </div>
      </div>

      <input
        type="text"
        className="search-tab-input"
        placeholder="Search by clause number, text, or document name…"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!query.trim() ? (
        <div className="empty-state">
          <h3>Start typing to search</h3>
          <p>
            Search covers every clause in this project, including mapped,
            unmapped, suggested, informational, and retired ones.
          </p>
        </div>
      ) : results.length ? (
        <>
          <div>
            {pageItems.map((r) => (
              <div
                key={r.doc.id + "::" + r.clause.id}
                className="search-tab-row"
                onClick={() => onJump(r)}
              >
                <div className="txt">
                  <span
                    className={"doc-type-badge " + r.doc.type}
                    style={{ margin: "0 6px 0 0", verticalAlign: "middle" }}
                  >
                    {DOC_TYPE_LABEL[r.doc.type]}
                  </span>
                  <span className="no">{r.clause.no || "—"}</span>
                  <span className="desc">
                    {(r.clause.desc || "").slice(0, 160)}
                    {(r.clause.desc || "").length > 160 ? "…" : ""}
                  </span>
                  <div className="meta">{r.doc.name}</div>
                </div>
                <div className="statuscol">
                  <span className={"badge " + SEARCH_STATUS_BADGE_CLASS[r.status]}>
                    {SEARCH_STATUS_LABEL[r.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Pagination
            page={current}
            totalPages={totalPages}
            totalItems={results.length}
            pageSize={GENERIC_PAGE_SIZE}
            startIdx={startIdx}
            onPrev={() => setPage(current - 1)}
            onNext={() => setPage(current + 1)}
          />
        </>
      ) : (
        <div className="empty-state">
          <h3>No matches</h3>
          <p>Try a different clause number, keyword, or document name.</p>
        </div>
      )}
    </section>
  );
}
