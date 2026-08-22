"use client";

import { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import Pagination from "../Pagination";
import * as api from "@/lib/api";
import {
  GENERIC_PAGE_SIZE,
  clauseLabel,
  linkSource,
  linkStatus,
} from "@/lib/derive";
import { afterPaint, flashHighlightEl } from "@/lib/format";
import { DocType, clauseKey } from "@/lib/types";

export default function RtmTab() {
  const {
    data,
    setData,
    audit,
    toast,
    confirmDialog,
    unmarkSessionConfirmed,
    jumpTarget,
    setJumpTarget,
  } = useApp();
  const [page, setPage] = useState(1);

  const confirmed = data.links.filter((l) => l.status === "confirmed");
  const totalPages = Math.max(1, Math.ceil(confirmed.length / GENERIC_PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), totalPages);
  const startIdx = (current - 1) * GENERIC_PAGE_SIZE;
  const pageItems = confirmed.slice(startIdx, startIdx + GENERIC_PAGE_SIZE);

  useEffect(() => {
    if (!jumpTarget) return;
    const key = clauseKey(jumpTarget.docId, jumpTarget.clauseId);
    const link = confirmed.find((l) => l.clauseKeys.includes(key));
    if (!link) {
      setJumpTarget(null);
      return;
    }
    const idx = confirmed.findIndex((l) => l.id === link.id);
    if (idx >= 0) setPage(Math.floor(idx / GENERIC_PAGE_SIZE) + 1);
    afterPaint(() => {
      const el = document.querySelector(`tr[data-link-id="${link.id}"]`);
      flashHighlightEl(el);
    });
    setJumpTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTarget]);

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

  async function markReviewed(linkId: string) {
    try {
      await api.clearLinkReview(linkId);
      setData((d) => ({
        ...d,
        links: d.links.map((l) =>
          l.id === linkId
            ? { ...l, needsReview: false, needsReviewReason: "" }
            : l
        ),
      }));
      await audit("Marked mapping as re-checked", linkId);
      toast("Marked as reviewed");
    } catch (e) {
      console.error(e);
      toast("Could not update this mapping");
    }
  }

  const cell = (
    arr: ReturnType<typeof clauseLabel>[]
  ) =>
    arr.length ? (
      arr.map((c, i) => (
        <div className="rtm-clause-block" key={i}>
          <span className="rtm-no">{c!.no || "—"}</span>
          {c!.archived && (
            <span className="badge unmapped" style={{ marginLeft: 4 }}>
              retired
            </span>
          )}
          {c!.tag === "informational" && (
            <span className="badge info" style={{ marginLeft: 4 }}>
              informational
            </span>
          )}
          <span className="rtm-desc">{c!.desc || ""}</span>
        </div>
      ))
    ) : (
      <span className="rtm-empty-cell">Not covered</span>
    );

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Confirmed RTM</h2>
          <div className="desc">
            Every confirmed mapping with full clause text. Read-only — items can
            only be removed, and removals are logged in the audit trail.
          </div>
        </div>
      </div>

      {confirmed.length ? (
        <>
        <div className="rtm-table-wrap">
          <table className="rtm-table">
            <thead>
              <tr>
                <th>Tender</th>
                <th>Requirement</th>
                <th>UAT</th>
                <th>Status</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((link) => {
                const byType: Record<DocType, ReturnType<typeof clauseLabel>[]> = {
                  tender: [],
                  requirement: [],
                  uat: [],
                };
                link.clauseKeys.forEach((k) => {
                  const c = clauseLabel(data, k);
                  if (c) byType[c.type].push(c);
                });
                const st = linkStatus(data, link);
                const source = linkSource(link);
                return (
                  <tr key={link.id} data-link-id={link.id}>
                    <td>{cell(byType.tender)}</td>
                    <td>{cell(byType.requirement)}</td>
                    <td>{cell(byType.uat)}</td>
                    <td>
                      <span className={"badge " + st}>{st}</span>
                      {link.needsReview && (
                        <div
                          className="badge soon"
                          style={{ marginTop: 5, display: "inline-block" }}
                          title={link.needsReviewReason || ""}
                        >
                          ⚠ needs re-check
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={"badge " + source.kind} title={source.title}>
                        {source.label}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 5,
                        }}
                      >
                        {link.needsReview && (
                          <button
                            className="btn small"
                            onClick={() => markReviewed(link.id)}
                          >
                            Mark reviewed
                          </button>
                        )}
                        <button
                          className="btn small ghost"
                          onClick={() => removeLink(link.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={current}
          totalPages={totalPages}
          totalItems={confirmed.length}
          pageSize={GENERIC_PAGE_SIZE}
          startIdx={startIdx}
          onPrev={() => setPage(current - 1)}
          onNext={() => setPage(current + 1)}
        />
        </>
      ) : (
        <div className="empty-state">
          <h3>No confirmed mappings yet</h3>
          <p>
            Link clauses manually or accept an auto-suggested match in the
            Mapping tab to populate the RTM.
          </p>
        </div>
      )}
    </section>
  );
}
