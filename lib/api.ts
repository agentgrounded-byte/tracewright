import { createClient } from "./supabase/client";
import {
  AuditEntry,
  Clause,
  DocType,
  GapMeta,
  Link,
  ProjectData,
  ProjectSummary,
  TWDocument,
  emptyProjectData,
} from "./types";

const sb = () => createClient();

const ts = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0);

/* ------------------------------- profile ------------------------------- */

export async function getMe() {
  const supabase = sb();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("tw_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: data?.display_name || "",
  };
}

export async function saveDisplayName(userId: string, name: string) {
  await sb()
    .from("tw_profiles")
    .upsert({ user_id: userId, display_name: name }, { onConflict: "user_id" });
}

/* ------------------------------- projects ------------------------------ */

export async function listProjects(): Promise<ProjectSummary[]> {
  const { data, error } = await sb()
    .from("tw_projects")
    .select("id,name,created_at,created_by_name,auto_confirm_threshold")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: ts(p.created_at),
    createdBy: p.created_by_name ?? "",
    autoConfirmThreshold: p.auto_confirm_threshold ?? 90,
  }));
}

export async function createProject(name: string, userId: string, userName: string) {
  const { data, error } = await sb()
    .from("tw_projects")
    .insert({ name, created_by: userId, created_by_name: userName })
    .select("id,name,created_at,created_by_name,auto_confirm_threshold")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    createdAt: ts(data.created_at),
    createdBy: data.created_by_name ?? "",
    autoConfirmThreshold: data.auto_confirm_threshold ?? 90,
  } as ProjectSummary;
}

export async function saveThreshold(projectId: string, value: number) {
  const { error } = await sb()
    .from("tw_projects")
    .update({ auto_confirm_threshold: value })
    .eq("id", projectId);
  if (error) throw error;
}

/* ---------------------------- load a project --------------------------- */

