import { useEffect, useMemo, useReducer } from "react";
import { AppFrame } from "../components/layout/AppFrame";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { FeatureWorkspacePage } from "../pages/workspace/FeatureWorkspacePage";
import { createEmptyWorkspace, createSampleWorkspace } from "../features/workspaces/schema/defaults";
import type { FeatureWorkspace } from "../features/workspaces/schema/workspace";
import { loadWorkspaces, saveWorkspaces } from "../features/workspaces/storage/local-storage";

type AppState = {
  workspaces: FeatureWorkspace[];
  activeWorkspaceId: string | null;
};

type AppAction =
  | { type: "hydrate"; workspaces: FeatureWorkspace[] }
  | { type: "create"; workspace: FeatureWorkspace }
  | { type: "open"; workspaceId: string }
  | { type: "backToDashboard" }
  | { type: "remove"; workspaceId: string }
  | {
      type: "update";
      workspaceId: string;
      updater: (current: FeatureWorkspace) => FeatureWorkspace;
    };

const reducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        workspaces: action.workspaces,
      };
    case "create":
      return {
        workspaces: [
          action.workspace,
          ...state.workspaces.filter((item) => item.id !== action.workspace.id),
        ],
        activeWorkspaceId: action.workspace.id,
      };
    case "open":
      return {
        ...state,
        activeWorkspaceId: action.workspaceId,
      };
    case "backToDashboard":
      return {
        ...state,
        activeWorkspaceId: null,
      };
    case "remove":
      return {
        workspaces: state.workspaces.filter((workspace) => workspace.id !== action.workspaceId),
        activeWorkspaceId:
          state.activeWorkspaceId === action.workspaceId ? null : state.activeWorkspaceId,
      };
    case "update":
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === action.workspaceId ? action.updater(workspace) : workspace,
        ),
      };
    default:
      return state;
  }
};

const initialState: AppState = {
  workspaces: [],
  activeWorkspaceId: null,
};

export const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const activeWorkspace = useMemo(
    () => state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? null,
    [state.activeWorkspaceId, state.workspaces],
  );

  useEffect(() => {
    dispatch({ type: "hydrate", workspaces: loadWorkspaces() });
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      saveWorkspaces(state.workspaces);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [state.workspaces]);

  const exportMarkdown = (markdown: string, fileName: string) => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "firmware-design"}.md`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AppFrame
      header={
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-copper">Firmware System Design Assistant</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">ArchFlow</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate">
              Local-first feature architecture discovery for embedded systems, with candidate component mapping, per-component detail editing, and generated firmware design artifacts.
            </p>
          </div>
          <div className="rounded-2xl bg-mist px-4 py-3 text-sm text-slate">
            Docker-first runtime, browser storage for persistence, hierarchical feature workspaces for outputs.
          </div>
        </div>
      }
    >
      {activeWorkspace ? (
        <FeatureWorkspacePage
          workspace={activeWorkspace}
          onBack={() => dispatch({ type: "backToDashboard" })}
          onChange={(updater) => {
            dispatch({
              type: "update",
              workspaceId: activeWorkspace.id,
              updater,
            });
          }}
          onExport={exportMarkdown}
        />
      ) : (
        <DashboardPage
          designs={state.workspaces}
          onCreate={() => dispatch({ type: "create", workspace: createEmptyWorkspace() })}
          onOpen={(designId) => dispatch({ type: "open", workspaceId: designId })}
          onRemove={(workspaceId) => dispatch({ type: "remove", workspaceId })}
          onLoadSample={() =>
            dispatch({ type: "create", workspace: createSampleWorkspace() })
          }
        />
      )}
    </AppFrame>
  );
};
