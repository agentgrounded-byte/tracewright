"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as api from "@/lib/api";
import {
  ProjectData,
  ProjectSummary,
  emptyProjectData,
  GapMeta,
  JumpTarget,
} from "@/lib/types";

export interface Me {
  id: string;
  email: string;
  displayName: string;
}

interface ConfirmState {
  message: string;
  okLabel: string;
  resolve: (v: boolean) => void;
}
interface PromptState {
  message: string;
  value: string;
  resolve: (v: string | null) => void;
}

interface Ctx {
  me: Me;
  setDisplayName: (name: string) => Promise<void>;
  projects: ProjectSummary[];
  projectId: string | null;
  projectName: string;
  data: ProjectData;
  setData: React.Dispatch<React.SetStateAction<ProjectData>>;
  loading: boolean;
  switchProject: (id: string) => Promise<void>;
  addProject: (name: string) => Promise<void>;
  reload: () => Promise<void>;
  toast: (msg: string) => void;
  audit: (action: string, detail: string) => Promise<void>;
  sessionConfirmed: Set<string>;
  markSessionConfirmed: (id: string) => void;
  unmarkSessionConfirmed: (id: string) => void;
  saveGapMeta: (key: string, patch: Partial<GapMeta>) => Promise<void>;
  confirmDialog: (message: string, okLabel?: string) => Promise<boolean>;
  promptDialog: (message: string, value?: string) => Promise<string | null>;
  jumpTarget: JumpTarget | null;
  setJumpTarget: (t: JumpTarget | null) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function AppProvider({
  initialMe,
  children,
}: {
  initialMe: Me;
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<Me>(initialMe);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [data, setData] = useState<ProjectData>(emptyProjectData());
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [jumpTarget, setJumpTarget] = useState<JumpTarget | null>(null);
  const sessionConfirmed = useRef<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }, []);

  const loadProject = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setData(await api.loadProjectData(id));
    } catch (e) {
      console.error(e);
      toast("Could not load this project");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.listProjects();
        setProjects(list);
        if (list.length) {
          setProjectId(list[0].id);
          await loadProject(list[0].id);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        setLoading(false);
        toast("Could not load projects");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchProject = useCallback(
    async (id: string) => {
      setProjectId(id);
      sessionConfirmed.current = new Set();
      setJumpTarget(null);
      await loadProject(id);
    },
    [loadProject]
  );

  const addProject = useCallback(
    async (name: string) => {
      const displayName = me.displayName || me.email;
      const p = await api.createProject(name, me.id, displayName);
      setProjects((prev) => [p, ...prev]);
      setProjectId(p.id);
      sessionConfirmed.current = new Set();
      setData(emptyProjectData());
      await api.writeAudit(p.id, displayName, "Created project", name);
      setData((d) => ({
        ...d,
        auditLog: [
          { ts: Date.now(), user: displayName, action: "Created project", detail: name },
          ...d.auditLog,
        ],
      }));
      toast("Project created");
    },
    [me, toast]
  );

  const reload = useCallback(async () => {
    if (projectId) await loadProject(projectId);
  }, [projectId, loadProject]);

  const audit = useCallback(
    async (action: string, detail: string) => {
      if (!projectId) return;
      const user = me.displayName || me.email;
      setData((d) => ({
        ...d,
        auditLog: [{ ts: Date.now(), user, action, detail }, ...d.auditLog].slice(
          0,
          500
        ),
      }));
      try {
        await api.writeAudit(projectId, user, action, detail);
      } catch (e) {
        console.error(e);
      }
    },
    [projectId, me]
  );

  const saveGapMeta = useCallback(
    async (key: string, patch: Partial<GapMeta>) => {
      if (!projectId) return;
      let next: GapMeta = {
        owner: "",
        targetDate: "",
        notes: "",
        resolved: false,
        disposition: "",
      };
      setData((d) => {
        const current = d.gapMeta[key] ?? next;
        next = { ...current, ...patch };
        return { ...d, gapMeta: { ...d.gapMeta, [key]: next } };
      });
      try {
        await api.upsertGapMeta(projectId, key, next);
      } catch (e) {
        console.error(e);
        toast("Could not save — please retry");
      }
    },
    [projectId, toast]
  );

  const setDisplayName = useCallback(
    async (name: string) => {
      setMe((m) => ({ ...m, displayName: name }));
      await api.saveDisplayName(me.id, name);
    },
    [me.id]
  );

  const confirmDialog = useCallback(
    (message: string, okLabel = "Confirm") =>
      new Promise<boolean>((resolve) =>
        setConfirmState({ message, okLabel, resolve })
      ),
    []
  );

  const promptDialog = useCallback(
    (message: string, value = "") =>
      new Promise<string | null>((resolve) =>
        setPromptState({ message, value, resolve })
      ),
    []
  );

  const projectName = useMemo(
    () => projects.find((p) => p.id === projectId)?.name ?? "",
    [projects, projectId]
  );

  const value: Ctx = {
    me,
    setDisplayName,
    projects,
    projectId,
    projectName,
    data,
    setData,
    loading,
    switchProject,
    addProject,
    reload,
    toast,
    audit,
    sessionConfirmed: sessionConfirmed.current,
    markSessionConfirmed: (id) => sessionConfirmed.current.add(id),
    unmarkSessionConfirmed: (id) => sessionConfirmed.current.delete(id),
    saveGapMeta,
    confirmDialog,
    promptDialog,
    jumpTarget,
    setJumpTarget,
  };

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className={"toast" + (toastMsg ? " show" : "")}>{toastMsg}</div>

      {confirmState && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 420, marginTop: "12vh" }}>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
                {confirmState.message}
              </p>
            </div>
            <div className="modal-foot">
              <button
                className="btn ghost"
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
              >
                {confirmState.okLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptState && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 420, marginTop: "12vh" }}>
            <div className="modal-body">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{promptState.message}</label>
                <input
                  autoFocus
                  value={promptState.value}
                  onChange={(e) =>
                    setPromptState((s) =>
                      s ? { ...s, value: e.target.value } : s
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      promptState.resolve(promptState.value);
                      setPromptState(null);
                    }
                  }}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button
                className="btn ghost"
                onClick={() => {
                  promptState.resolve(null);
                  setPromptState(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  promptState.resolve(promptState.value);
                  setPromptState(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </AppCtx.Provider>
  );
}
