import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runSuggest, Candidate } from "@/lib/matching";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { projectId, userName } = (await request.json()) as {
    projectId?: string;
    userName?: string;
  };
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }
  const actor = userName || user.email || "Someone";

  const [projRes, docRes, linkRes] = await Promise.all([
    supabase
      .from("tw_projects")
      .select("auto_confirm_threshold")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("tw_documents")
      .select("id,type,tw_clauses(id,clause_no,description,tag,archived)")
      .eq("project_id", projectId),
    supabase
      .from("tw_links")
      .select("id,tw_link_clauses(clause_id)")
      .eq("project_id", projectId),
  ]);

  const docs = (docRes.data ?? []) as any[];
  const typesPresent = new Set(docs.map((d) => d.type));
  if (typesPresent.size < 2) {
    return NextResponse.json(
      { error: "Add at least two document types first" },
      { status: 400 }
    );
  }

  const linkedClauseIds = new Set<string>();
  (linkRes.data ?? []).forEach((l: any) =>
    (l.tw_link_clauses ?? []).forEach((lc: any) =>
      linkedClauseIds.add(lc.clause_id)
    )
  );

  const clauseDoc = new Map<string, { docId: string; type: string }>();
  const candidates: Candidate[] = [];
  docs.forEach((d) => {
    (d.tw_clauses ?? []).forEach((c: any) => {
      clauseDoc.set(c.id, { docId: d.id, type: d.type });
      if (c.archived) return;
      if (c.tag === "informational") return;
      if (linkedClauseIds.has(c.id)) return;
      candidates.push({
        key: c.id,
        docType: d.type,
        no: c.clause_no ?? "",
        desc: c.description ?? "",
      });
    });
  });

  if (candidates.length < 2) {
    return NextResponse.json(
      { error: "Not enough unmapped clauses to compare" },
      { status: 400 }
    );
  }

  const result = runSuggest(candidates);

  // Step 1: persist informational tags.
  if (result.informationalKeys.length) {
    await supabase
      .from("tw_clauses")
      .update({ tag: "informational" })
      .in("id", result.informationalKeys);

    const byId = new Map(candidates.map((c) => [c.key, c]));
    const noList =
      result.informationalKeys
        .slice(0, 10)
        .map((k) => byId.get(k)?.no || "?")
        .join(", ") + (result.informationalKeys.length > 10 ? "…" : "");
    await supabase.from("tw_audit_log").insert({
      project_id: projectId,
      user_name: actor,
      action: "Auto-detected informational clauses",
      detail: `${result.informationalKeys.length} clause(s) tagged (heuristic — no obligation language detected): ${noList}`,
    });
  }

  // Step 2: create links, auto-confirming anything at or above the threshold.
  const thresholdPct = projRes.data?.auto_confirm_threshold ?? 90;
  const threshold = thresholdPct / 100;
  let created = 0;
  let autoConfirmed = 0;

  for (const cluster of result.clusters) {
    const meets = cluster.score >= threshold;
    const { data: link, error } = await supabase
      .from("tw_links")
      .insert({
        project_id: projectId,
        status: meets ? "confirmed" : "suggested",
        score: cluster.score,
        created_by: meets ? "Auto-suggest (auto-confirmed)" : "Auto-suggest",
        confirmed_by: meets ? "Auto-suggest" : null,
        confirmed_at: meets ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error || !link) continue;
    await supabase
      .from("tw_link_clauses")
      .insert(cluster.keys.map((cid) => ({ link_id: link.id, clause_id: cid })));
    created++;
    if (meets) autoConfirmed++;
  }

  const pendingReview = created - autoConfirmed;
  if (created) {
    await supabase.from("tw_audit_log").insert({
      project_id: projectId,
      user_name: actor,
      action: "Ran auto-suggest mapping",
      detail: `${result.informationalKeys.length} informational clause(s) tagged, ${created} match(es) found — ${autoConfirmed} auto-confirmed at ≥${thresholdPct}%, ${pendingReview} pending review`,
    });
  }

  return NextResponse.json({
    informational: result.informationalKeys.length,
    created,
    autoConfirmed,
    pendingReview,
    compared: result.compared,
    thresholdPct,
  });
}
