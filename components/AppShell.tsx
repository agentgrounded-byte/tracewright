"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppContext";
import { gapItems, gapMetaFor, gapIsOpen } from "@/lib/derive";
import { exportRTM } from "@/lib/export";
import DocumentsTab from "./tabs/DocumentsTab";
import MappingTab from "./tabs/MappingTab";
import SuggestionsTab from "./tabs/SuggestionsTab";
import RtmTab from "./tabs/RtmTab";
import GapsTab from "./tabs/GapsTab";
import DashboardTab from "./tabs/DashboardTab";
import AuditTab from "./tabs/AuditTab";
import ConfigTab from "./tabs/ConfigTab";
import NewProjectModal from "./modals/NewProjectModal";

type TabName =
  | "documents"
  | "mapping"
  | "suggestions"
  | "rtm"
  | "gaps"
  | "dashboard"
  | "audit"
  | "config";

const TABS: { key: TabName; label: string }[] = [
  { key: "documents", label: "Documents" },
  { key: "mapping", label: "Mapping" },
  { key: "suggestions", label: "Suggested Links" },
  { key: "rtm", label: "Confirmed RTM" },
  { key: "gaps", label: "Gap Tracker" },
  { key: "dashboard", label: "Dashboard" },
  { key: "audit", label: "Audit Log" },
  { key: "config", label: "Configuration" },
];

export default function AppShell() {
  const app = useApp();
  const {
    me,
    setDisplayName,
    projects,
    projectId,
    projectName,
    data,
    loading,
    switchProject,
    toast,
    promptDialog,
    confirmDialog,
  } = app;

  const [tab, setTab] = useState<TabName>("documents");
  const [showNewProject, setShowNewProject] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [loadingSample, setLoadingSample] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState(0);

  const suggestCount = useMemo(
    () => data.links.filter((l) => l.status === "suggested").length,
    [data.links]
  );
  const openGapCount = useMemo(() => {
    return gapItems(data).filter((i) => gapIsOpen(gapMetaFor(data, i.key)))
      .length;
  }, [data]);

  async function loadSample() {
    const ok = await confirmDialog(
      "This will add a new sample project with synthetic data (not real tender data) so you can try the tool. Continue?",
      "Load sample data"
    );
    if (!ok) return;
    setLoadingSample(true);
    try {
      const res = await fetch("/api/sample-data", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      window.location.reload();
    } catch (e) {
      console.error(e);
      toast("Could not load sample data");
    } finally {
      setLoadingSample(false);
    }
  }

  function doExport() {
    if (!projectId || !data.documents.length) {
      toast("Nothing to export yet");
      return;
    }
    const n = exportRTM(data, projectName || "project");
    app.audit("Exported RTM to Excel", n + " rows");
    toast("Exported");
  }

  /* ------------------------- first-run display name ------------------------ */
  if (!me.displayName) {
    return (
      <div className="gate">
        <div className="gate-card">
          <h2>Welcome to Tracewright</h2>
          <p>
            Signed in as {me.email}. Enter the name your colleagues will see
            against your changes in the shared audit trail.
          </p>
          <input
            autoFocus
            value={nameDraft}
            maxLength={40}
            placeholder="e.g. Priya Nair"
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && nameDraft.trim())
                setDisplayName(nameDraft.trim());
            }}
          />
          <button
            onClick={() => {
              if (!nameDraft.trim()) {
                toast("Please enter a name");
                return;
              }
              setDisplayName(nameDraft.trim());
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">RTM</span>
          <div>
            <h1>Tracewright</h1>
            <div className="sub">tender · requirement · UAT traceability</div>
          </div>
        </div>
        <div className="topbar-right">
          <select
            className="project-select"
            value={projectId ?? ""}
            onChange={(e) => switchProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => setShowNewProject(true)}>
            + Project
          </button>
          <button className="btn" onClick={loadSample} disabled={loadingSample}>
            {loadingSample ? "Loading…" : "Load sample data"}
          </button>
          <button className="btn" onClick={doExport}>
            Export .xlsx
          </button>
          <div
            className="user-chip"
            title={me.email}
            onClick={async () => {
              const v = await promptDialog(
                "Update your display name:",
                me.displayName
              );
              if (v && v.trim()) {
                await setDisplayName(v.trim());
                toast("Name updated");
              }
            }}
          >
            <span className="user-dot" />
            <span>{me.displayName}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn ghost small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {loading ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <h3>Loading…</h3>
        </div>
      ) : !projectId ? (
        <div className="no-project">
          <h2>No project yet</h2>
          <p>
            Create a project to start uploading tender specs, requirement specs,
            and UAT checksheets.
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn primary"
              onClick={() => setShowNewProject(true)}
            >
              Create your first project
            </button>
            <button className="btn" onClick={loadSample} disabled={loadingSample}>
              Load sample data instead
            </button>
          </div>
        </div>
      ) : (
        <>
          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={tab === t.key ? "active" : ""}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.key === "suggestions" && suggestCount > 0 && (
                  <span className="count alert">{suggestCount}</span>
                )}
                {t.key === "gaps" && openGapCount > 0 && (
                  <span className="count alert">{openGapCount}</span>
                )}
              </button>
            ))}
          </nav>

          {tab === "documents" && <DocumentsTab />}
          {tab === "mapping" && (
            <MappingTab
              pendingSuggestions={pendingSuggestions}
              setPendingSuggestions={setPendingSuggestions}
              goToSuggestions={() => setTab("suggestions")}
            />
          )}
          {tab === "suggestions" && <SuggestionsTab />}
          {tab === "rtm" && <RtmTab />}
          {tab === "gaps" && <GapsTab />}
          {tab === "dashboard" && <DashboardTab />}
          {tab === "audit" && <AuditTab />}
          {tab === "config" && <ConfigTab />}
        </>
      )}

      <div className="footer-note">
        Tracewright · data stored in your organization&apos;s shared workspace ·
        sample data is synthetic
      </div>

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} />
      )}
    </div>
  );
}
