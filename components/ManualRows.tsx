"use client";

export interface EditRow {
  key: string;
  id?: string; // existing clause id
  no: string;
  desc: string;
  tag: string;
}

export function newRow(no = "", desc = "", tag = "", id?: string): EditRow {
  return {
    key: Math.random().toString(36).slice(2),
    id,
    no,
    desc,
    tag,
  };
}

export default function ManualRows({
  rows,
  setRows,
  showTag = true,
}: {
  rows: EditRow[];
  setRows: (r: EditRow[]) => void;
  showTag?: boolean;
}) {
  const patch = (key: string, p: Partial<EditRow>) =>
    setRows(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));

  return (
    <div className="manual-rows">
      {rows.map((r) => (
        <div className="manual-row" key={r.key}>
          <input
            className="no"
            placeholder="Clause no."
            value={r.no}
            onChange={(e) => patch(r.key, { no: e.target.value })}
          />
          <input
            className="desc"
            placeholder="Description"
            value={r.desc}
            onChange={(e) => patch(r.key, { desc: e.target.value })}
          />
          {showTag && (
            <select
              className="tag"
              title="Classification"
              value={r.tag}
              onChange={(e) => patch(r.key, { tag: e.target.value })}
            >
              <option value="">Needs mapping</option>
              <option value="informational">
                Informational (no mapping needed)
              </option>
            </select>
          )}
          <button
            className="rm"
            title="Remove row"
            onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
          >
            ×
          </button>
        </div>
      ))}
      {!rows.length && (
        <div className="hint" style={{ padding: "10px 12px" }}>
          No rows yet — click “+ Add row”.
        </div>
      )}
    </div>
  );
}
