import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

function isoDateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const ago = (days: number, hours = 0) =>
  new Date(
    Date.now() - Math.round(days * 86400000) - Math.round(hours * 3600000)
  ).toISOString();

interface Row {
  no: string;
  desc: string;
  tag?: string;
}
const mk = (no: string, desc: string, tag?: string): Row => ({ no, desc, tag });

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase
    .from("tw_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const actor = profile?.display_name || user.email || "Someone";

  const tenderClauses: Row[] = [
    mk("TS-1.1", "Wireless access points shall support the Wi-Fi 6 (802.11ax) standard."),
    mk("TS-1.2", "Solution shall provide centralized cloud-based network management."),
    mk("TS-1.3", "Vendor shall provide 24x7 technical support for a period of three years."),
    mk("TS-2.1", "Access points shall support Power over Ethernet (PoE+)."),
    mk("TS-2.2", "System shall support a minimum of 500 concurrent client connections per floor."),
    mk("TS-3.1", "Vendor shall conduct on-site installation and configuration training for IT staff."),
    mk("TS-4.1", "Solution shall integrate with the existing RADIUS authentication server."),
    mk("TS-0.1", "This section provides background context on the existing network environment and does not impose a specific technical requirement.", "informational"),
    mk("TS-4.2", "Vendor shall provide bespoke integration with the legacy SNMPv1 monitoring platform."),
  ];
  const tenderDemoNAIdx = tenderClauses.length - 1;

  const reqClauses: Row[] = [
    mk("REQ-01", "The wireless network must comply with the 802.11ax (Wi-Fi 6) standard."),
    mk("REQ-02", "A centralized dashboard shall allow administrators to manage all access points from the cloud."),
    mk("REQ-03", "Access points must be powered via PoE+ without additional power supplies."),
    mk("REQ-04", "The system shall support at least 500 simultaneous device connections per floor."),
    mk("REQ-05", "The wireless system shall authenticate users against the existing RADIUS server."),
    mk("REQ-06", "The system shall log all access point configuration changes for audit purposes."),
    mk("REQ-00", "This document defines the functional requirements for the wireless network upgrade."),
    mk("REQ-0.1", "This section defines terminology and acronyms used throughout the requirements register.", "informational"),
  ];

  const uatClauses: Row[] = [
    mk("UAT-01", "Verify an access point negotiates Wi-Fi 6 (802.11ax) data rates with a compatible client device."),
    mk("UAT-02", "Verify an administrator can view and manage all access points from a single cloud dashboard."),
    mk("UAT-03", "Verify an access point powers on and operates correctly using PoE+ from a switch port."),
    mk("UAT-04", "Verify 500 concurrent client devices can connect to a single floor without degradation."),
    mk("UAT-05", "Verify user authentication succeeds via existing RADIUS server credentials."),
    mk("UAT-06", "Verify a vendor support ticket is acknowledged within one hour, 24x7."),
    mk("UAT-0.1", "This checksheet should be executed in the staging environment prior to production sign-off.", "informational"),
    mk("UAT-00", "Refer to the test environment setup guide before beginning UAT execution."),
  ];

  const subjects = ["firewall","router","core switch","application server","backup system","access control system","wireless network","printer fleet","helpdesk system","database cluster","VPN gateway","email system","monitoring dashboard","asset register","patch management process","user account directory","mobile device fleet","video surveillance system","power distribution unit","structured cabling plant"];
  const aspects = ["configuration","maintenance schedule","event logging","escalation procedure","test coverage","documentation set","data retention policy","encryption standard","usage reporting","audit trail","failover process","provisioning workflow","change monitoring","alert notification","compliance check"];

  let fi = 0;
  subjects.forEach((subject) => {
    aspects.forEach((aspect) => {
      fi++;
      if (fi <= 120) {
        tenderClauses.push(mk("TS-F" + fi, `${subject} ${aspect} shall be implemented as specified.`));
        reqClauses.push(mk("REQ-F" + fi, `${subject} ${aspect} must be implemented as specified.`));
        uatClauses.push(mk("UAT-F" + fi, `${subject} ${aspect} implementation verified as specified.`));
      } else {
        tenderClauses.push(mk("TS-F" + fi, `Vendor shall provide ${aspect} covering the ${subject} in line with contract terms.`));
        reqClauses.push(mk("REQ-F" + fi, `The operations team requires that ${aspect} for the ${subject} be clearly defined and tracked.`));
        uatClauses.push(mk("UAT-F" + fi, `Tester confirms that ${aspect} behaves correctly on the ${subject} during the acceptance trial.`));
      }
    });
  });

  const { data: proj, error: pErr } = await supabase
    .from("tw_projects")
    .insert({
      name: "Sample: Campus Wi-Fi Refresh (fictional)",
      created_by: user.id,
      created_by_name: actor,
    })
    .select("id,name,created_at,created_by_name,auto_confirm_threshold")
    .single();
  if (pErr || !proj)
    return NextResponse.json({ error: pErr?.message ?? "insert failed" }, { status: 500 });

  async function addDoc(type: string, name: string, by: string, rows: Row[]) {
    const { data: doc } = await supabase
      .from("tw_documents")
      .insert({ project_id: proj!.id, type, name, created_by_name: by })
      .select("id")
      .single();
    const ids: string[] = [];
    const chunk = 500;
    for (let i = 0; i < rows.length; i += chunk) {
      const { data: cl } = await supabase
        .from("tw_clauses")
        .insert(
          rows.slice(i, i + chunk).map((r, j) => ({
            document_id: doc!.id,
            clause_no: r.no,
            description: r.desc,
            tag: r.tag ?? "",
            position: i + j,
          }))
        )
        .select("id,position");
      (cl ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .forEach((c) => ids.push(c.id));
    }
    return { docId: doc!.id, clauseIds: ids };
  }

  const tender = await addDoc("tender", "Sample: Tender Vol.2 — Technical Requirements", "Alex Tan", tenderClauses);
  const req = await addDoc("requirement", "Sample: Functional Requirements Register", "Mei Ling", reqClauses);
  const uat = await addDoc("uat", "Sample: UAT Test Cases — Wireless Network", "Jordan Lee", uatClauses);

  const linkSpecs: {
    clauseIds: string[];
    status: "confirmed" | "suggested";
    createdBy: string;
    confirmedBy?: string;
    score?: number;
  }[] = [
    { clauseIds: [tender.clauseIds[0], req.clauseIds[0], uat.clauseIds[0]], status: "confirmed", createdBy: "Priya Nair", confirmedBy: "Priya Nair" },
    { clauseIds: [tender.clauseIds[1], req.clauseIds[1], uat.clauseIds[1]], status: "confirmed", createdBy: "Priya Nair", confirmedBy: "Priya Nair" },
    { clauseIds: [tender.clauseIds[3], req.clauseIds[2], uat.clauseIds[2]], status: "confirmed", createdBy: "Alex Tan" },
    { clauseIds: [tender.clauseIds[6], req.clauseIds[4], uat.clauseIds[4]], status: "confirmed", createdBy: "Mei Ling" },
    { clauseIds: [tender.clauseIds[4], req.clauseIds[3], uat.clauseIds[3]], status: "suggested", createdBy: "Auto-suggest", score: 0.81 },
    { clauseIds: [tender.clauseIds[2], uat.clauseIds[5]], status: "confirmed", createdBy: "Jordan Lee" },
  ];

  const linkIds: string[] = [];
  for (const spec of linkSpecs) {
    const { data: link } = await supabase
      .from("tw_links")
      .insert({
        project_id: proj.id,
        status: spec.status,
        score: spec.score ?? null,
        created_by: spec.createdBy,
        confirmed_by: spec.confirmedBy ?? null,
        confirmed_at: spec.status === "confirmed" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (!link) continue;
    linkIds.push(link.id);
    await supabase
      .from("tw_link_clauses")
      .insert(spec.clauseIds.map((cid) => ({ link_id: link.id, clause_id: cid })));
  }

  const partialLinkId = linkIds[5];
  await supabase.from("tw_gap_meta").insert([
    { project_id: proj.id, gap_key: partialLinkId, owner: "Alex Tan", target_date: isoDateOffset(-3), notes: "Chase vendor for the missing support-SLA requirement clause.", resolved: false },
    { project_id: proj.id, gap_key: req.clauseIds[5], owner: "Mei Ling", target_date: isoDateOffset(5), notes: "Confirm an audit-logging test case with QA.", resolved: false },
    { project_id: proj.id, gap_key: tender.clauseIds[5], owner: "Jordan Lee", target_date: isoDateOffset(-10), notes: "Onsite training UAT case added and closed.", resolved: true },
    { project_id: proj.id, gap_key: tender.clauseIds[tenderDemoNAIdx], owner: "", target_date: null, notes: "Legacy SNMPv1 platform was decommissioned prior to contract award; requirement no longer applicable to this project.", resolved: false, disposition: "not_applicable" },
  ]);

  const total = tenderClauses.length + reqClauses.length + uatClauses.length;
  await supabase.from("tw_audit_log").insert([
    { project_id: proj.id, ts: ago(0, 1), user_name: "Priya Nair", action: "Sent reminder", detail: "Tender TS-1.3, UAT UAT-06" },
    { project_id: proj.id, ts: ago(1, 3), user_name: "Jordan Lee", action: "Marked gap resolved", detail: "TS-3.1" },
    { project_id: proj.id, ts: ago(2, 2), user_name: "Mei Ling", action: "Updated gap tracking", detail: "REQ-06 — owner: Mei Ling, target: " + isoDateOffset(5) },
    { project_id: proj.id, ts: ago(2, 6), user_name: "Alex Tan", action: "Updated gap tracking", detail: "Partial link — owner: Alex Tan, target: " + isoDateOffset(-3) },
    { project_id: proj.id, ts: ago(3, 1), user_name: "Jordan Lee", action: "Linked clauses manually", detail: "2 clause(s) linked (TS-1.3, UAT-06)" },
    { project_id: proj.id, ts: ago(3, 5), user_name: "Mei Ling", action: "Linked clauses manually", detail: "3 clause(s) linked (TS-4.1, REQ-05, UAT-05)" },
    { project_id: proj.id, ts: ago(4, 2), user_name: "Alex Tan", action: "Linked clauses manually", detail: "3 clause(s) linked (TS-2.1, REQ-03, UAT-03)" },
    { project_id: proj.id, ts: ago(5, 1), user_name: "Priya Nair", action: "Accepted suggested link", detail: "3 clause(s) — TS-1.2, REQ-02, UAT-02" },
    { project_id: proj.id, ts: ago(5, 2), user_name: "Priya Nair", action: "Accepted suggested link", detail: "3 clause(s) — TS-1.1, REQ-01, UAT-01" },
    { project_id: proj.id, ts: ago(5, 4), user_name: "Auto-suggest", action: "Ran auto-suggest mapping", detail: "6 suggested link(s) generated" },
    { project_id: proj.id, ts: ago(6, 1), user_name: "Jordan Lee", action: "Added document", detail: `UAT Checksheet "Sample: UAT Test Cases — Wireless Network" (${uatClauses.length} clauses)` },
    { project_id: proj.id, ts: ago(7, 1), user_name: "Mei Ling", action: "Added document", detail: `Requirement Spec "Sample: Functional Requirements Register" (${reqClauses.length} clauses)` },
    { project_id: proj.id, ts: ago(7, 4), user_name: "Alex Tan", action: "Added document", detail: `Tender Spec "Sample: Tender Vol.2 — Technical Requirements" (${tenderClauses.length} clauses)` },
    { project_id: proj.id, ts: ago(8, 0), user_name: "Sample data", action: "Created project", detail: "Sample: Campus Wi-Fi Refresh (fictional)" },
    { project_id: proj.id, ts: ago(8, 1), user_name: "Sample data", action: "Loaded sample dataset", detail: `3 documents, ${total} clauses, 6 links seeded — rails paginated, ready for auto-suggest` },
  ]);

  return NextResponse.json({
    project: {
      id: proj.id,
      name: proj.name,
      createdAt: new Date(proj.created_at).getTime(),
      createdBy: proj.created_by_name,
      autoConfirmThreshold: proj.auto_confirm_threshold,
    },
    clauses: total,
  });
}
