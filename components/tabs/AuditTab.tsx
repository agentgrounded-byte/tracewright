"use client";

import { useApp } from "../AppContext";
import { fmtDateTime } from "@/lib/format";

export default function AuditTab() {
  const { data } = useApp();
  const log = data.auditLog || [];

  return (
    <section>
      <div className="section-head">
        <h2>Audit Log</h2>
      </div>
      {log.length ? (
        <div>
          {log.map((entry, i) => (
            <div className="audit-row" key={i}>
              <div className="ts">{fmtDateTime(entry.ts)}</div>
              <div className="user">{entry.user}</div>
              <div className="detail">
                <strong>{entry.action}</strong> — {entry.detail || ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>No activity yet</h3>
          <p>Actions taken in this project will appear here.</p>
        </div>
      )}
    </section>
  );
}
