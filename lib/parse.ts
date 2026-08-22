import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedRow {
  no: string;
  desc: string;
}

export function normalizeRows(
  rows: Record<string, unknown>[],
  fields: string[]
): ParsedRow[] {
  const noKey =
    fields.find((f) => /clause|ref|no\.?$|number|item/i.test(f)) || fields[0];
  const descKey =
    fields.find(
      (f) => f !== noKey && /desc|requirement|spec|text|detail|title/i.test(f)
    ) ||
    fields.find((f) => f !== noKey) ||
    fields[1];
  return rows
    .map((r) => ({
      no: String(r[noKey] ?? "").trim(),
      desc: String(r[descKey] ?? "").trim(),
    }))
    .filter((r) => r.no || r.desc);
}

export function parseClauseFile(file: File): Promise<ParsedRow[]> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (ext === "csv") {
      reader.onload = (ev) => {
        try {
          const parsed = Papa.parse(String(ev.target?.result ?? ""), {
            header: true,
            skipEmptyLines: true,
          });
          resolve(
            normalizeRows(
              parsed.data as Record<string, unknown>[],
              (parsed.meta.fields as string[]) || []
            )
          );
        } catch {
          reject(new Error("Could not read this CSV."));
        }
      };
      reader.onerror = () => reject(new Error("Could not read this file."));
      reader.readAsText(file);
    } else {
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), {
            type: "array",
          });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: "",
          });
          const fields = json.length ? Object.keys(json[0]) : [];
          resolve(normalizeRows(json, fields));
        } catch {
          reject(new Error("Could not read this file. Try a CSV export instead."));
        }
      };
      reader.onerror = () => reject(new Error("Could not read this file."));
      reader.readAsArrayBuffer(file);
    }
  });
}
