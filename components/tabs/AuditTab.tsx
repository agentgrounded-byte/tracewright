"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import Pagination from "../Pagination";
import { GENERIC_PAGE_SIZE } from "@/lib/derive";
import { fmtDateTime } from "@/lib/format";

export default function AuditTab() {
  const { data } = useApp();
  const log = data.auditLog || [];
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(log.length / GENERIC_PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), totalPages);
  const startIdx = (current - 1) * GENERIC_PAGE_SIZE;
  const pageItems = log.slice(startIdx, startIdx + GENERIC_PAGE_SIZE);

  return (
    <section>
      <div className="section-head">
        <h2>Audit Log</h2>
      </div>
      {log.length ? (
        <>
          <div>
            {pageItems.map((entry, i) => (
              <div className="audit-row" key={startIdx + i}>
                <div className="ts">{fmtDateTime(entry.ts)}</div>
                <div className="user">{entry.user}</div>
                <div className="detail">
                  <strong>{entry.action}</strong> — {entry.detail || ""}
                </div>
              </div>
            ))}
          </div>
          <Pagination
            page={current}
            totalPages={totalPages}
            totalItems={log.length}
            pageSize={GENERIC_PAGE_SIZE}
            startIdx={startIdx}
            onPrev={() => setPage(current - 1)}
            onNext={() => setPage(current + 1)}
          />
        </>
      ) : (
        <div className="empty-state">
          <h3>No activity yet</h3>
          <p>Actions taken in this project will appear here.</p>
        </div>
      )}
    </section>
  );
}
