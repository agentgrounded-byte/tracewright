"use client";

// Shared "← Prev / X–Y of N / Next →" pagination widget, matching the pattern
// already used by the Mapping tab's rails and the Suggestions tab. Renders
// nothing when there's nothing to page through.
export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  startIdx,
  onPrev,
  onNext,
  className = "std-pagination",
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startIdx: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  if (!totalItems) return null;

  if (totalItems <= pageSize) {
    return (
      <div className={className}>
        <span>
          {totalItems} item{totalItems === 1 ? "" : "s"}
        </span>
      </div>
    );
  }

  const from = startIdx + 1;
  const to = Math.min(startIdx + pageSize, totalItems);

  return (
    <div className={className}>
      <button disabled={page <= 1} onClick={onPrev}>
        ← Prev
      </button>
      <span>
        {from}–{to} of {totalItems}
      </span>
      <button disabled={page >= totalPages} onClick={onNext}>
        Next →
      </button>
    </div>
  );
}