export async function loadProjectData(projectId: string): Promise<ProjectData> {
  const supabase = sb();
  const data = emptyProjectData();

  const [projRes, docRes, linkRes, gapRes, auditRes] = await Promise.all([
    supabase
      .from("tw_projects")
      .select("auto_confirm_threshold")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("tw_documents")
      .select(
        "id,type,name,version,created_by_name,created_at," +
          "tw_clauses(id,clause_no,description,tag,archived,position)," +
          "tw_doc_versions(version,uploaded_by,uploaded_at,added,removed,changed,unchanged)"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tw_links")
      .select(
        "id,status,score,created_by,created_at,confirmed_by,confirmed_at," +
          "needs_review,needs_review_reason,tw_link_clauses(clause_id)"
      )
      .eq("project_id", projectId),
    supabase.from("tw_gap_meta").select("*").eq("project_id", projectId),
    supabase
      .from("tw_audit_log")
      .select("ts,user_name,action,detail")
      .eq("project_id", projectId)
      .order("ts", { ascending: false })
      .limit(500),
  ]);

  data.settings.autoConfirmThreshold =
    projRes.data?.auto_confirm_threshold ?? 90;

  const docIdByClause = new Map<string, string>();

  data.documents = (docRes.data ?? []).map((d: any) => {
    const clauses: Clause[] = (d.tw_clauses ?? [])
      .slice()
      .sort((a: any, b: any) => a.position - b.position)
      .map((c: any) => {
        docIdByClause.set(c.id, d.id);
        return {
          id: c.id,
          no: c.clause_no ?? "",
          desc: c.description ?? "",
          tag: c.tag ?? "",
          archived: !!c.archived,
          position: c.position ?? 0,
        };
      });
    return {
      id: d.id,
      type: d.type as DocType,
      name: d.name,
      version: d.version ?? 1,
      createdBy: d.created_by_name ?? "",
      createdAt: ts(d.created_at),
      clauses,
      versionHistory: (d.tw_doc_versions ?? [])
        .slice()
        .sort((a: any, b: any) => a.version - b.version)
        .map((v: any) => ({
          version: v.version,
          uploadedBy: v.uploaded_by ?? "",
          uploadedAt: ts(v.uploaded_at),
          added: v.added,
          removed: v.removed,
          changed: v.changed,
          unchanged: v.unchanged,
        })),
    } as TWDocument;
  });

  data.links = (linkRes.data ?? []).map((l: any) => ({
    id: l.id,
    clauseKeys: (l.tw_link_clauses ?? [])
      .map((lc: any) => {
        const docId = docIdByClause.get(lc.clause_id);
        return docId ? `${docId}::${lc.clause_id}` : null;
      })
      .filter(Boolean) as string[],
    status: l.status,
    score: l.score === null ? null : Number(l.score),
    createdBy: l.created_by ?? "",
    createdAt: ts(l.created_at),
    confirmedBy: l.confirmed_by,
    confirmedAt: l.confirmed_at ? ts(l.confirmed_at) : null,
    needsReview: !!l.needs_review,
    needsReviewReason: l.needs_review_reason ?? "",
  })) as Link[];

  (gapRes.data ?? []).forEach((g: any) => {
    data.gapMeta[g.gap_key] = {
      owner: g.owner ?? "",
      targetDate: g.target_date ?? "",
      notes: g.notes ?? "",
      resolved: !!g.resolved,
      disposition: g.disposition ?? "",
    };
  });

  data.auditLog = (auditRes.data ?? []).map((a: any) => ({
    ts: ts(a.ts),
    user: a.user_name ?? "",
    action: a.action,
    detail: a.detail ?? "",
  })) as AuditEntry[];

  return data;
}

/* -------------------------------- audit -------------------------------- */

export async function writeAudit(
  projectId: string,
  userName: string,
  action: string,
  detail: string
): Promise<AuditEntry> {
  const entry = { ts: Date.now(), user: userName, action, detail };
  await sb()
    .from("tw_audit_log")
    .insert({ project_id: projectId, user_name: userName, action, detail });
  return entry;
}

/* ------------------------------ documents ------------------------------ */

export async function insertDocument(
  projectId: string,
  type: DocType,
  name: string,
  userName: string,
  rows: { no: string; desc: string; tag?: string }[]
): Promise<TWDocument> {
  const supabase = sb();
  const { data: doc, error } = await supabase
    .from("tw_documents")
    .insert({ project_id: projectId, type, name, created_by_name: userName })
    .select("id,type,name,version,created_by_name,created_at")
    .single();
  if (error) throw error;

  const payload = rows.map((r, i) => ({
    document_id: doc.id,
    clause_no: r.no,
    description: r.desc,
    tag: r.tag ?? "",
    position: i,
  }));
  const { data: clauses, error: cErr } = await supabase
    .from("tw_clauses")
    .insert(payload)
    .select("id,clause_no,description,tag,archived,position");
  if (cErr) throw cErr;

  return {
    id: doc.id,
    type: doc.type as DocType,
    name: doc.name,
    version: doc.version ?? 1,
    createdBy: doc.created_by_name ?? "",
    createdAt: ts(doc.created_at),
    clauses: (clauses ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        no: c.clause_no ?? "",
        desc: c.description ?? "",
        tag: c.tag ?? "",
        archived: !!c.archived,
        position: c.position ?? 0,
      })),
    versionHistory: [],
  };
}

export async function deleteDocument(docId: string) {
  const { error } = await sb().from("tw_documents").delete().eq("id", docId);
  if (error) throw error;
}

export async function updateClause(
  clauseId: string,
  patch: Partial<{ no: string; desc: string; tag: string; archived: boolean; position: number }>
) {
  const body: Record<string, unknown> = {};
  if (patch.no !== undefined) body.clause_no = patch.no;
  if (patch.desc !== undefined) body.description = patch.desc;
  if (patch.tag !== undefined) body.tag = patch.tag;
  if (patch.archived !== undefined) body.archived = patch.archived;
  if (patch.position !== undefined) body.position = patch.position;
  const { error } = await sb().from("tw_clauses").update(body).eq("id", clauseId);
  if (error) throw error;
}

