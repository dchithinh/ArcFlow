import { useEffect, useMemo, useReducer } from "react";
import { AppFrame } from "../components/layout/AppFrame";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { FeatureWorkspacePage } from "../pages/workspace/FeatureWorkspacePage";
import { createEmptyWorkspace, createSampleWorkspace } from "../features/workspaces/schema/defaults";
import { applyImportedMarkdownToWorkspace } from "../features/workspaces/import/markdown";
import type { FeatureWorkspace } from "../features/workspaces/schema/workspace";
import {
  loadWorkspaces,
  normalizeImportedWorkspace,
  saveWorkspaces,
} from "../features/workspaces/storage/local-storage";
import {
  canSyncWorkspaceFiles,
  inspectWorkspaceFiles,
  pullWorkspaceFiles,
  syncWorkspaceFiles,
} from "../features/workspaces/storage/file-sync";

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

  const buildWorkspaceBaseName = (workspace: FeatureWorkspace): string =>
    workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "feature-workspace";

  const buildCurrentSyncFiles = (workspace: FeatureWorkspace, markdown: string) => {
    const baseName = buildWorkspaceBaseName(workspace);
    const workspaceJson = JSON.stringify(workspace, null, 2);
    const agents = buildLlmGuideContent(workspace, markdown);

    return {
      agents,
      baseName,
      markdown,
      workspaceJson,
    };
  };

  const hashString = (value: string): string => {
    let hash = 5381;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 33) ^ value.charCodeAt(index);
    }
    return (hash >>> 0).toString(16);
  };

  const buildLlmGuideContent = (workspace: FeatureWorkspace, markdown: string): string => {
    const baseName = buildWorkspaceBaseName(workspace);
    return `# AGENTS.md

## Purpose

This file tells Codex or another coding/design assistant how to edit the synced ArchFlow files safely so they can be pulled back into ArchFlow without breaking the workspace.

The goal is not to generate arbitrary documents.
The goal is to make structured, incremental design edits that still conform to ArchFlow's workspace model.

## Workspace Files

Use these files together:

### \`${baseName}.workspace.json\`
- Structured ArchFlow workspace export.
- This is the canonical source of truth for the design model.
- It contains feature definition, components, internal objects, interactions, states, and detailed editor data.

### \`${baseName}.md\`
- Human-readable design summary.
- Use this for quick orientation before reading the JSON.
- It may be easier to review, but it is derived output.

## File Ownership Rules

- Treat \`${baseName}.workspace.json\` as the only full-fidelity editable source.
- Treat \`${baseName}.md\` as a limited feature-definition edit surface.
- Do not use \`${baseName}.md\` to redesign component structure, object structure, interactions, or states.
- Do not edit \`AGENTS.md\` unless the user explicitly asks to change the agent instructions.
- If markdown and JSON disagree, trust and edit the JSON.

## Working Rules

- Read this file first.
- Read \`${baseName}.md\` next for fast understanding.
- Read \`${baseName}.workspace.json\` after that for exact structure and field-level truth.
- If markdown and JSON differ, trust the JSON.
- Keep suggestions incremental and practical.
- Preserve the user's intent and vocabulary.
- Prefer identifying gaps, ambiguities, and weak boundaries over rewriting the whole design.
- Do not invent domain facts that are not supported by the files.
- Treat diagrams and markdown as derived views, not the source of truth.
- Prefer small edits over large rewrites.
- Preserve existing IDs whenever an item still represents the same thing.
- Do not delete fields just because they are empty or unfamiliar.
- Do not rename schema keys.
- Do not add comments, trailing commas, or non-JSON syntax to the JSON file.

## Strict JSON Editing Contract

When editing \`${baseName}.workspace.json\`, follow these rules strictly:

- Keep the file as valid JSON.
- Keep the top-level object shape intact.
- Preserve existing object IDs, component IDs, interaction IDs, scenario IDs, node IDs, and link IDs unless the item is being intentionally replaced.
- If you add a new item to a list, create a new ID string and keep the existing IDs unchanged.
- Preserve unknown fields if they already exist.
- Preserve array structure for fields that are already arrays.
- Preserve object structure for fields that are already objects.
- Do not convert arrays into paragraphs or paragraphs into arrays.
- Do not collapse nested workspace data into summary text.
- Do not remove empty arrays or empty strings just to "clean up" the file.
- Only change values that are relevant to the requested design update.

## Strict Markdown Editing Contract

When editing \`${baseName}.md\`, assume ArchFlow only re-imports feature-definition content from it.

Safe markdown edits:

- feature title
- feature summary
- feature requirements
- constraints
- responsibilities
- assumptions
- open questions

Unsafe markdown edits for round-trip purposes:

- component definitions
- internal object definitions
- component interactions
- state machine structure
- runtime structure
- data flow structure

If the requested change affects architecture, components, objects, interactions, or state, edit the JSON instead of the markdown.

## Preferred Edit Strategy

1. Read \`${baseName}.md\` for quick understanding.
2. Read \`${baseName}.workspace.json\` for the real editable structure.
3. Decide whether the requested change belongs in markdown, JSON, or both.
4. For architecture/detail changes, edit JSON first.
5. Only edit markdown when the change is part of feature-definition text.
6. Keep JSON and markdown semantically aligned when both are updated.

## What Codex Should Help With

- find missing components
- find missing internal objects inside a component
- suggest active objects vs passive objects
- suggest candidate execution units, workers, handlers, or tasks
- suggest clearer interactions between components
- suggest clearer interactions between internal objects
- suggest state candidates, transitions, and triggering events
- identify risks, assumptions, and open questions
- point out inconsistent responsibilities or weak boundaries
- help the user refine the design without replacing it

## What Codex Should Avoid

- do not rewrite the entire architecture unless the user explicitly asks
- do not convert uncertain assumptions into facts
- do not ignore the JSON when markdown is simpler to read
- do not force implementation details too early when the design is still exploratory
- do not collapse feature-level discovery and component-level detail into one step
- do not rewrite IDs for existing entities
- do not remove schema fields that ArchFlow may still need
- do not move detailed architecture into markdown-only prose
- do not edit only markdown when the requested change clearly affects structured design data

## Recommended Review Flow

1. Understand the feature goal from the markdown file.
2. Inspect the JSON structure to verify what is actually defined.
3. Look for missing components, unclear responsibilities, and weak boundaries.
4. Inside each component, look for missing internal objects before deciding active objects and per-object states.
5. When making file edits, prefer structured JSON edits that ArchFlow can pull back safely.
6. Suggest concrete edits the user can apply back into ArchFlow.

## Suggested Prompt For Codex

\`\`\`text
Read AGENTS.md first, then read ${baseName}.md and ${baseName}.workspace.json.

Use the markdown file for overview and the JSON file as the source of truth.
Edit the files in a way that remains re-importable into ArchFlow.

Help me improve this design incrementally.
Focus on:
- missing components
- missing internal objects
- active vs passive object suggestions
- candidate execution units or tasks
- missing states, transitions, or events
- unclear interactions
- design risks, weak assumptions, or inconsistent boundaries

Do not rewrite the whole design unless I ask.
Preserve schema structure and existing IDs unless a new item is being added.
If the change affects architecture detail, edit the JSON.
If the change only affects feature-definition text, markdown edits are allowed.
Keep edits concrete so I can pull them back into ArchFlow.
\`\`\`

## Current Feature Context

### Feature Name
${workspace.title || "Untitled Feature"}

### Feature Summary
${workspace.featureSummary.summary || "No feature summary documented yet."}

### Exported Requirement Markdown
\`\`\`md
${markdown}
\`\`\`
`;
  };

  const exportMarkdown = (markdown: string, fileName: string) => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "feature-design"}.md`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const exportWorkspaceJson = (workspace: FeatureWorkspace) => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "feature-workspace"}.workspace.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const syncLlmFiles = async (workspace: FeatureWorkspace, markdown: string) => {
    if (!canSyncWorkspaceFiles()) {
      throw new Error("File sync is only supported in browsers with the File System Access API.");
    }

    const currentFiles = buildCurrentSyncFiles(workspace, markdown);
    await syncWorkspaceFiles({
      workspaceId: workspace.id,
      manifest: {
        workspaceJson: `${currentFiles.baseName}.workspace.json`,
        markdown: `${currentFiles.baseName}.md`,
        agents: "AGENTS.md",
      },
      files: [
        {
          name: `${currentFiles.baseName}.workspace.json`,
          content: currentFiles.workspaceJson,
          type: "application/json;charset=utf-8",
        },
        {
          name: `${currentFiles.baseName}.md`,
          content: currentFiles.markdown,
          type: "text/markdown;charset=utf-8",
        },
        {
          name: `AGENTS.md`,
          content: currentFiles.agents,
          type: "text/markdown;charset=utf-8",
        },
      ],
    });
  };

  const inspectLlmSync = async (workspace: FeatureWorkspace, markdown: string) => {
    const currentFiles = buildCurrentSyncFiles(workspace, markdown);
    return inspectWorkspaceFiles({
      workspaceId: workspace.id,
      fallbackBaseName: currentFiles.baseName,
      currentFiles: {
        workspaceJson: hashString(currentFiles.workspaceJson),
        markdown: hashString(currentFiles.markdown),
        agents: hashString(currentFiles.agents),
      },
    });
  };

  const pullSyncedLlmFiles = async (workspace: FeatureWorkspace) => {
    if (!canSyncWorkspaceFiles()) {
      throw new Error("File sync is only supported in browsers with the File System Access API.");
    }

    const pulled = await pullWorkspaceFiles({
      workspaceId: workspace.id,
      fallbackBaseName: buildWorkspaceBaseName(workspace),
    });

    let nextWorkspace = workspace;
    if (pulled.workspaceJson) {
      const parsed = JSON.parse(pulled.workspaceJson.content) as FeatureWorkspace;
      const normalized = normalizeImportedWorkspace(parsed);
      nextWorkspace = {
        ...normalized,
        id: workspace.id,
        createdAt: workspace.createdAt,
        updatedAt: new Date().toISOString(),
      };
    }

    if (pulled.markdown) {
      nextWorkspace = {
        ...applyImportedMarkdownToWorkspace(
          nextWorkspace,
          pulled.markdown.content,
          pulled.markdown.name,
        ),
        updatedAt: new Date().toISOString(),
      };
    }

    dispatch({
      type: "update",
      workspaceId: workspace.id,
      updater: () => nextWorkspace,
    });

    return pulled;
  };

  const importWorkspaceJson = async (file: File) => {
    const content = await file.text();
    const parsed = JSON.parse(content) as FeatureWorkspace;
    const normalized = normalizeImportedWorkspace(parsed);
    const importedWorkspace: FeatureWorkspace = {
      ...normalized,
      id: `${normalized.id}-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: "create", workspace: importedWorkspace });
  };

  return (
    <AppFrame
      header={
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-copper">System Design Assistant</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">ArchFlow</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate">
              Local-first feature architecture discovery for software, systems, and embedded work, with candidate component mapping, per-component detail editing, and structured design artifacts.
            </p>
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
          onExportWorkspaceJson={exportWorkspaceJson}
          onSyncLlmFiles={syncLlmFiles}
          onInspectLlmSync={inspectLlmSync}
          onPullLlmFiles={pullSyncedLlmFiles}
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
          onImportWorkspaceJson={importWorkspaceJson}
        />
      )}
    </AppFrame>
  );
};
