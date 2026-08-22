export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export function isoDateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function normClauseNo(no: string) {
  return String(no || "").trim().toLowerCase();
}

/** Scrolls an element into view and briefly flashes it — used to draw the eye
 * to a row after navigating there from a search result. */
export function flashHighlightEl(el: Element | null) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("search-highlight");
  setTimeout(() => el.classList.remove("search-highlight"), 1800);
}

/** Runs `fn` after the browser has painted the next frame (twice, to be safe
 * against a state update that hasn't committed to the DOM yet). Use this to
 * scroll to / query for an element right after a setState that changes what's
 * rendered (e.g. jumping to a page containing a search result). */
export function afterPaint(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}