export async function tagClausesInformational(clauseIds: string[]) {
  if (!clauseIds.length) return;
  const { error } = await sb()
    .from("tw_clauses")
    .update({ tag: "informational" })
    .in("id", clauseIds);
  if (error) throw error;
}

export async function insertClauses(
  documentId: string,
  rows: { no: string; desc: string; position: number }[]
): Promise<Clause[]> {
  if (!rows.length) return [];
  const { data, error } = await sb()
    .from("tw_clauses")
    .insert(
      rows.map((r) => ({
        document_id: documentId,
        clause_no: r.no,
        description: r.desc,
        position: r.position,
      }))
    )
    .select("id,clause_no,description,tag,archived,position");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    no: c.clause_no ?? "",
    desc: c.description ?? "",
    tag: c.tag ?? "",
    archived: !!c.archived,
    position: c.position ?? 0,
  }));
}

export async function deleteClauses(ids: string[]) {
  if (!ids.length) return;
  const { error } = await sb().from("tw_clauses").delete().in("id", ids);
  if (error) throw error;
}

export async function bumpDocumentVersion(
  documentId: string,
  version: number,
  stats: { uploadedBy: string; added: number; removed: number; changed: number; unchanged: number }
) {
  const supabase = sb();
  await supabase.from("tw_documents").update({ version }).eq("id", documentId);
  await supabase.from("tw_doc_versions").insert({
    document_id: documentId,
    version,
    uploaded_by: stats.uploadedBy,
    added: stats.added,
    removed: stats.removed,
    changed: stats.changed,
    unchanged: stats.unchanged,
  });
}

/* -------------------------------- links -------------------------------- */

export async function insertLink(
  projectId: string,
  clauseIds: string[],
  fields: {
    status: "confirmed" | "suggested";
    score?: number | null;
    createdBy: string;
    confirmedBy?: string | null;
  }
): Promise<{ id: string; createdAt: number; confirmedAt: number | null }> {
  const supabase = sb();
  const confirmedAt =
    fields.status === "confirmed" ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("tw_links")
    .insert({
      project_id: projectId,
      status: fields.status,
      score: fields.score ?? null,
      created_by: fields.createdBy,
      confirmed_by: fields.confirmedBy ?? null,
      confirmed_at: confirmedAt,
    })
    .select("id,created_at,confirmed_at")
    .single();
  if (error) throw error;

  const { error: jErr } = await supabase
    .from("tw_link_clauses")
    .insert(clauseIds.map((cid) => ({ link_id: data.id, clause_id: cid })));
  if (jErr) throw jErr;

  return {
    id: data.id,
    createdAt: ts(data.created_at),
    confirmedAt: data.confirmed_at ? ts(data.confirmed_at) : null,
  };
}

export async function confirmLink(linkId: string, userName: string) {
  const { error } = await sb()
    .from("tw_links")
    .update({
      status: "confirmed",
      confirmed_by: userName,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", linkId);
  if (error) throw error;
}

export async function removeLink(linkId: string) {
  const { error } = await sb().from("tw_links").delete().eq("id", linkId);
  if (error) throw error;
}

export async function flagLinksForReview(linkIds: string[], reason: string) {
  if (!linkIds.length) return;
  const { error } = await sb()
    .from("tw_links")
    .update({ needs_review: true, needs_review_reason: reason })
    .in("id", linkIds);
  if (error) throw error;
}

export async function clearLinkReview(linkId: string) {
  const { error } = await sb()
    .from("tw_links")
    .update({ needs_review: false, needs_review_reason: "" })
    .eq("id", linkId);
  if (error) throw error;
}

/* ------------------------------- gap meta ------------------------------ */

export async function upsertGapMeta(
  projectId: string,
  gapKey: string,
  meta: GapMeta
) {
  const { error } = await sb().from("tw_gap_meta").upsert(
    {
      project_id: projectId,
      gap_key: gapKey,
      owner: meta.owner,
      target_date: meta.targetDate || null,
      notes: meta.notes,
      resolved: meta.resolved,
      disposition: meta.disposition,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,gap_key" }
  );
  if (error) throw error;
}
