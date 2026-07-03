import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Field,
  Select,
  SelectWithOther,
  TextArea,
  TextInput,
} from "../../components/form/FormControls";
import {
  EventListEditor,
  ObjectListEditor,
  StateListEditor,
  StringListEditor,
} from "../../components/form/ListEditors";
import { MermaidPreview } from "../../components/preview/MermaidPreview";
import {
  createEmptyCandidateComponent,
  createEmptyCandidateTask,
  createEmptyComponent,
  createEmptyComponentObject,
  createEmptyImplementationStep,
  createEmptyImplementationUnit,
  createEmptyContextEntity,
  createEmptyContextFlow,
  createEmptyDataFlow,
  createEmptyDataFlowNode,
  createEmptyRuntimeLink,
  createEmptyRuntimeNode,
  createEmptySequenceParticipant,
  createEmptySequenceScenario,
  createEmptySequenceStep,
} from "../../features/workspaces/schema/defaults";
import {
  canGenerateDefinitionAssist,
  canGenerateDiscoveryDraft,
  getMissingDiscoveryDraftInputs,
  mergeAiDefinitionIntoWorkspace,
  canRefineComponentWithAi,
  mergeAiComponentIntoWorkspace,
  mergeAiDiscoveryIntoWorkspace,
  type AiComponentDraft,
  type AiDefinitionDraft,
  type AiDiscoveryDraft,
} from "../../features/workspaces/ai/draft";
import {
  buildWorkspaceChatPayload,
  getWorkspaceChatScopeKey,
  type WorkspaceChatMessage,
  type WorkspaceChatPayload,
  type WorkspaceChatScope,
  type WorkspaceChatSuccessResponse,
} from "../../features/workspaces/ai/chat";
import {
  WORKSPACE_SECTIONS,
  type CandidateTask,
  type ComponentCandidate,
  type ComponentObject,
  type DataFlow,
  type DataFlowNode,
  type ContextEntity,
  type ContextFlow,
  type ComponentInteraction,
  type FailureModeDefinition,
  type FeatureComponent,
  type FeatureWorkspace,
  type ImplementationStep,
  type ImplementationUnit,
  type OwnershipDefinition,
  type RuntimeLink,
  type RuntimeNode,
  type SequenceParticipant,
  type SequenceStep,
  type WorkspaceSectionId,
} from "../../features/workspaces/schema/workspace";
import {
  generateWorkspaceOutputs,
  getBehavioralComponentNodeId,
  type GeneratedProjectFile,
} from "../../features/workspaces/generators";
import { applyImportedMarkdownToWorkspace } from "../../features/workspaces/import/markdown";
import { isWorkspaceSectionStarted } from "../../features/workspaces/state/progress";
import type { WorkspaceSyncInspection, WorkspaceSyncState } from "../../features/workspaces/storage/file-sync";

const SectionInputLabel = ({ children }: { children: string }) => (
  <span className="block text-[9px] font-medium uppercase tracking-[0.06em] text-slate/70">
    {children}
  </span>
);

const INTERACTION_MECHANISM_OPTIONS = [
  "queue",
  "event",
  "notification",
  "callback",
  "shared_memory",
  "direct_call",
  "other",
] as const;

const RUNTIME_NODE_TYPE_OPTIONS = [
  "mcu",
  "core",
  "task",
  "thread",
  "isr",
  "timer",
  "queue",
  "mutex",
  "peripheral",
  "device",
  "service",
  "store",
  "other",
] as const;

const RUNTIME_BOUNDARY_HOST_OPTIONS = [
  "mcu",
  "core",
  "device",
  "peripheral",
  "service",
  "other",
] as const;

const RUNTIME_LINK_TYPE_OPTIONS = [
  "interrupt",
  "queue",
  "notification",
  "call",
  "shared_memory",
  "driver",
  "timer",
  "mutex",
  "data",
  "other",
] as const;

const IMPLEMENTATION_UNIT_KIND_OPTIONS = [
  "module",
  "service",
  "adapter",
  "worker",
  "interface",
  "store",
  "other",
] as const;

const CONTEXT_ENTITY_TYPE_OPTIONS = [
  "user",
  "device",
  "system",
  "service",
  "timer",
  "sensor",
  "actuator",
  "other",
] as const;

const DATA_FLOW_NODE_TYPE_OPTIONS = [
  "external_entity",
  "process",
  "data_store",
  "other",
] as const;

const RequirementResponsibilityHelpContent = () => (
  <div className="space-y-3 px-1 py-1 text-sm text-slate">
    <p>
      <span className="font-semibold text-ink">Requirement</span>
      {" = "}what the feature must do.
    </p>
    <p>
      <span className="font-semibold text-ink">Responsibility</span>
      {" = "}what the system must own internally to make that happen.
    </p>
    <div className="rounded-2xl bg-mist/55 p-3">
      <p className="font-semibold text-ink">Use this test</p>
      <p className="mt-1">
        If it sounds like feature behavior or acceptance criteria, it is probably a
        requirement.
      </p>
      <p className="mt-1">
        If it sounds like an internal job you would assign to a subsystem or component,
        it is probably a responsibility.
      </p>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl bg-mist/55 p-3">
        <p className="font-semibold text-ink">Requirement examples</p>
        <ul className="mt-2 space-y-1">
          <li>Feature shall provide a clear user command interface.</li>
          <li>Feature shall reject unknown commands safely.</li>
        </ul>
      </div>
      <div className="rounded-2xl bg-mist/55 p-3">
        <p className="font-semibold text-ink">Responsibility examples</p>
        <ul className="mt-2 space-y-1">
          <li>Receive incoming input and detect complete requests.</li>
          <li>Validate command syntax and dispatch valid commands.</li>
        </ul>
      </div>
    </div>
    <div className="rounded-2xl bg-mist/55 p-3">
      <p className="font-semibold text-ink">Quick template</p>
      <p className="mt-2">Requirements:</p>
      <p>Feature shall ...</p>
      <p>Feature shall ...</p>
      <p className="mt-2">Responsibilities:</p>
      <p>Receive ...</p>
      <p>Parse ...</p>
      <p>Validate ...</p>
      <p>Dispatch ...</p>
      <p>Respond ...</p>
    </div>
  </div>
);

const ActiveObjectStateHelpContent = () => (
  <div className="space-y-3 px-1 py-1 text-sm text-slate">
    <div className="rounded-2xl bg-mist/55 p-3">
      <p className="font-semibold text-ink">Short version</p>
      <p className="mt-1">Define the component first, then brainstorm the objects inside it, then decide which objects are active, and only then model states where needed.</p>
    </div>
    <div className="rounded-2xl bg-mist/55 p-3">
      <p className="font-semibold text-ink">Recommended flow</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Name the internal objects inside the component.</li>
        <li>Mark each object as active or passive.</li>
        <li>Decide whether each object needs state.</li>
        <li>Only define a state diagram for the selected object that needs one.</li>
      </ol>
    </div>
    <div className="rounded-2xl bg-mist/55 p-3">
      <p className="font-semibold text-ink">Questions to find an active object</p>
      <ul className="mt-2 space-y-1">
        <li>What inside this component actually reacts to events?</li>
        <li>What inside this component waits, starts, sends, retries, or completes?</li>
        <li>What thing inside this component would I say is currently doing work?</li>
      </ul>
    </div>
    <div className="rounded-2xl bg-mist/55 p-3">
      <p className="font-semibold text-ink">Questions to decide if state is needed</p>
      <ul className="mt-2 space-y-1">
        <li>Does this thing behave differently over time?</li>
        <li>Can it be idle, waiting, processing, retrying, completed, or failed?</li>
        <li>Do some events only make sense in certain conditions?</li>
      </ul>
    </div>
    <div className="rounded-2xl bg-mist/55 p-3">
      <p className="font-semibold text-ink">Quick decision</p>
      <p className="mt-1">
        If the component mostly transforms input to output, it may only contain passive objects and no state machine at all.
      </p>
      <p className="mt-1">
        If something inside it manages a lifecycle or reacts asynchronously, model that thing as an active object and start with three to five states.
      </p>
    </div>
  </div>
);

const ImplementationMappingHelpContent = () => (
  <div className="space-y-4 text-sm text-slate">
    <div className="rounded-2xl bg-mist/55 p-3">
      <p className="font-semibold text-ink">What this phase is for</p>
      <ul className="mt-2 space-y-1">
        <li>Implementation units are code-facing ownership blocks such as modules, workers, adapters, stores, or interfaces.</li>
        <li>Each unit should trace back to REQ-x, logical components, and runtime or task decisions where useful.</li>
        <li>Implementation steps describe the order to build, integrate, and verify those units.</li>
      </ul>
    </div>
    <div className="rounded-2xl bg-mist/55 p-3">
      <p className="font-semibold text-ink">How to use it</p>
      <ul className="mt-2 space-y-1">
        <li>Start from implementation steps so the build slices are clear.</li>
        <li>Then define code units that those steps build or integrate.</li>
        <li>Use traceability links only where they help explain why a unit exists.</li>
      </ul>
    </div>
  </div>
);

const InlineHelpTrigger = ({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-copper/35 bg-sand/80 text-[11px] font-semibold leading-none text-copper transition hover:border-copper hover:bg-sand"
  >
    ?
  </button>
);

const syncStateLabels: Record<WorkspaceSyncState, string> = {
  unlinked: "Not linked",
  "needs-baseline": "Needs baseline sync",
  "in-sync": "In sync",
  "workspace-changed": "Workspace changed",
  "files-changed": "Files changed",
  conflict: "Conflict",
};

const requirementsToText = (requirements: string[]): string =>
  requirements
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");

const appendUniqueOption = (
  options: string[],
  value: string,
  reservedOptions: readonly string[] = [],
): string[] => {
  const nextValue = value.trim();
  if (!nextValue) {
    return options;
  }

  const normalized = nextValue.toLowerCase();
  if (reservedOptions.some((option) => option.trim().toLowerCase() === normalized)) {
    return options;
  }
  if (options.some((option) => option.trim().toLowerCase() === normalized)) {
    return options;
  }

  return [...options, nextValue];
};

const removeOptionValue = (options: string[], value: string): string[] =>
  options.filter((option) => option.trim().toLowerCase() !== value.trim().toLowerCase());


type FeatureWorkspacePageProps = {
  workspace: FeatureWorkspace;
  onBack: () => void;
  onChange: (updater: (current: FeatureWorkspace) => FeatureWorkspace) => void;
  onExport: (markdown: string, fileName: string) => void;
  onExportWorkspaceJson: (workspace: FeatureWorkspace) => void;
  onExportPicoStarterProject: (
    workspace: FeatureWorkspace,
    files: GeneratedProjectFile[],
  ) => Promise<void>;
  onInspectLlmSync: (
    workspace: FeatureWorkspace,
    markdown: string,
  ) => Promise<WorkspaceSyncInspection>;
  onSyncLlmFiles: (workspace: FeatureWorkspace, markdown: string) => Promise<void>;
  onPullLlmFiles: (workspace: FeatureWorkspace) => Promise<{
    directoryName: string;
    manifestFound: boolean;
    markdown: { content: string; name: string } | null;
    workspaceJson: { content: string; name: string } | null;
  }>;
};

type AiStage = "definition" | "discovery" | "component";

type AiStageSuccessResponse = {
  draft: AiDefinitionDraft | AiDiscoveryDraft | AiComponentDraft;
  model: string;
  provider: string;
  stage: AiStage;
  durationMs: number;
};

type ComponentDetailMode = "container" | "state";
type ScopeChatState = {
  draft: string;
  messages: WorkspaceChatMessage[];
  status: "idle" | "loading" | "error";
  message: string;
};

const createEmptyScopeChatState = (): ScopeChatState => ({
  draft: "",
  messages: [],
  status: "idle",
  message: "",
});

export const FeatureWorkspacePage = ({
  workspace,
  onBack,
  onChange: onWorkspaceChange,
  onExport,
  onExportWorkspaceJson,
  onExportPicoStarterProject,
  onInspectLlmSync,
  onSyncLlmFiles,
  onPullLlmFiles,
}: FeatureWorkspacePageProps) => {
  const [activeSection, setActiveSection] = useState<WorkspaceSectionId>("featureDefinition");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    workspace.components[0]?.id ?? null,
  );
  const [selectedComponentObjectId, setSelectedComponentObjectId] = useState<string | null>(null);
  const [selectedContextEntityId, setSelectedContextEntityId] = useState<string | null>(
    workspace.discovery.contextEntities[0]?.id ?? null,
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    workspace.discovery.sequenceScenarios[0]?.id ?? null,
  );
  const [selectedInteractionIndex, setSelectedInteractionIndex] = useState<number | null>(
    workspace.discovery.interactions.length > 0 ? 0 : null,
  );
  const [selectedDataFlowNodeId, setSelectedDataFlowNodeId] = useState<string | null>(
    workspace.discovery.dataFlowNodes[0]?.id ?? null,
  );
  const [selectedDataFlowId, setSelectedDataFlowId] = useState<string | null>(
    workspace.discovery.dataFlows[0]?.id ?? null,
  );
  const [selectedRuntimeNodeId, setSelectedRuntimeNodeId] = useState<string | null>(
    workspace.discovery.runtimeNodes[0]?.id ?? null,
  );
  const [selectedRuntimeLinkId, setSelectedRuntimeLinkId] = useState<string | null>(
    workspace.discovery.runtimeLinks[0]?.id ?? null,
  );
  const [selectedCandidateTaskId, setSelectedCandidateTaskId] = useState<string | null>(
    workspace.discovery.candidateTasks[0]?.id ?? null,
  );
  const [expandedBehavioralComponentIds, setExpandedBehavioralComponentIds] = useState<string[]>(
    [],
  );
  const [componentDetailOpen, setComponentDetailOpen] = useState(false);
  const [componentDetailMode, setComponentDetailMode] = useState<ComponentDetailMode>("container");
  const [contextDetailOpen, setContextDetailOpen] = useState(false);
  const [scenarioDetailOpen, setScenarioDetailOpen] = useState(false);
  const [interactionDetailOpen, setInteractionDetailOpen] = useState(false);
  const [dataFlowNodeDetailOpen, setDataFlowNodeDetailOpen] = useState(false);
  const [dataFlowDetailOpen, setDataFlowDetailOpen] = useState(false);
  const [runtimeNodeDetailOpen, setRuntimeNodeDetailOpen] = useState(false);
  const [runtimeLinkDetailOpen, setRuntimeLinkDetailOpen] = useState(false);
  const [candidateTaskDetailOpen, setCandidateTaskDetailOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [aiMessage, setAiMessage] = useState("");
  const [aiStage, setAiStage] = useState<AiStage>("discovery");
  const [aiElapsedSeconds, setAiElapsedSeconds] = useState(0);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState("");
  const [chatByScope, setChatByScope] = useState<Record<string, ScopeChatState>>({});
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncState, setSyncState] = useState<WorkspaceSyncState>("unlinked");
  const [syncDirectoryName, setSyncDirectoryName] = useState<string | null>(null);
  const [editingOverrideEnabled, setEditingOverrideEnabled] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const outputs = useMemo(
    () =>
      generateWorkspaceOutputs(
        workspace,
        selectedComponentId ?? undefined,
        selectedComponentObjectId ?? undefined,
        expandedBehavioralComponentIds,
        selectedContextEntityId ?? undefined,
        selectedScenarioId ?? undefined,
        selectedDataFlowNodeId ?? undefined,
        selectedDataFlowId ?? undefined,
        selectedRuntimeNodeId ?? undefined,
        selectedRuntimeLinkId ?? undefined,
      ),
    [
      selectedComponentId,
      selectedComponentObjectId,
      selectedContextEntityId,
      selectedDataFlowId,
      selectedDataFlowNodeId,
      expandedBehavioralComponentIds,
      selectedRuntimeLinkId,
      selectedRuntimeNodeId,
      selectedScenarioId,
      workspace,
    ],
  );

  const startedSections = WORKSPACE_SECTIONS.filter((section) =>
    isWorkspaceSectionStarted(workspace, section.id),
  ).length;
  const selectedComponent =
    workspace.components.find((component) => component.id === selectedComponentId) ??
    workspace.components[0] ??
    null;
  const selectedCandidateComponent =
    workspace.discovery.candidateComponents.find(
      (component) => component.id === selectedComponentId,
    ) ?? null;
  const selectedComponentObject =
    selectedComponent?.objects.find((object) => object.id === selectedComponentObjectId) ??
    selectedComponent?.objects[0] ??
    null;
  const selectedScenario =
    workspace.discovery.sequenceScenarios.find((scenario) => scenario.id === selectedScenarioId) ??
    workspace.discovery.sequenceScenarios[0] ??
    null;
  const selectedContextEntity =
    workspace.discovery.contextEntities.find((entity) => entity.id === selectedContextEntityId) ??
    workspace.discovery.contextEntities[0] ??
    null;
  const selectedInteraction =
    selectedInteractionIndex !== null
      ? workspace.discovery.interactions[selectedInteractionIndex] ?? null
      : workspace.discovery.interactions[0] ?? null;
  const selectedDataFlowNode =
    workspace.discovery.dataFlowNodes.find((node) => node.id === selectedDataFlowNodeId) ??
    workspace.discovery.dataFlowNodes[0] ??
    null;
  const selectedDataFlow =
    workspace.discovery.dataFlows.find((flow) => flow.id === selectedDataFlowId) ??
    workspace.discovery.dataFlows[0] ??
    null;
  const selectedRuntimeNode =
    workspace.discovery.runtimeNodes.find((node) => node.id === selectedRuntimeNodeId) ??
    workspace.discovery.runtimeNodes[0] ??
    null;
  const selectedRuntimeLink =
    workspace.discovery.runtimeLinks.find((link) => link.id === selectedRuntimeLinkId) ??
    workspace.discovery.runtimeLinks[0] ??
    null;
  const selectedCandidateTask =
    workspace.discovery.candidateTasks.find((task) => task.id === selectedCandidateTaskId) ??
    workspace.discovery.candidateTasks[0] ??
    null;
  const behavioralDiagramComponents =
    workspace.components.length > 0 ? workspace.components : workspace.discovery.candidateComponents;
  const behavioralDiagramNodeActions = behavioralDiagramComponents.map((component, index) => ({
    nodeId: getBehavioralComponentNodeId(component.id || component.name || "component", index),
    onClick: () =>
      setExpandedBehavioralComponentIds((current) =>
        current.includes(component.id)
          ? current.filter((id) => id !== component.id)
          : [...current, component.id],
      ),
  }));

  const updateTimestamp = (next: FeatureWorkspace): FeatureWorkspace => ({
    ...next,
    updatedAt: new Date().toISOString(),
  });

  const refreshSyncState = async () => {
    try {
      const inspection = await onInspectLlmSync(workspace, outputs.markdown);
      setSyncState(inspection.state);
      setSyncDirectoryName(inspection.directoryName);
      if (inspection.state === "files-changed" || inspection.state === "conflict") {
        setEditingOverrideEnabled(false);
      }
      return inspection;
    } catch {
      return null;
    }
  };

  const onChange = (updater: (current: FeatureWorkspace) => FeatureWorkspace) => {
    if (syncState === "files-changed" && !editingOverrideEnabled) {
      const shouldForceEdit = window.confirm(
        "Synced files changed outside ArchFlow and have not been pulled yet.\n\nPress OK to continue editing in ArchFlow anyway. This may overwrite those file changes when you sync.\n\nPress Cancel to pull or review the file changes first.",
      );
      if (!shouldForceEdit) {
        setSyncStatus("error");
        setSyncMessage("Pulled file changes are required before normal editing, unless you explicitly force ArchFlow to continue.");
        return;
      }
      setEditingOverrideEnabled(true);
      setSyncState("conflict");
      setSyncStatus("error");
      setSyncMessage("Editing continued in ArchFlow after external file changes. Resolve by pulling or force syncing one side.");
    }

    onWorkspaceChange(updater);
    if (syncState === "in-sync") {
      setSyncState("workspace-changed");
    } else if (syncState === "files-changed" && editingOverrideEnabled) {
      setSyncState("conflict");
    }
  };

  const syncLlmFiles = async () => {
    if (syncState === "files-changed" || syncState === "conflict") {
      const shouldForceSync = window.confirm(
        "The synced files changed outside ArchFlow.\n\nPress OK to force ArchFlow to overwrite the files.\nPress Cancel to keep the file version and pull changes instead.",
      );
      if (!shouldForceSync) {
        return;
      }
    }

    setSyncStatus("loading");
    setSyncMessage("Syncing workspace files...");
    try {
      await onSyncLlmFiles(workspace, outputs.markdown);
      setEditingOverrideEnabled(false);
      setSyncState("in-sync");
      setSyncStatus("success");
      setSyncMessage("Synced workspace JSON, markdown, AGENTS.md, and edit template.");
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(
        error instanceof Error ? error.message : "Could not sync workspace files.",
      );
    }
  };

  const pullLlmFiles = async () => {
    if (syncState === "workspace-changed" || syncState === "conflict") {
      const shouldPull = window.confirm(
        "ArchFlow has local changes that have not been synced yet.\n\nPress OK to pull the file version into this workspace and overwrite those local changes.\nPress Cancel to keep the ArchFlow version and sync it out instead.",
      );
      if (!shouldPull) {
        return;
      }
    }

    setSyncStatus("loading");
    setSyncMessage("Pulling changes from synced files...");
    try {
      const result = await onPullLlmFiles(workspace);
      setEditingOverrideEnabled(false);
      setSyncState("in-sync");
      const pulledKinds = [
        result.workspaceJson ? "JSON" : null,
        result.markdown ? "markdown" : null,
      ].filter(Boolean);
      setSyncStatus("success");
      setSyncMessage(
        `Pulled ${pulledKinds.join(" and ")} from ${result.directoryName}. ${
          result.markdown ? "Markdown updates override feature definition fields." : ""
        }`.trim(),
      );
      setActiveSection("featureDefinition");
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(
        error instanceof Error ? error.message : "Could not pull synced workspace files.",
      );
    }
  };

  useEffect(() => {
    void refreshSyncState();
  }, [workspace.id]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshSyncState();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [workspace.id]);

  useEffect(() => {
    if (
      selectedComponentId &&
      workspace.components.some((component) => component.id === selectedComponentId)
    ) {
      return;
    }

    setSelectedComponentId(workspace.components[0]?.id ?? null);
  }, [selectedComponentId, workspace.components]);

  useEffect(() => {
    if (!selectedComponent) {
      setSelectedComponentObjectId(null);
      return;
    }

    if (
      selectedComponentObjectId &&
      selectedComponent.objects.some((object) => object.id === selectedComponentObjectId)
    ) {
      return;
    }

    setSelectedComponentObjectId(selectedComponent.objects[0]?.id ?? null);
  }, [selectedComponent, selectedComponentObjectId]);

  useEffect(() => {
    if (
      selectedContextEntityId &&
      workspace.discovery.contextEntities.some((entity) => entity.id === selectedContextEntityId)
    ) {
      return;
    }

    setSelectedContextEntityId(workspace.discovery.contextEntities[0]?.id ?? null);
  }, [selectedContextEntityId, workspace.discovery.contextEntities]);

  useEffect(() => {
    if (
      selectedScenarioId &&
      workspace.discovery.sequenceScenarios.some((scenario) => scenario.id === selectedScenarioId)
    ) {
      return;
    }

    setSelectedScenarioId(workspace.discovery.sequenceScenarios[0]?.id ?? null);
  }, [selectedScenarioId, workspace.discovery.sequenceScenarios]);

  useEffect(() => {
    if (
      selectedInteractionIndex !== null &&
      workspace.discovery.interactions[selectedInteractionIndex]
    ) {
      return;
    }

    setSelectedInteractionIndex(
      workspace.discovery.interactions.length > 0 ? 0 : null,
    );
  }, [selectedInteractionIndex, workspace.discovery.interactions]);

  useEffect(() => {
    if (
      selectedDataFlowNodeId &&
      workspace.discovery.dataFlowNodes.some((node) => node.id === selectedDataFlowNodeId)
    ) {
      return;
    }

    setSelectedDataFlowNodeId(workspace.discovery.dataFlowNodes[0]?.id ?? null);
  }, [selectedDataFlowNodeId, workspace.discovery.dataFlowNodes]);

  useEffect(() => {
    if (
      selectedDataFlowId &&
      workspace.discovery.dataFlows.some((flow) => flow.id === selectedDataFlowId)
    ) {
      return;
    }

    setSelectedDataFlowId(workspace.discovery.dataFlows[0]?.id ?? null);
  }, [selectedDataFlowId, workspace.discovery.dataFlows]);

  useEffect(() => {
    if (
      selectedRuntimeNodeId &&
      workspace.discovery.runtimeNodes.some((node) => node.id === selectedRuntimeNodeId)
    ) {
      return;
    }

    setSelectedRuntimeNodeId(workspace.discovery.runtimeNodes[0]?.id ?? null);
  }, [selectedRuntimeNodeId, workspace.discovery.runtimeNodes]);

  useEffect(() => {
    if (
      selectedRuntimeLinkId &&
      workspace.discovery.runtimeLinks.some((link) => link.id === selectedRuntimeLinkId)
    ) {
      return;
    }

    setSelectedRuntimeLinkId(workspace.discovery.runtimeLinks[0]?.id ?? null);
  }, [selectedRuntimeLinkId, workspace.discovery.runtimeLinks]);

  useEffect(() => {
    if (
      selectedCandidateTaskId &&
      workspace.discovery.candidateTasks.some((task) => task.id === selectedCandidateTaskId)
    ) {
      return;
    }

    setSelectedCandidateTaskId(workspace.discovery.candidateTasks[0]?.id ?? null);
  }, [selectedCandidateTaskId, workspace.discovery.candidateTasks]);

  useEffect(() => {
    if (aiStatus !== "loading") {
      setAiElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const handle = window.setInterval(() => {
      setAiElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(handle);
  }, [aiStatus]);

  useEffect(() => {
    if (!selectedComponent && componentDetailOpen) {
      setComponentDetailOpen(false);
    }
  }, [componentDetailOpen, selectedComponent]);

  useEffect(() => {
    if (!selectedContextEntity && contextDetailOpen) {
      setContextDetailOpen(false);
    }
  }, [contextDetailOpen, selectedContextEntity]);

  useEffect(() => {
    if (!selectedScenario && scenarioDetailOpen) {
      setScenarioDetailOpen(false);
    }
  }, [scenarioDetailOpen, selectedScenario]);

  useEffect(() => {
    if (!selectedInteraction && interactionDetailOpen) {
      setInteractionDetailOpen(false);
    }
  }, [interactionDetailOpen, selectedInteraction]);

  useEffect(() => {
    if (!selectedDataFlowNode && dataFlowNodeDetailOpen) {
      setDataFlowNodeDetailOpen(false);
    }
  }, [dataFlowNodeDetailOpen, selectedDataFlowNode]);

  useEffect(() => {
    if (!selectedDataFlow && dataFlowDetailOpen) {
      setDataFlowDetailOpen(false);
    }
  }, [dataFlowDetailOpen, selectedDataFlow]);

  useEffect(() => {
    if (!selectedRuntimeNode && runtimeNodeDetailOpen) {
      setRuntimeNodeDetailOpen(false);
    }
  }, [runtimeNodeDetailOpen, selectedRuntimeNode]);

  useEffect(() => {
    if (!selectedRuntimeLink && runtimeLinkDetailOpen) {
      setRuntimeLinkDetailOpen(false);
    }
  }, [runtimeLinkDetailOpen, selectedRuntimeLink]);

  useEffect(() => {
    if (!selectedCandidateTask && candidateTaskDetailOpen) {
      setCandidateTaskDetailOpen(false);
    }
  }, [candidateTaskDetailOpen, selectedCandidateTask]);

  const canGenerateAiDraft = canGenerateDiscoveryDraft(workspace);
  const missingDiscoveryInputs = getMissingDiscoveryDraftInputs(workspace);
  const canGenerateDefinitionDraft = canGenerateDefinitionAssist(workspace);
  const workspaceChatScope: WorkspaceChatScope = {
    type: "workspace",
    label: workspace.title.trim() || "this feature design",
  };
  const workspaceChatKey = getWorkspaceChatScopeKey(workspaceChatScope);
  const workspaceChatState = chatByScope[workspaceChatKey] ?? createEmptyScopeChatState();
  const componentChatScope: WorkspaceChatScope | null = selectedComponent
    ? {
        type: "component",
        label: selectedComponent.name.trim() || "this component",
        componentId: selectedComponent.id,
      }
    : null;
  const componentChatState =
    componentChatScope != null
      ? chatByScope[getWorkspaceChatScopeKey(componentChatScope)] ?? createEmptyScopeChatState()
      : createEmptyScopeChatState();

  const namedInteractions = workspace.discovery.interactions.map((interaction) => ({
    fromComponentName:
      workspace.discovery.candidateComponents.find(
        (candidate) => candidate.id === interaction.fromComponentId,
      )?.name || "",
    toComponentName:
      workspace.discovery.candidateComponents.find(
        (candidate) => candidate.id === interaction.toComponentId,
      )?.name || "",
    mechanism: interaction.mechanism,
    data: interaction.data,
    notes: interaction.notes ?? "",
  }));

  const updateScopeChatState = (
    scopeKey: string,
    updater: (current: ScopeChatState) => ScopeChatState,
  ) => {
    setChatByScope((current) => ({
      ...current,
      [scopeKey]: updater(current[scopeKey] ?? createEmptyScopeChatState()),
    }));
  };

  const requestWorkspaceChat = async (
    payload: WorkspaceChatPayload,
  ): Promise<WorkspaceChatSuccessResponse> => {
    const response = await fetch("/api/ai/workspace-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as WorkspaceChatSuccessResponse | { error?: string };
    if (!response.ok || !("answer" in data)) {
      const errorMessage =
        "error" in data && typeof data.error === "string"
          ? data.error
          : "AI design chat failed.";
      throw new Error(errorMessage);
    }

    return data;
  };

  const askAiAboutScope = async (scope: WorkspaceChatScope) => {
    const scopeKey = getWorkspaceChatScopeKey(scope);
    const currentState = chatByScope[scopeKey] ?? createEmptyScopeChatState();
    const question = currentState.draft.trim();
    if (!question) {
      updateScopeChatState(scopeKey, (state) => ({
        ...state,
        status: "error",
        message: "Enter a question before asking AI.",
      }));
      return;
    }

    const userMessage: WorkspaceChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: "user",
      text: question,
      createdAt: new Date().toISOString(),
    };

    updateScopeChatState(scopeKey, (state) => ({
      ...state,
      draft: "",
      status: "loading",
      message: `Asking AI about ${scope.label}...`,
      messages: [...state.messages, userMessage],
    }));

    try {
      const data = await requestWorkspaceChat(
        buildWorkspaceChatPayload({
          workspace,
          scope,
          question,
          history: [...currentState.messages, userMessage],
        }),
      );

      const assistantMessage: WorkspaceChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "assistant",
        text: data.answer,
        createdAt: new Date().toISOString(),
      };

      updateScopeChatState(scopeKey, (state) => ({
        ...state,
        status: "idle",
        message: `Answered with ${data.provider}/${data.model} in ${Math.max(
          1,
          Math.round(data.durationMs / 1000),
        )}s.`,
        messages: [...state.messages, assistantMessage],
      }));
    } catch (error) {
      updateScopeChatState(scopeKey, (state) => ({
        ...state,
        status: "error",
        message: error instanceof Error ? error.message : "AI design chat failed.",
      }));
    }
  };

  const requestAiStage = async (
    stage: AiStage,
    payload: Record<string, unknown>,
  ): Promise<AiStageSuccessResponse> => {
    const response = await fetch("/api/ai/workspace-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as AiStageSuccessResponse | { error?: string };
    if (!response.ok || !("draft" in data)) {
      const errorMessage =
        "error" in data && typeof data.error === "string"
          ? data.error
          : `AI ${stage} draft generation failed.`;
      throw new Error(errorMessage);
    }

    return data;
  };

  const startAiRequest = (stage: AiStage, message: string) => {
    setAiStage(stage);
    setAiStatus("loading");
    setAiMessage(message);
  };

  const completeAiRequest = (
    message: string,
  ) => {
    setAiStatus("success");
    setAiMessage(message);
  };

  const importRequirementFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      onChange((current) =>
        updateTimestamp(applyImportedMarkdownToWorkspace(current, content, file.name)),
      );

      setActiveSection("featureDefinition");
      setImportStatus("success");
      setImportMessage(
        `Imported ${file.name}. Review the parsed title, requirement, constraints, and responsibilities before generating the AI draft.`,
      );
    } catch (error) {
      setImportStatus("error");
      setImportMessage(
        error instanceof Error ? error.message : "Could not import the markdown file.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const generateAiDraft = async () => {
    if (!canGenerateAiDraft || aiStatus === "loading") {
      return;
    }

    startAiRequest(
      "discovery",
      "Generating discovery draft from the current feature inputs...",
    );

    try {
      const data = await requestAiStage("discovery", {
        stage: "discovery",
        title: workspace.title,
        requirement: workspace.requirement,
        constraints: workspace.featureSummary.constraints,
        responsibilities: workspace.discovery.responsibilities,
      });

      const previousSelectedName = selectedComponent?.name.trim().toLowerCase() || "";
      const merged = updateTimestamp(
        mergeAiDiscoveryIntoWorkspace(workspace, data.draft as AiDiscoveryDraft),
      );
      const nextSelectedComponent =
        merged.components.find(
          (component) => component.name.trim().toLowerCase() === previousSelectedName,
        ) ?? merged.components[0] ?? null;

      onChange(() => merged);
      setSelectedComponentId(nextSelectedComponent?.id ?? null);
      completeAiRequest(
        `Discovery draft generated with ${data.provider}/${data.model} in ${Math.max(1, Math.round(data.durationMs / 1000))}s. Review the proposed architecture, then refine components individually.`,
      );
      if (merged.components.length > 0) {
        setActiveSection("featureDesign");
      }
    } catch (error) {
      setAiStatus("error");
      setAiMessage(
        error instanceof Error ? error.message : "AI discovery draft generation failed.",
      );
    }
  };

  const generateDefinitionAssist = async () => {
    if (!canGenerateDefinitionDraft || aiStatus === "loading") {
      return;
    }

    startAiRequest(
      "definition",
      "Drafting feature requirements and responsibilities from the feature summary...",
    );

    try {
      const data = await requestAiStage("definition", {
        stage: "definition",
        title: workspace.title,
        summary: workspace.featureSummary.summary,
        constraints: workspace.featureSummary.constraints,
        assumptions: workspace.featureSummary.assumptions,
        openQuestions: workspace.featureSummary.openQuestions,
      });

      const merged = updateTimestamp(
        mergeAiDefinitionIntoWorkspace(workspace, data.draft as AiDefinitionDraft),
      );
      onChange(() => merged);
      completeAiRequest(
        `Feature requirements and responsibilities drafted with ${data.provider}/${data.model} in ${Math.max(1, Math.round(data.durationMs / 1000))}s. Review and edit them before generating discovery.`,
      );
    } catch (error) {
      setAiStatus("error");
      setAiMessage(
        error instanceof Error
          ? error.message
          : "AI feature definition drafting failed.",
      );
    }
  };

  const refineComponentWithAi = async (
    componentToRefine: FeatureComponent | null,
  ) => {
    if (!componentToRefine || !canRefineComponentWithAi(workspace, componentToRefine.id)) {
      return;
    }

    startAiRequest(
      "component",
      `Refining ${componentToRefine.name || "selected component"} with AI...`,
    );

    try {
      const selectedCandidate =
        workspace.discovery.candidateComponents.find(
          (candidate) => candidate.id === componentToRefine.id,
        ) ?? null;
      const data = await requestAiStage("component", {
        stage: "component",
        title: workspace.title,
        requirement: workspace.requirement,
        constraints: workspace.featureSummary.constraints,
        responsibilities: workspace.discovery.responsibilities,
        selectedComponentName: componentToRefine.name,
        selectedComponentResponsibility:
          selectedCandidate?.responsibility || componentToRefine.summary,
        candidateComponents: workspace.discovery.candidateComponents,
        interactions: namedInteractions,
        systemRisks: workspace.discovery.systemRisks,
      });

      const merged = updateTimestamp(
        mergeAiComponentIntoWorkspace(
          workspace,
          componentToRefine.id,
          data.draft as AiComponentDraft,
        ),
      );
      onChange(() => merged);
      completeAiRequest(
        `Component draft for ${componentToRefine.name || "selected component"} generated with ${data.provider}/${data.model} in ${Math.max(1, Math.round(data.durationMs / 1000))}s.`,
      );
    } catch (error) {
      setAiStatus("error");
      setAiMessage(
        error instanceof Error ? error.message : "AI component refinement failed.",
      );
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <aside className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.25em] text-copper">Workspace Flow</p>
          <Button onClick={onBack} tone="ghost">
            Back
          </Button>
        </div>
        <div className="mt-4 rounded-2xl bg-ink p-4 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-sand/80">Progress</p>
          <p className="mt-2 text-3xl font-semibold">
            {Math.round((startedSections / WORKSPACE_SECTIONS.length) * 100)}%
          </p>
          <p className="mt-1 text-sm text-white/70">
            {startedSections} of {WORKSPACE_SECTIONS.length} workflow blocks started
          </p>
        </div>
        <nav className="mt-4 space-y-2">
          {WORKSPACE_SECTIONS.map((section) => {
            const active = section.id === activeSection;
            const started = isWorkspaceSectionStarted(workspace, section.id);

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-copper bg-sand"
                    : started
                      ? "border-pine/20 bg-mist/80"
                      : "border-transparent bg-transparent hover:bg-mist/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{section.label}</span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${started ? "bg-pine" : "bg-slate/30"}`}
                  />
                </div>
                <p className="mt-1 text-xs text-slate">{section.description}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-copper/80">
                  {section.stage}
                </p>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-copper">Feature Workspace</p>
            <h2 className="mt-2 text-2xl font-semibold">{workspace.title}</h2>
            <p className="mt-1 text-sm text-slate">
              Start by discovering what components the feature needs, then refine one component at a time.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {activeSection === "featureDefinition" ? (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="hidden"
                onChange={importRequirementFile}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => importInputRef.current?.click()} tone="secondary">
                  Import Requirement File
                </Button>
              </div>
              <Field label="Feature Name">
                <TextInput
                  value={workspace.title}
                  onChange={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        title: value,
                      }),
                    )
                  }
                />
              </Field>

              <Field label="Feature Summary">
                <TextArea
                  value={workspace.featureSummary.summary}
                  onChange={(value) =>
                    onChange((current) => ({
                      ...current,
                      featureSummary: { ...current.featureSummary, summary: value },
                    }))
                  }
                />
              </Field>
              <div className="space-y-3 rounded-2xl border border-slate/10 bg-mist/50 px-4 py-4 text-sm text-slate">
                <p className="font-medium text-ink">AI Feature Definition Assist</p>
                <p>
                  Use the current feature summary to draft a first pass of feature requirements and feature responsibilities that you can review and edit.
                </p>
                {aiStage === "definition" || aiStatus === "idle" ? (
                  <p
                    className={`text-xs ${
                      aiStatus === "error"
                        ? "text-red-700"
                        : aiStatus === "success"
                          ? "text-pine"
                          : "text-slate"
                    }`}
                  >
                    {aiMessage ||
                      (canGenerateDefinitionDraft
                        ? "Ready to draft feature requirements and responsibilities from the current feature summary."
                        : "Add a feature name and feature summary to enable the assistant.")}
                    {aiStatus === "loading" && aiStage === "definition"
                      ? ` ${aiElapsedSeconds}s elapsed.`
                      : ""}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={generateDefinitionAssist}
                    tone="secondary"
                    disabled={!canGenerateDefinitionDraft || aiStatus === "loading"}
                  >
                    {aiStatus === "loading" && aiStage === "definition"
                      ? "Drafting Requirements..."
                      : "Draft Requirements & Responsibilities"}
                  </Button>
                </div>
              </div>
            </>
          ) : activeSection === "featureDesign" || activeSection === "implementationMapping" ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onExportWorkspaceJson(workspace)} tone="secondary">
                Export Workspace JSON
              </Button>
            </div>
          ) : null}

          <WorkspaceSectionForm
            activeSection={activeSection}
            workspace={workspace}
            selectedComponent={selectedComponent}
            selectedComponentId={selectedComponentId}
            setSelectedComponentId={setSelectedComponentId}
            selectedContextEntityId={selectedContextEntityId}
            selectedScenario={selectedScenario}
            setSelectedScenarioId={setSelectedScenarioId}
            selectedInteractionIndex={selectedInteractionIndex}
            selectedDataFlowNodeId={selectedDataFlowNodeId}
            selectedDataFlowId={selectedDataFlowId}
            setSelectedDataFlowNodeId={setSelectedDataFlowNodeId}
            setSelectedDataFlowId={setSelectedDataFlowId}
            selectedRuntimeNodeId={selectedRuntimeNodeId}
            selectedRuntimeLinkId={selectedRuntimeLinkId}
            selectedCandidateTaskId={selectedCandidateTaskId}
            onOpenComponentDetail={(componentId, mode = "container") => {
              setSelectedComponentId(componentId);
              const component =
                workspace.components.find((item) => item.id === componentId) ?? null;
              setSelectedComponentObjectId(component?.objects[0]?.id ?? null);
              setComponentDetailMode(mode);
              setComponentDetailOpen(true);
            }}
            onOpenContextDetail={(entityId) => {
              setSelectedContextEntityId(entityId);
              setContextDetailOpen(true);
            }}
            onOpenScenarioDetail={(scenarioId) => {
              setSelectedScenarioId(scenarioId);
              setScenarioDetailOpen(true);
            }}
            onOpenInteractionDetail={(interactionIndex) => {
              setSelectedInteractionIndex(interactionIndex);
              setInteractionDetailOpen(true);
            }}
            onOpenDataFlowNodeDetail={(nodeId) => {
              setSelectedDataFlowNodeId(nodeId);
              setDataFlowNodeDetailOpen(true);
            }}
            onOpenDataFlowDetail={(flowId) => {
              setSelectedDataFlowId(flowId);
              setDataFlowDetailOpen(true);
            }}
            onOpenRuntimeNodeDetail={(nodeId) => {
              setSelectedRuntimeNodeId(nodeId);
              setRuntimeNodeDetailOpen(true);
            }}
            onOpenRuntimeLinkDetail={(linkId) => {
              setSelectedRuntimeLinkId(linkId);
              setRuntimeLinkDetailOpen(true);
            }}
            onOpenCandidateTaskDetail={(taskId) => {
              setSelectedCandidateTaskId(taskId);
              setCandidateTaskDetailOpen(true);
            }}
            canGenerateAiDraft={canGenerateAiDraft}
            missingDiscoveryInputs={missingDiscoveryInputs}
            aiStatus={aiStatus}
            aiStage={aiStage}
            aiMessage={aiMessage}
            aiElapsedSeconds={aiElapsedSeconds}
            importStatus={importStatus}
            importMessage={importMessage}
            onGenerateAiDraft={generateAiDraft}
            onRefineComponentWithAi={refineComponentWithAi}
            onChange={(updater) => onChange((current) => updateTimestamp(updater(current)))}
          />
        </div>
      </section>

      {componentDetailOpen && selectedComponent ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Component Detail</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedComponent.name || "Unnamed component"}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this component in a focused page with more room for its states, events, ownership, failures, and debugging design.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={async () => {
                    await refineComponentWithAi(selectedComponent);
                  }}
                  tone="primary"
                  disabled={
                    !canRefineComponentWithAi(workspace, selectedComponent.id) ||
                    (aiStatus === "loading" && aiStage === "component")
                  }
                >
                  {aiStatus === "loading" && aiStage === "component"
                    ? "Refining Component..."
                    : "Refine With AI"}
                </Button>
                <Button onClick={() => setComponentDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                {componentDetailMode === "container" ? (
                  <PreviewCard
                    title="Behavioral Architecture Context"
                    action={
                      <ComponentOverlayDiagramButton
                        title="Behavioral Architecture Context"
                        chart={outputs.behavioralArchitectureDiagram}
                      />
                    }
                  >
                    <MermaidPreview
                      title={`${selectedComponent.name || "Component"} Behavioral Context`}
                      chart={outputs.behavioralArchitectureDiagram}
                      svgMode="natural"
                      className="min-h-[420px]"
                    />
                  </PreviewCard>
                ) : null}
                {componentDetailMode === "state" ? (
                  <PreviewCard
                    title="Internal Object Diagram"
                    action={
                      <ComponentOverlayDiagramButton
                        title="Internal Object Diagram"
                        chart={outputs.componentObjectDiagram}
                      />
                    }
                  >
                    <MermaidPreview
                      title={`${selectedComponent.name || "Component"} Internal Objects`}
                      chart={outputs.componentObjectDiagram}
                      svgMode="natural"
                      className="min-h-[360px]"
                    />
                  </PreviewCard>
                ) : null}
                {componentDetailMode === "state" ? (
                  <PreviewCard
                    title="Selected Object State Diagram"
                    action={
                      <ComponentOverlayDiagramButton
                        title="Selected Object State Diagram"
                        chart={outputs.componentStateDiagram}
                      />
                    }
                  >
                    <MermaidPreview
                      title={`${selectedComponentObject?.name || selectedComponent.name || "Object"} State Diagram`}
                      chart={outputs.componentStateDiagram}
                      svgMode="natural"
                      className="min-h-[420px]"
                    />
                  </PreviewCard>
                ) : null}
              </div>
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                {componentDetailMode === "state" ? (
                  <ComponentStateEditor
                    component={selectedComponent}
                    selectedObjectId={selectedComponentObjectId}
                    onSelectObject={setSelectedComponentObjectId}
                    onChange={(nextComponent) =>
                      onChange((current) =>
                        updateTimestamp({
                          ...current,
                          components: current.components.map((component) =>
                            component.id === nextComponent.id ? nextComponent : component,
                          ),
                        }),
                      )
                    }
                  />
                ) : (
                  <ComponentContainerEditor
                    component={selectedComponent}
                    candidate={selectedCandidateComponent}
                    onChange={(nextComponent, nextCandidate) =>
                      onChange((current) =>
                        updateTimestamp({
                          ...current,
                          discovery: {
                            ...current.discovery,
                            candidateComponents: nextCandidate
                              ? current.discovery.candidateComponents.map((candidate) =>
                                  candidate.id === nextCandidate.id ? nextCandidate : candidate,
                                )
                              : current.discovery.candidateComponents,
                          },
                          components: current.components.map((component) =>
                            component.id === nextComponent.id ? nextComponent : component,
                          ),
                        }),
                      )
                    }
                  />
                )}
                {componentChatScope ? (
                  <FloatingChatDock
                    title="Ask AI About This Component"
                    description="Use the selected component, its states, interactions, and nearby design context to clarify or review this component."
                    inputValue={componentChatState.draft}
                    onInputChange={(value) =>
                      updateScopeChatState(getWorkspaceChatScopeKey(componentChatScope), (state) => ({
                        ...state,
                        draft: value,
                        status: state.status === "error" ? "idle" : state.status,
                        message: state.status === "error" ? "" : state.message,
                      }))
                    }
                    onAsk={() => {
                      void askAiAboutScope(componentChatScope);
                    }}
                    status={componentChatState.status}
                    statusMessage={componentChatState.message}
                    messages={componentChatState.messages}
                    defaultOpen={false}
                    zIndexClass="z-[55]"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {contextDetailOpen && selectedContextEntity ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1100px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Context Detail</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedContextEntity.name || "Unnamed context entity"}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this external entity and the boundary flows that connect it to the feature.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setContextDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Context Diagram"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Context Diagram"
                      chart={outputs.contextDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${selectedContextEntity.name || "Context"} Diagram`}
                    chart={outputs.contextDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <ContextEntityDetailEditor
                  entity={selectedContextEntity}
                  flows={workspace.discovery.contextFlows.filter(
                    (flow) => flow.entityId === selectedContextEntity.id,
                  )}
                  customKinds={workspace.discovery.customOptions.contextEntityKinds}
                  onAddCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          customOptions: {
                            ...current.discovery.customOptions,
                            contextEntityKinds: appendUniqueOption(
                              current.discovery.customOptions.contextEntityKinds,
                              value,
                              CONTEXT_ENTITY_TYPE_OPTIONS,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onRemoveCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          contextEntities: current.discovery.contextEntities.map((entity) =>
                            entity.kind === value ? { ...entity, kind: "other" } : entity,
                          ),
                          customOptions: {
                            ...current.discovery.customOptions,
                            contextEntityKinds: removeOptionValue(
                              current.discovery.customOptions.contextEntityKinds,
                              value,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onChange={(nextEntity, nextFlows) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          contextEntities: current.discovery.contextEntities.map((entity) =>
                            entity.id === nextEntity.id ? nextEntity : entity,
                          ),
                          contextFlows: [
                            ...current.discovery.contextFlows.filter(
                              (flow) => flow.entityId !== nextEntity.id,
                            ),
                            ...nextFlows,
                          ],
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {scenarioDetailOpen && selectedScenario ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Runtime Scenario</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedScenario.name || "Unnamed scenario"}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this runtime scenario in a focused page with more room for participants, ordered steps, and the generated sequence view.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setScenarioDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Selected Sequence Diagram"
                  action={
                    <ComponentOverlayDiagramButton
                      title={selectedScenario.name || "Selected Sequence Diagram"}
                      chart={outputs.sequenceDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${selectedScenario.name || "Scenario"} Sequence Diagram`}
                    chart={outputs.sequenceDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <SequenceScenarioDetailEditor
                  scenario={selectedScenario}
                  onChange={(nextScenario) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          sequenceScenarios: current.discovery.sequenceScenarios.map((scenario) =>
                            scenario.id === nextScenario.id ? nextScenario : scenario,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {interactionDetailOpen && selectedInteraction ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Interaction Detail</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {formatInteractionName(workspace, selectedInteraction)}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this interaction in a focused page with more room for its direction, mechanism, data, and notes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setInteractionDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Interaction Diagram Context"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Feature Architecture Flowchart"
                      chart={outputs.architectureFlowchart}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${formatInteractionName(workspace, selectedInteraction)} Context`}
                    chart={outputs.architectureFlowchart}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <InteractionDetailEditor
                  interaction={selectedInteraction}
                  components={workspace.discovery.candidateComponents}
                  customMechanisms={workspace.discovery.customOptions.interactionMechanisms}
                  onAddCustomMechanism={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          customOptions: {
                            ...current.discovery.customOptions,
                            interactionMechanisms: appendUniqueOption(
                              current.discovery.customOptions.interactionMechanisms,
                              value,
                              INTERACTION_MECHANISM_OPTIONS,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onRemoveCustomMechanism={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          interactions: current.discovery.interactions.map((interaction) =>
                            interaction.mechanism === value
                              ? { ...interaction, mechanism: "other" }
                              : interaction,
                          ),
                          customOptions: {
                            ...current.discovery.customOptions,
                            interactionMechanisms: removeOptionValue(
                              current.discovery.customOptions.interactionMechanisms,
                              value,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onChange={(nextInteraction) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          interactions: current.discovery.interactions.map((interaction, index) =>
                            index === selectedInteractionIndex ? nextInteraction : interaction,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {dataFlowNodeDetailOpen && selectedDataFlowNode ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Data Flow Node Detail</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedDataFlowNode.name || "Unnamed data flow node"}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this DFD node in a focused page with more room for its node type and descriptive role in the data path.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setDataFlowNodeDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Data Flow Diagram"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Data Flow Diagram"
                      chart={outputs.dataFlowDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${selectedDataFlowNode.name || "Data Flow Node"} Diagram`}
                    chart={outputs.dataFlowDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <DataFlowNodeDetailEditor
                  node={selectedDataFlowNode}
                  customKinds={workspace.discovery.customOptions.dataFlowNodeKinds}
                  onAddCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          customOptions: {
                            ...current.discovery.customOptions,
                            dataFlowNodeKinds: appendUniqueOption(
                              current.discovery.customOptions.dataFlowNodeKinds,
                              value,
                              DATA_FLOW_NODE_TYPE_OPTIONS,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onRemoveCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          dataFlowNodes: current.discovery.dataFlowNodes.map((node) =>
                            node.kind === value ? { ...node, kind: "other" } : node,
                          ),
                          customOptions: {
                            ...current.discovery.customOptions,
                            dataFlowNodeKinds: removeOptionValue(
                              current.discovery.customOptions.dataFlowNodeKinds,
                              value,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onChange={(nextNode) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          dataFlowNodes: current.discovery.dataFlowNodes.map((node) =>
                            node.id === nextNode.id ? nextNode : node,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {dataFlowDetailOpen && selectedDataFlow ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Data Flow Detail</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {formatDataFlowName(workspace, selectedDataFlow)}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this data flow in a focused page with more room for its endpoints, payload label, and transformation notes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setDataFlowDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Data Flow Diagram"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Data Flow Diagram"
                      chart={outputs.dataFlowDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${formatDataFlowName(workspace, selectedDataFlow)} Diagram`}
                    chart={outputs.dataFlowDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <DataFlowDetailEditor
                  flow={selectedDataFlow}
                  nodes={workspace.discovery.dataFlowNodes}
                  onChange={(nextFlow) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          dataFlows: current.discovery.dataFlows.map((flow) =>
                            flow.id === nextFlow.id ? nextFlow : flow,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {runtimeNodeDetailOpen && selectedRuntimeNode ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Runtime Node</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedRuntimeNode.name || "Unnamed runtime node"}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this runtime node in a focused page with more room for execution placement and ownership notes.
                </p>
              </div>
              <Button onClick={() => setRuntimeNodeDetailOpen(false)} tone="ghost">
                Close
              </Button>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Deployment / Runtime Context"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Deployment / Runtime Diagram"
                      chart={outputs.deploymentRuntimeDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${selectedRuntimeNode.name || "Runtime Node"} Context`}
                    chart={outputs.deploymentRuntimeDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <RuntimeNodeDetailEditor
                  node={selectedRuntimeNode}
                  nodes={workspace.discovery.runtimeNodes}
                  customKinds={workspace.discovery.customOptions.runtimeNodeKinds}
                  onAddCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          customOptions: {
                            ...current.discovery.customOptions,
                            runtimeNodeKinds: appendUniqueOption(
                              current.discovery.customOptions.runtimeNodeKinds,
                              value,
                              RUNTIME_NODE_TYPE_OPTIONS,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onRemoveCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          runtimeNodes: current.discovery.runtimeNodes.map((node) =>
                            node.kind === value ? { ...node, kind: "other" } : node,
                          ),
                          customOptions: {
                            ...current.discovery.customOptions,
                            runtimeNodeKinds: removeOptionValue(
                              current.discovery.customOptions.runtimeNodeKinds,
                              value,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onChange={(nextNode) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          runtimeNodes: current.discovery.runtimeNodes.map((node) =>
                            node.id === nextNode.id ? nextNode : node,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {runtimeLinkDetailOpen && selectedRuntimeLink ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Runtime Link</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {formatRuntimeLinkName(workspace, selectedRuntimeLink)}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this runtime connection in a focused page with more room for link type, label, and scheduling notes.
                </p>
              </div>
              <Button onClick={() => setRuntimeLinkDetailOpen(false)} tone="ghost">
                Close
              </Button>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Deployment / Runtime Context"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Deployment / Runtime Diagram"
                      chart={outputs.deploymentRuntimeDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${formatRuntimeLinkName(workspace, selectedRuntimeLink)} Context`}
                    chart={outputs.deploymentRuntimeDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <RuntimeLinkDetailEditor
                  link={selectedRuntimeLink}
                  nodes={workspace.discovery.runtimeNodes}
                  customKinds={workspace.discovery.customOptions.runtimeLinkKinds}
                  onAddCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          customOptions: {
                            ...current.discovery.customOptions,
                            runtimeLinkKinds: appendUniqueOption(
                              current.discovery.customOptions.runtimeLinkKinds,
                              value,
                              RUNTIME_LINK_TYPE_OPTIONS,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onRemoveCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          runtimeLinks: current.discovery.runtimeLinks.map((link) =>
                            link.kind === value ? { ...link, kind: "other" } : link,
                          ),
                          customOptions: {
                            ...current.discovery.customOptions,
                            runtimeLinkKinds: removeOptionValue(
                              current.discovery.customOptions.runtimeLinkKinds,
                              value,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onChange={(nextLink) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          runtimeLinks: current.discovery.runtimeLinks.map((link) =>
                            link.id === nextLink.id ? nextLink : link,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === "featureDefinition" ? (
        <section className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.25em] text-copper">Generated Outputs</p>
          <h2 className="mt-2 text-2xl font-semibold">Feature Requirement Markdown</h2>
          <div className="mt-5">
            <PreviewCard
              title="Feature Requirement Markdown"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => onExport(outputs.markdown, workspace.title)}>
                    Export Requirement Markdown
                  </Button>
                </div>
              }
            >
              <pre className="max-h-[420px] overflow-auto rounded-2xl bg-ink p-4 text-xs text-white">
                {outputs.markdown}
              </pre>
            </PreviewCard>
          </div>
        </section>
      ) : null}

      {activeSection === "featureDesign" ? (
        <section className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.25em] text-copper">Generated Outputs</p>
          <h2 className="mt-2 text-2xl font-semibold">Live Diagrams</h2>
          <div className="mt-2 rounded-2xl bg-mist px-4 py-3 text-sm text-slate">
            {selectedComponent
              ? `Component state preview is currently focused on "${selectedComponent.name || "Selected Component"}".`
              : "No component selected yet. Add candidate components to refine the design."}
          </div>
          <div className="mt-5 space-y-5">
            <DiagramPreviewCard
              title="Context Diagram"
              chart={outputs.contextDiagram}
              previewTitle="Context Diagram"
              expandedTitle="Context Diagram"
              previewDefaultHeight={360}
              previewMinWidth="min-w-[860px]"
              expandedMinWidth="min-w-[1300px]"
            />
            <DiagramPreviewCard
              title="Feature Architecture Flowchart"
              chart={outputs.architectureFlowchart}
              previewTitle="Architecture Flowchart"
              expandedTitle="Feature Architecture Flowchart"
              previewDefaultHeight={420}
              previewMinWidth="min-w-[980px]"
              expandedMinWidth="min-w-[1400px]"
            />
            <DiagramPreviewCard
              title="Data Flow Diagram"
              chart={outputs.dataFlowDiagram}
              previewTitle="Data Flow Diagram"
              expandedTitle="Data Flow Diagram"
              previewDefaultHeight={400}
              previewMinWidth="min-w-[980px]"
              expandedMinWidth="min-w-[1400px]"
            />
            <DiagramPreviewCard
              title="Behavioral Architecture Diagram"
              chart={outputs.behavioralArchitectureDiagram}
              previewTitle="Behavioral Architecture Diagram"
              expandedTitle="Behavioral Architecture Diagram"
              previewDefaultHeight={460}
              previewMinWidth="min-w-[1100px]"
              expandedMinWidth="min-w-[1600px]"
              nodeActions={behavioralDiagramNodeActions}
            />
            <DiagramPreviewCard
              title="Selected Component Internal Object Diagram"
              chart={outputs.componentObjectDiagram}
              previewTitle="Internal Object Diagram"
              expandedTitle="Selected Component Internal Object Diagram"
              previewDefaultHeight={360}
              previewMinWidth="min-w-[900px]"
              expandedMinWidth="min-w-[1300px]"
            />
            <DiagramPreviewCard
              title="Selected Object State Diagram"
              chart={outputs.componentStateDiagram}
              previewTitle="Object State Diagram"
              expandedTitle="Selected Object State Diagram"
              previewDefaultHeight={360}
              previewMinWidth="min-w-[820px]"
              expandedMinWidth="min-w-[1200px]"
            />
            <DiagramPreviewCard
              title={selectedScenario ? `Sequence Diagram: ${selectedScenario.name || "Selected Scenario"}` : "Sequence Diagram"}
              chart={outputs.sequenceDiagram}
              previewTitle="Sequence Diagram"
              expandedTitle={selectedScenario ? `Sequence Diagram: ${selectedScenario.name || "Selected Scenario"}` : "Sequence Diagram"}
              previewDefaultHeight={360}
              previewMinWidth="min-w-[980px]"
              expandedMinWidth="min-w-[1400px]"
            />
            <DiagramPreviewCard
              title="Deployment / Runtime Diagram"
              chart={outputs.deploymentRuntimeDiagram}
              previewTitle="Deployment / Runtime Diagram"
              expandedTitle="Deployment / Runtime Diagram"
              previewDefaultHeight={380}
              previewMinWidth="min-w-[980px]"
              expandedMinWidth="min-w-[1400px]"
            />
            <FloatingChatDock
              title="Ask AI About This Design"
              description="Use the current workspace context to clarify architecture choices, tradeoffs, and missing design details."
              inputValue={workspaceChatState.draft}
              onInputChange={(value) =>
                updateScopeChatState(workspaceChatKey, (state) => ({
                  ...state,
                  draft: value,
                  status: state.status === "error" ? "idle" : state.status,
                  message: state.status === "error" ? "" : state.message,
                }))
              }
              onAsk={() => {
                void askAiAboutScope(workspaceChatScope);
              }}
              status={workspaceChatState.status}
              statusMessage={workspaceChatState.message}
              messages={workspaceChatState.messages}
              defaultOpen={false}
              zIndexClass="z-30"
            />
          </div>
        </section>
      ) : null}

      {activeSection === "implementationMapping" ? (
        <section className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.25em] text-copper">Generated Outputs</p>
          <h2 className="mt-2 text-2xl font-semibold">Implementation View</h2>
          <div className="mt-5 space-y-5">
            <DiagramPreviewCard
              title="Implementation Interface Diagram"
              chart={outputs.implementationInterfaceDiagram}
              previewTitle="Implementation Interface Diagram"
              expandedTitle="Implementation Interface Diagram"
              previewDefaultHeight={420}
              previewMinWidth="min-w-[1100px]"
              expandedMinWidth="min-w-[1500px]"
            />
            <DiagramPreviewCard
              title="Deployment / Runtime Diagram"
              chart={outputs.deploymentRuntimeDiagram}
              previewTitle="Deployment / Runtime Diagram"
              expandedTitle="Deployment / Runtime Diagram"
              previewDefaultHeight={380}
              previewMinWidth="min-w-[980px]"
              expandedMinWidth="min-w-[1400px]"
            />
            <PreviewCard title="Candidate Task Summary">
              <pre className="max-h-[320px] overflow-auto rounded-2xl bg-ink p-4 text-xs text-white">
                {outputs.taskTable}
              </pre>
            </PreviewCard>
            <PreviewCard title="Implementation Mapping Outline">
              <pre className="max-h-[520px] overflow-auto rounded-2xl bg-ink p-4 text-xs text-white">
                {outputs.implementationOutline}
              </pre>
            </PreviewCard>
            <PreviewCard
              title="RP2040 / Pico Starter Project"
              action={
                <Button
                  onClick={async () => {
                    try {
                      await onExportPicoStarterProject(
                        workspace,
                        outputs.picoStarterProjectFiles,
                      );
                    } catch (error) {
                      window.alert(
                        error instanceof Error
                          ? error.message
                          : "Could not export the Pico starter project.",
                      );
                    }
                  }}
                  tone="secondary"
                >
                  Export Ready Project
                </Button>
              }
            >
              <p className="mb-3 text-sm text-slate">
                Write a ready-to-build RP2040 / Pico SDK scaffold into a folder on your
                machine, based on the current implementation mapping.
              </p>
              <pre className="max-h-[720px] overflow-auto rounded-2xl bg-ink p-4 text-xs text-white">
                {outputs.picoStarterProjectBundle}
              </pre>
            </PreviewCard>
          </div>
        </section>
      ) : null}

      {candidateTaskDetailOpen && selectedCandidateTask ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Candidate Task Detail</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedCandidateTask.name || "Unnamed candidate task"}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this candidate execution unit in a focused page with more room for trigger, priority, blocking, and task notes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setCandidateTaskDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Deployment / Runtime Diagram"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Deployment / Runtime Diagram"
                      chart={outputs.deploymentRuntimeDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${selectedCandidateTask.name || "Candidate Task"} Runtime Context`}
                    chart={outputs.deploymentRuntimeDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <CandidateTaskDetailEditor
                  task={selectedCandidateTask}
                  onChange={(nextTask) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          candidateTasks: current.discovery.candidateTasks.map((task) =>
                            task.id === nextTask.id ? nextTask : task,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-5 left-5 z-30 w-[min(250px,calc(100vw-2.5rem))] rounded-[20px] border border-white/70 bg-white/95 p-3 shadow-panel backdrop-blur">
        <p className="text-[10px] uppercase tracking-[0.18em] text-copper">LLM Sync</p>
        <p className="mt-1 text-xs text-slate">
          Keep the same design files updated for Codex or another LLM.
        </p>
        <p className="mt-2 text-[11px] font-medium text-ink">
          {syncStateLabels[syncState]}
          {syncDirectoryName ? ` • ${syncDirectoryName}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={() => void syncLlmFiles()} tone="primary" disabled={syncStatus === "loading"}>
            {syncStatus === "loading" ? "Syncing Files..." : "Sync LLM Files"}
          </Button>
          <Button onClick={() => void pullLlmFiles()} tone="secondary" disabled={syncStatus === "loading"}>
            {syncStatus === "loading" ? "Working..." : "Pull Synced Files"}
          </Button>
          <Button onClick={() => void refreshSyncState()} tone="secondary" size="compact" disabled={syncStatus === "loading"}>
            Refresh
          </Button>
        </div>
        {syncMessage ? (
          <p
            className={`mt-2 text-[11px] ${
              syncStatus === "error"
                ? "text-red-700"
                : syncStatus === "success"
                  ? "text-pine"
                  : "text-slate"
            }`}
          >
            {syncMessage}
          </p>
        ) : null}
      </div>

    </div>
  );
};

const DesignChatPanel = ({
  title,
  description,
  inputValue,
  onInputChange,
  onAsk,
  status,
  statusMessage,
  messages,
  disabled,
  showHeader = true,
}: {
  title: string;
  description: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onAsk: () => void;
  status: "idle" | "loading" | "error";
  statusMessage: string;
  messages: WorkspaceChatMessage[];
  disabled?: boolean;
  showHeader?: boolean;
}) => {
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!messagesRef.current) {
      return;
    }

    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    if (status !== "idle" || !composerRef.current) {
      return;
    }

    composerRef.current.focus();
  }, [status]);

  const handleSubmit = () => {
    if (disabled || status === "loading" || !inputValue.trim()) {
      return;
    }

    onAsk();
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-copper">Design Chat</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-sm text-slate">{description}</p>
          </div>
        </div>
      ) : null}
      <div
        ref={messagesRef}
        className={`${showHeader ? "mt-4" : ""} min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden rounded-2xl bg-mist/45 p-3`}
      >
        {messages.length > 0 ? (
          messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl border px-3 py-2 text-sm ${
                message.role === "user"
                  ? "ml-6 border-copper/20 bg-sand/80 text-ink"
                  : "mr-6 border-slate/10 bg-white text-ink"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate/70">
                {message.role === "user" ? "You" : "AI"}
              </p>
              <div className="mt-1">
                <ChatMessageContent text={message.text} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate">
            No chat yet. Start with a focused question about this design scope.
          </p>
        )}
        {status === "loading" ? (
          <div className="mr-6 rounded-2xl border border-slate/10 bg-white px-3 py-2 text-sm text-ink">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate/70">
              AI
            </p>
            <p className="mt-1">Thinking...</p>
          </div>
        ) : null}
      </div>
      <div className="mt-4 space-y-2 rounded-2xl border border-slate/10 bg-mist/60 p-3">
        <textarea
          ref={composerRef}
          className="min-h-[44px] w-full resize-none overflow-hidden rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
          value={inputValue}
          rows={2}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ask a design question. Press Enter to send, Shift+Enter for a new line."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className={`text-xs ${
              status === "error"
                ? "text-red-700"
                : status === "loading"
                  ? "text-slate"
                  : "text-pine"
            }`}
          >
            {statusMessage ||
              "Ask about gaps, tradeoffs, state ownership, runtime split, or design clarity."}
          </p>
          <Button
            onClick={handleSubmit}
            tone="primary"
            disabled={disabled || status === "loading" || !inputValue.trim()}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

const renderInlineCode = (text: string) => {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code
        key={`${part}-${index}`}
        className="rounded bg-ink/6 px-1.5 py-0.5 font-mono text-[0.92em] text-ink"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
};

const ChatMarkdownBlock = ({ text }: { text: string }) => {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    elements.push(
      <p key={`p-${elements.length}`} className="whitespace-pre-wrap leading-6">
        {renderInlineCode(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    elements.push(
      <ul key={`ul-${elements.length}`} className="list-disc space-y-1 pl-5 leading-6">
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineCode(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      const level = trimmed.match(/^#+/)?.[0].length ?? 1;
      const headingClass =
        level === 1
          ? "text-base font-semibold text-ink"
          : level === 2
            ? "text-sm font-semibold text-ink"
            : "text-sm font-medium text-ink";
      elements.push(
        <p key={`h-${elements.length}`} className={headingClass}>
          {renderInlineCode(trimmed.replace(/^#{1,3}\s+/, ""))}
        </p>,
      );
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }

    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();

  return <div className="space-y-2">{elements}</div>;
};

const ChatMessageContent = ({ text }: { text: string }) => {
  const segments = text.split(/```([\w-]+)?\n?([\s\S]*?)```/g);
  if (segments.length === 1) {
    return <ChatMarkdownBlock text={text} />;
  }

  const rendered: ReactNode[] = [];
  for (let index = 0; index < segments.length; ) {
    if (index % 3 === 0) {
      const markdown = segments[index];
      if (markdown.trim()) {
        rendered.push(
          <ChatMarkdownBlock key={`md-${index}`} text={markdown} />,
        );
      }
      index += 1;
      continue;
    }

    const language = segments[index] || "text";
    const code = segments[index + 1] || "";
    rendered.push(
      <div key={`code-${index}`} className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate/70">
          {language}
        </p>
        <pre className="max-h-[280px] overflow-auto rounded-xl bg-ink p-3 text-xs leading-6 text-white">
          <code>{code.trim()}</code>
        </pre>
      </div>,
    );
    index += 2;
  }

  return <div className="space-y-3">{rendered}</div>;
};

const FloatingChatDock = ({
  title,
  description,
  inputValue,
  onInputChange,
  onAsk,
  status,
  statusMessage,
  messages,
  disabled,
  defaultOpen = false,
  zIndexClass = "z-40",
}: {
  title: string;
  description: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onAsk: () => void;
  status: "idle" | "loading" | "error";
  statusMessage: string;
  messages: WorkspaceChatMessage[];
  disabled?: boolean;
  defaultOpen?: boolean;
  zIndexClass?: string;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return open ? (
    <div
      className={`fixed bottom-5 right-5 ${zIndexClass} h-[min(720px,calc(100vh-2.5rem))] w-[min(440px,calc(100vw-1.5rem))]`}
    >
      <div className="flex h-full min-h-0 flex-col rounded-[32px] border border-white/80 bg-white/95 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-slate/10 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-copper">Design Chat</p>
            <p className="mt-1 text-sm font-semibold text-ink">{title}</p>
          </div>
          <button
            type="button"
            aria-label="Minimize chat"
            title="Minimize chat"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate/20 bg-white text-lg font-semibold leading-none text-slate transition hover:border-copper/35 hover:bg-sand"
          >
            -
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <DesignChatPanel
            title={title}
            description={description}
            inputValue={inputValue}
            onInputChange={onInputChange}
            onAsk={onAsk}
            status={status}
            statusMessage={statusMessage}
            messages={messages}
            disabled={disabled}
            showHeader={false}
          />
        </div>
      </div>
    </div>
  ) : (
    <div className={`fixed bottom-5 right-5 ${zIndexClass}`}>
      <Button onClick={() => setOpen(true)} tone="primary">
        Open Design Chat
      </Button>
    </div>
  );
};

const ComponentOverlayDiagramButton = ({
  title,
  chart,
}: {
  title: string;
  chart: string;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Button onClick={() => setExpanded(true)} tone="secondary">
        Open Large View
      </Button>
      {expanded ? (
        <div className="fixed inset-0 z-[60] bg-ink/75 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[96vw] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Expanded Diagram</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">{title}</h3>
              </div>
              <Button onClick={() => setExpanded(false)} tone="ghost">
                Close
              </Button>
            </div>
            <div className="mt-4 flex-1 overflow-auto rounded-2xl bg-mist/60 p-3">
              <MermaidPreview
                title={`${title} Expanded`}
                chart={chart}
                svgMode="natural"
                className="min-h-full min-w-[1800px]"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const PreviewCard = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <article className="space-y-3 rounded-2xl border border-slate/10 bg-white/75 p-4">
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate">{title}</h3>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    {children}
  </article>
);

const BehavioralArchitectureCanvas = ({
  workspace,
  selectedComponentId,
  expandedComponentIds,
  onToggleComponent,
  large = false,
}: {
  workspace: FeatureWorkspace;
  selectedComponentId: string | null;
  expandedComponentIds: string[];
  onToggleComponent: (componentId: string) => void;
  large?: boolean;
}) => {
  const components =
    workspace.components.length > 0
      ? workspace.components
      : workspace.discovery.candidateComponents.map((candidate) => ({
          ...createEmptyComponent(candidate),
          summary: candidate.responsibility,
        }));
  const componentNameById = new Map(components.map((component) => [component.id, component.name]));

  return (
    <div className={`rounded-2xl bg-white p-4 ${large ? "min-h-full" : "min-h-[420px]"}`}>
      <div className="space-y-4">
        {workspace.discovery.contextEntities.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {workspace.discovery.contextEntities.slice(0, 6).map((entity) => (
              <div
                key={entity.id}
                className="rounded-full border border-slate/15 bg-mist px-3 py-1 text-xs font-medium text-slate"
              >
                {entity.name || "Unnamed entity"}
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {components.map((component) => {
            const expanded = expandedComponentIds.includes(component.id);
            const selected = selectedComponentId === component.id;
            const activeObjects = component.objects.filter(
              (object) => object.objectType === "active",
            ).length;
            const statefulObjects = component.objects.filter((object) => object.needsState).length;

            return (
              <div
                key={component.id}
                className={`rounded-2xl border p-4 transition ${
                  selected
                    ? "border-copper bg-sand/65 shadow-sm"
                    : "border-slate/15 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleComponent(component.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-ink">
                        {component.name || "Unnamed component"}
                      </p>
                      <p className="mt-1 text-sm text-slate">
                        {component.summary || "No component summary yet."}
                      </p>
                    </div>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-copper/25 bg-white text-sm font-semibold text-copper">
                      {expanded ? "-" : "+"}
                    </span>
                  </div>
                </button>

                <div className="mt-3 rounded-xl bg-mist/55 px-3 py-2 text-xs text-slate">
                  {component.objects.length} object{component.objects.length === 1 ? "" : "s"} |{" "}
                  {activeObjects} active | {statefulObjects} stateful
                </div>

                {expanded ? (
                  <div className="mt-4 space-y-3 border-t border-slate/10 pt-4">
                    {component.objects.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate/20 bg-mist/40 p-3 text-sm text-slate">
                        No internal objects yet.
                      </div>
                    ) : (
                      component.objects.map((object) => (
                        <div
                          key={object.id}
                          className={`rounded-xl border px-3 py-3 ${
                            object.objectType === "active"
                              ? "border-pine/20 bg-white"
                              : "border-slate/15 bg-mist/35"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink">
                                {object.name || "Unnamed object"}
                              </p>
                              <p className="mt-1 text-xs text-slate">
                                {object.objectType === "active" ? "Active object" : "Passive object"}
                              </p>
                            </div>
                            <span className="rounded-full bg-sand px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-copper">
                              {object.needsState ? `${object.states.length} states` : "no state"}
                            </span>
                          </div>
                          {object.responsibility ? (
                            <p className="mt-2 text-sm text-slate">{object.responsibility}</p>
                          ) : null}
                        </div>
                      ))
                    )}

                    {component.objectInteractions.length > 0 ? (
                      <div className="rounded-xl border border-slate/15 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">
                          Internal Links
                        </p>
                        <div className="mt-2 space-y-2">
                          {component.objectInteractions.map((interaction, index) => (
                            <div
                              key={`${interaction.fromObjectId}-${interaction.toObjectId}-${index}`}
                              className="rounded-lg bg-mist/45 px-2.5 py-2 text-xs text-slate"
                            >
                              <span className="font-medium text-ink">
                                {component.objects.find((object) => object.id === interaction.fromObjectId)?.name ||
                                  "Unknown"}
                              </span>{" "}
                              →{" "}
                              <span className="font-medium text-ink">
                                {component.objects.find((object) => object.id === interaction.toObjectId)?.name ||
                                  "Unknown"}
                              </span>
                              {interaction.relationship ? ` | ${interaction.relationship}` : ""}
                              {interaction.notes ? ` | ${interaction.notes}` : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate/10 bg-mist/45 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate">
            Component Interactions
          </p>
          <div className="mt-3 space-y-2">
            {workspace.discovery.interactions.length === 0 ? (
              <p className="text-sm text-slate">No component interactions documented yet.</p>
            ) : (
              workspace.discovery.interactions.map((interaction, index) => (
                <div
                  key={`${interaction.fromComponentId}-${interaction.toComponentId}-${index}`}
                  className="rounded-xl bg-white px-3 py-2 text-sm text-slate"
                >
                  <span className="font-medium text-ink">
                    {componentNameById.get(interaction.fromComponentId) || "Unknown source"}
                  </span>{" "}
                  →{" "}
                  <span className="font-medium text-ink">
                    {componentNameById.get(interaction.toComponentId) || "Unknown target"}
                  </span>
                  {interaction.mechanism || interaction.data
                    ? ` | ${[interaction.mechanism, interaction.data].filter(Boolean).join(": ")}`
                    : ""}
                  {interaction.notes ? ` | ${interaction.notes}` : ""}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const BehavioralArchitectureOverlayButton = ({
  workspace,
  selectedComponentId,
  expandedComponentIds,
  onToggleComponent,
}: {
  workspace: FeatureWorkspace;
  selectedComponentId: string | null;
  expandedComponentIds: string[];
  onToggleComponent: (componentId: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Button onClick={() => setExpanded(true)} tone="secondary">
        Open Large View
      </Button>
      {expanded ? (
        <div className="fixed inset-0 z-[60] bg-ink/75 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[96vw] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Expanded Diagram</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  Behavioral Architecture Diagram
                </h3>
              </div>
              <Button onClick={() => setExpanded(false)} tone="ghost">
                Close
              </Button>
            </div>
            <div className="mt-4 flex-1 overflow-auto rounded-2xl bg-mist/60 p-3">
              <BehavioralArchitectureCanvas
                workspace={workspace}
                selectedComponentId={selectedComponentId}
                expandedComponentIds={expandedComponentIds}
                onToggleComponent={onToggleComponent}
                large
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

void BehavioralArchitectureCanvas;
void BehavioralArchitectureOverlayButton;

const DiagramPreviewCard = ({
  title,
  chart,
  previewTitle,
  expandedTitle,
  previewDefaultHeight,
  previewMinWidth,
  expandedMinWidth,
  action,
  nodeActions,
}: {
  title: string;
  chart: string;
  previewTitle: string;
  expandedTitle: string;
  previewDefaultHeight: number;
  previewMinWidth: string;
  expandedMinWidth: string;
  action?: ReactNode;
  nodeActions?: Array<{ nodeId: string; onClick: () => void }>;
}) => {
  const [viewMode, setViewMode] = useState<"fit" | "scroll">("fit");
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <PreviewCard title={title} action={action}>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setViewMode("fit")}
            tone={viewMode === "fit" ? "primary" : "secondary"}
          >
            Fit View
          </Button>
          <Button
            onClick={() => setViewMode("scroll")}
            tone={viewMode === "scroll" ? "primary" : "secondary"}
          >
            Scroll View
          </Button>
          <Button onClick={() => setExpanded(true)} tone="secondary">
            Open Large View
          </Button>
        </div>
        <div
          className={`rounded-2xl bg-white ${
            viewMode === "fit" ? "overflow-hidden" : "overflow-x-auto"
          }`}
        >
          <MermaidPreview
            title={previewTitle}
            chart={chart}
            svgMode={viewMode === "fit" ? "fit" : "natural"}
            resizable
            defaultHeight={previewDefaultHeight}
            minHeight={Math.max(260, previewDefaultHeight - 120)}
            maxHeight={1100}
            className={viewMode === "fit" ? "h-full min-h-0" : `h-full min-h-0 ${previewMinWidth}`}
            nodeActions={nodeActions}
          />
        </div>
      </PreviewCard>

      {expanded ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[96vw] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Expanded Diagram</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">{expandedTitle}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setViewMode("fit")}
                  tone={viewMode === "fit" ? "primary" : "secondary"}
                >
                  Fit View
                </Button>
                <Button
                  onClick={() => setViewMode("scroll")}
                  tone={viewMode === "scroll" ? "primary" : "secondary"}
                >
                  Scroll View
                </Button>
                <Button onClick={() => setExpanded(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div
              className={`mt-4 flex-1 rounded-2xl bg-mist/60 p-3 ${
                viewMode === "fit" ? "overflow-auto" : "overflow-x-auto overflow-y-auto"
              }`}
            >
              <MermaidPreview
                title={`${expandedTitle} Expanded`}
                chart={chart}
                svgMode={viewMode === "fit" ? "fit" : "natural"}
                className={viewMode === "fit" ? "min-h-full" : `min-h-full ${expandedMinWidth}`}
                nodeActions={nodeActions}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const ArchitectureViewPanel = ({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description: string;
  children: ReactNode;
}) => (
  <section className="space-y-4 rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-sm">
    <div>
      <h3 className="text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-3xl text-sm text-slate">{description}</p>
    </div>
    {children}
  </section>
);

const designSelectionCardClass = (selected: boolean): string =>
  `rounded-2xl border px-4 py-3 shadow-sm transition ${
    selected
      ? "border-copper bg-sand shadow-[0_10px_24px_rgba(184,95,44,0.16)]"
      : "border-slate/20 bg-white/95 hover:border-slate/35 hover:bg-slate-50/40"
  }`;

const getComponentNameById = (
  components: ComponentCandidate[],
  componentId: string,
): string =>
  components.find((component) => component.id === componentId)?.name || "Unnamed component";

const formatInteractionName = (
  workspace: FeatureWorkspace,
  interaction: ComponentInteraction,
): string =>
  `${getComponentNameById(workspace.discovery.candidateComponents, interaction.fromComponentId)} -> ${getComponentNameById(
    workspace.discovery.candidateComponents,
    interaction.toComponentId,
  )}`;

const getRuntimeNodeNameById = (
  nodes: RuntimeNode[],
  nodeId: string,
): string => nodes.find((node) => node.id === nodeId)?.name || "Unnamed runtime node";

const formatRuntimeLinkName = (
  workspace: FeatureWorkspace,
  link: RuntimeLink,
): string =>
  `${getRuntimeNodeNameById(workspace.discovery.runtimeNodes, link.fromNodeId)} -> ${getRuntimeNodeNameById(
    workspace.discovery.runtimeNodes,
    link.toNodeId,
  )}`;

const getDataFlowNodeNameById = (
  nodes: DataFlowNode[],
  nodeId: string,
): string => nodes.find((node) => node.id === nodeId)?.name || "Unnamed data node";

const formatDataFlowName = (
  workspace: FeatureWorkspace,
  flow: DataFlow,
): string =>
  `${getDataFlowNodeNameById(workspace.discovery.dataFlowNodes, flow.fromNodeId)} -> ${getDataFlowNodeNameById(
    workspace.discovery.dataFlowNodes,
    flow.toNodeId,
  )}`;

const SelectableChipGroup = ({
  options,
  selected,
  onToggle,
  emptyMessage,
}: {
  options: Array<{ label: string; value: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  emptyMessage: string;
}) =>
  options.length === 0 ? (
    <div className="rounded-xl border border-dashed border-slate/20 bg-mist/40 px-3 py-2 text-xs text-slate">
      {emptyMessage}
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "border-copper bg-sand text-ink"
                : "border-slate/20 bg-white text-slate hover:border-slate/35"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

const toggleSelection = (items: string[], value: string): string[] =>
  items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

const getSelectedLabels = (
  options: Array<{ label: string; value: string }>,
  selected: string[],
): string[] => {
  const labelByValue = new Map(options.map((option) => [option.value, option.label]));
  return selected.map((value) => labelByValue.get(value) ?? value).filter(Boolean);
};

const ManagedSelectionField = ({
  label,
  hint,
  options,
  selected,
  onToggle,
  emptyMessage,
  manageLabel = "Manage",
  onItemClick,
}: {
  label: string;
  hint: string;
  options: Array<{ label: string; value: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  emptyMessage: string;
  manageLabel?: string;
  onItemClick?: (value: string) => void;
}) => {
  const [manageOpen, setManageOpen] = useState(false);
  const selectedItems = options.filter((option) => selected.includes(option.value));

  return (
    <Field
      label={
        <div className="flex items-center justify-between gap-3">
          <span>{label}</span>
          <Button onClick={() => setManageOpen((current) => !current)} tone="secondary" size="compact">
            {manageOpen ? "Close" : manageLabel}
          </Button>
        </div>
      }
      hint={hint}
    >
      <div className="space-y-3">
        {selectedItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <span
                key={item.value}
                className="inline-flex items-center overflow-hidden rounded-full border border-copper/30 bg-sand text-xs font-medium text-ink"
              >
                <button
                  type="button"
                  onClick={() => onItemClick?.(item.value)}
                  className={`px-3 py-1.5 text-left transition ${
                    onItemClick ? "hover:bg-copper/10" : "cursor-default"
                  }`}
                >
                  {item.label}
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(item.value)}
                  className="border-l border-copper/20 px-2 py-1.5 transition hover:bg-copper/15"
                  aria-label={`Remove ${item.label}`}
                  title={`Remove ${item.label}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate/20 bg-mist/40 px-3 py-2 text-xs text-slate">
            {emptyMessage}
          </div>
        )}
        {manageOpen ? (
          <div className="rounded-xl border border-slate/15 bg-white px-3 py-3">
            <SelectableChipGroup
              options={options}
              selected={selected}
              onToggle={onToggle}
              emptyMessage={emptyMessage}
            />
          </div>
        ) : null}
      </div>
    </Field>
  );
};

const ImplementationUnitEditor = ({
  unit,
  requirementLabels,
  components,
  runtimeNodes,
  candidateTasks,
  onChange,
  onRemove,
  index,
}: {
  unit: ImplementationUnit;
  requirementLabels: string[];
  components: ComponentCandidate[];
  runtimeNodes: RuntimeNode[];
  candidateTasks: CandidateTask[];
  onChange: (unit: ImplementationUnit) => void;
  onRemove: () => void;
  index: number;
}) => {
  const requirementOptions = requirementLabels.map((label) => ({ label, value: label }));
  const componentOptions = components.map((component) => ({
    label: component.name || "Unnamed component",
    value: component.id,
  }));
  const runtimeOptions = runtimeNodes.map((node) => ({
    label: node.name || "Unnamed runtime node",
    value: node.id,
  }));
  const taskOptions = candidateTasks.map((task) => ({
    label: task.name || "Unnamed candidate task",
    value: task.id,
  }));

  const selectedRequirements = getSelectedLabels(requirementOptions, unit.requirementRefs);
  const selectedComponents = getSelectedLabels(componentOptions, unit.componentIds);
  const selectedRuntimeNodes = getSelectedLabels(runtimeOptions, unit.runtimeNodeIds);
  const selectedTasks = getSelectedLabels(taskOptions, unit.candidateTaskIds);

  return (
    <div className="rounded-[24px] border border-slate/15 bg-white/95 p-4 shadow-sm">
      <div id={`implementation-unit-${unit.id}`} className="absolute -mt-24" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-copper">Implementation Unit {index + 1}</p>
          <h4 className="mt-1 text-lg font-semibold text-ink">
            {unit.name || "Unnamed implementation unit"}
          </h4>
          <p className="mt-1 text-xs text-slate">
            {selectedRequirements.length > 0 ? selectedRequirements.join(", ") : "No REQ linked yet"}
            {" | "}
            {selectedComponents.length > 0 ? selectedComponents.join(", ") : "No component linked yet"}
          </p>
        </div>
        <Button onClick={onRemove} tone="danger" size="compact">
          Remove
        </Button>
      </div>
      <div className="mt-4 grid gap-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Field label="Unit Name">
            <TextInput value={unit.name} onChange={(value) => onChange({ ...unit, name: value })} />
          </Field>
          <Field label="Kind">
            <Select
              value={unit.kind}
              options={[...IMPLEMENTATION_UNIT_KIND_OPTIONS]}
              onChange={(value) => onChange({ ...unit, kind: value })}
            />
          </Field>
        </div>
        <Field
          label="Responsibility"
          hint="Describe what code this unit should own. Keep this short and stable so it stays maintainable."
        >
          <TextArea
            value={unit.responsibility}
            onChange={(value) => onChange({ ...unit, responsibility: value })}
          />
        </Field>
        <details className="rounded-2xl border border-slate/15 bg-mist/35 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink">
            REQ Links
            <span className="ml-2 text-xs font-normal text-slate">
              {selectedRequirements.length} linked
            </span>
          </summary>
          <div className="mt-4">
            <ManagedSelectionField
              label="REQ Links"
              hint=""
              options={requirementOptions}
              selected={unit.requirementRefs}
              onToggle={(value) => onChange({ ...unit, requirementRefs: toggleSelection(unit.requirementRefs, value) })}
              emptyMessage="No REQ-x items linked yet."
              manageLabel="Link REQ"
            />
          </div>
        </details>
        <details className="rounded-2xl border border-slate/15 bg-mist/35 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink">
            Mapped Components
            <span className="ml-2 text-xs font-normal text-slate">
              {selectedComponents.length} linked
            </span>
          </summary>
          <div className="mt-4">
            <ManagedSelectionField
              label="Mapped Components"
              hint="Link the logical components this code unit realizes."
              options={componentOptions}
              selected={unit.componentIds}
              onToggle={(value) => onChange({ ...unit, componentIds: toggleSelection(unit.componentIds, value) })}
              emptyMessage="No components linked yet."
              manageLabel="Link Components"
            />
          </div>
        </details>
        <div className="grid gap-4 lg:grid-cols-2">
          <StringListEditor
            label="Interfaces"
            hint=""
            items={unit.interfaces}
            onChange={(items) => onChange({ ...unit, interfaces: items })}
            placeholder="Interface or API surface"
          />
          <StringListEditor
            label="Files / Code Artifacts"
            hint=""
            items={unit.files}
            onChange={(items) => onChange({ ...unit, files: items })}
            placeholder="File path or code artifact"
          />
        </div>
        <details className="rounded-2xl border border-slate/15 bg-mist/35 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink">
            Advanced Traceability
            <span className="ml-2 text-xs font-normal text-slate">
              {selectedRuntimeNodes.length} runtime link{selectedRuntimeNodes.length === 1 ? "" : "s"}
              {" | "}
              {selectedTasks.length} task link{selectedTasks.length === 1 ? "" : "s"}
            </span>
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ManagedSelectionField
              label="Mapped Runtime Nodes"
              hint="Use only when this unit clearly belongs to a runtime boundary."
              options={runtimeOptions}
              selected={unit.runtimeNodeIds}
              onToggle={(value) => onChange({ ...unit, runtimeNodeIds: toggleSelection(unit.runtimeNodeIds, value) })}
              emptyMessage="No runtime nodes linked yet."
              manageLabel="Link Runtime"
            />
            <ManagedSelectionField
              label="Mapped Candidate Tasks"
              hint="Use only when this unit clearly supports an execution unit."
              options={taskOptions}
              selected={unit.candidateTaskIds}
              onToggle={(value) => onChange({ ...unit, candidateTaskIds: toggleSelection(unit.candidateTaskIds, value) })}
              emptyMessage="No candidate tasks linked yet."
              manageLabel="Link Tasks"
            />
          </div>
        </details>
        <Field label="Notes">
          <TextArea value={unit.notes ?? ""} onChange={(value) => onChange({ ...unit, notes: value })} />
        </Field>
      </div>
    </div>
  );
};

const ImplementationStepEditor = ({
  step,
  units,
  onChange,
  onRemove,
  index,
}: {
  step: ImplementationStep;
  units: ImplementationUnit[];
  onChange: (step: ImplementationStep) => void;
  onRemove: () => void;
  index: number;
}) => {
  const scrollToUnit = (unitId: string) => {
    const element = document.getElementById(`implementation-unit-${unitId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
  <div className="rounded-[24px] border border-slate/15 bg-white/95 p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-copper">Implementation Step {index + 1}</p>
        <h4 className="mt-1 text-lg font-semibold text-ink">
          {step.name || "Unnamed implementation step"}
        </h4>
      </div>
      <Button onClick={onRemove} tone="danger" size="compact">
        Remove
      </Button>
    </div>
    <div className="mt-4 grid gap-4">
      <Field label="Step Name">
        <TextInput value={step.name} onChange={(value) => onChange({ ...step, name: value })} />
      </Field>
      <Field label="Goal" hint="Describe what will exist and be working after this step is complete.">
        <TextArea value={step.goal} onChange={(value) => onChange({ ...step, goal: value })} />
      </Field>
      <ManagedSelectionField
        label="Linked Units"
        hint="Choose the implementation units that this step builds or integrates."
        options={units.map((unit) => ({
          label: unit.name || "Unnamed implementation unit",
          value: unit.id,
        }))}
        selected={step.moduleIds}
        onToggle={(value) => onChange({ ...step, moduleIds: toggleSelection(step.moduleIds, value) })}
        emptyMessage="No implementation units linked yet."
        manageLabel="Link Units"
        onItemClick={scrollToUnit}
      />
      <StringListEditor
        label="Verification"
        hint="List how you will prove this step is done: tests, logs, demo flow, or manual checks."
        items={step.verification}
        onChange={(items) => onChange({ ...step, verification: items })}
        placeholder="Verification item"
      />
      <Field label="Notes">
        <TextArea value={step.notes ?? ""} onChange={(value) => onChange({ ...step, notes: value })} />
      </Field>
    </div>
  </div>
  );
};

const InteractionDetailEditor = ({
  interaction,
  components,
  customMechanisms,
  onAddCustomMechanism,
  onRemoveCustomMechanism,
  onChange,
}: {
  interaction: ComponentInteraction;
  components: ComponentCandidate[];
  customMechanisms: string[];
  onAddCustomMechanism: (value: string) => void;
  onRemoveCustomMechanism: (value: string) => void;
  onChange: (nextInteraction: ComponentInteraction) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Interaction Details"
      hint="Describe the direction, mechanism, payload, and notes for this interaction."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Interaction Name</SectionInputLabel>
          <div className="rounded-2xl bg-white px-3 py-2 text-sm text-ink">
            {`${getComponentNameById(components, interaction.fromComponentId)} -> ${getComponentNameById(
              components,
              interaction.toComponentId,
            )}`}
          </div>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>From Component</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={interaction.fromComponentId}
            onChange={(event) =>
              onChange({ ...interaction, fromComponentId: event.target.value })
            }
          >
            {components.map((component) => (
              <option key={component.id} value={component.id}>
                {component.name || "Unnamed component"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>To Component</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={interaction.toComponentId}
            onChange={(event) =>
              onChange({ ...interaction, toComponentId: event.target.value })
            }
          >
            {components.map((component) => (
              <option key={component.id} value={component.id}>
                {component.name || "Unnamed component"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Mechanism</SectionInputLabel>
          <SelectWithOther
            value={interaction.mechanism}
            onChange={(value) =>
              onChange({
                ...interaction,
                mechanism: value as ComponentInteraction["mechanism"],
              })
            }
            options={[...INTERACTION_MECHANISM_OPTIONS]}
            customOptions={customMechanisms}
            onAddCustomOption={onAddCustomMechanism}
            onRemoveCustomOption={onRemoveCustomMechanism}
            customPlaceholder="Enter custom mechanism"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Data / Signal</SectionInputLabel>
          <TextArea
            value={interaction.data}
            onChange={(value) => onChange({ ...interaction, data: value })}
            placeholder="What data, event, or signal crosses this interaction?"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Notes</SectionInputLabel>
          <TextArea
            value={interaction.notes ?? ""}
            onChange={(value) => onChange({ ...interaction, notes: value })}
            placeholder="Any delivery rules, timing, buffering, or ownership notes."
          />
        </div>
      </div>
    </Field>
  </div>
);

const DataFlowNodeDetailEditor = ({
  node,
  customKinds,
  onAddCustomKind,
  onRemoveCustomKind,
  onChange,
}: {
  node: DataFlowNode;
  customKinds: string[];
  onAddCustomKind: (value: string) => void;
  onRemoveCustomKind: (value: string) => void;
  onChange: (nextNode: DataFlowNode) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Data Flow Node Details"
      hint="Describe the external entity, process, or data store that participates in this data flow view."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Node Name</SectionInputLabel>
          <TextInput
            value={node.name}
            onChange={(value) => onChange({ ...node, name: value })}
            placeholder="Node name"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Node Type</SectionInputLabel>
          <SelectWithOther
            value={node.kind}
            onChange={(value) => onChange({ ...node, kind: value as DataFlowNode["kind"] })}
            options={[...DATA_FLOW_NODE_TYPE_OPTIONS]}
            customOptions={customKinds}
            onAddCustomOption={onAddCustomKind}
            onRemoveCustomOption={onRemoveCustomKind}
            customPlaceholder="Enter custom data flow node type"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Description</SectionInputLabel>
          <TextArea
            value={node.description ?? ""}
            onChange={(value) => onChange({ ...node, description: value })}
            placeholder="What role does this node play in the data path?"
          />
        </div>
      </div>
    </Field>
  </div>
);

const DataFlowDetailEditor = ({
  flow,
  nodes,
  onChange,
}: {
  flow: DataFlow;
  nodes: DataFlowNode[];
  onChange: (nextFlow: DataFlow) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Data Flow Details"
      hint="Describe what information moves between the source and target nodes."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Flow Name</SectionInputLabel>
          <div className="rounded-2xl bg-white px-3 py-2 text-sm text-ink">
            {`${getDataFlowNodeNameById(nodes, flow.fromNodeId)} -> ${getDataFlowNodeNameById(
              nodes,
              flow.toNodeId,
            )}`}
          </div>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>From Node</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={flow.fromNodeId}
            onChange={(event) => onChange({ ...flow, fromNodeId: event.target.value })}
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name || "Unnamed node"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>To Node</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={flow.toNodeId}
            onChange={(event) => onChange({ ...flow, toNodeId: event.target.value })}
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name || "Unnamed node"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Data Flow Label</SectionInputLabel>
          <TextArea
            value={flow.label}
            onChange={(value) => onChange({ ...flow, label: value })}
            placeholder="What data, message, or record moves along this path?"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Notes</SectionInputLabel>
          <TextArea
            value={flow.notes ?? ""}
            onChange={(value) => onChange({ ...flow, notes: value })}
            placeholder="Any transformation, validation, or storage notes for this flow."
          />
        </div>
      </div>
    </Field>
  </div>
);

const RuntimeNodeDetailEditor = ({
  node,
  nodes,
  customKinds,
  onAddCustomKind,
  onRemoveCustomKind,
  onChange,
}: {
  node: RuntimeNode;
  nodes: RuntimeNode[];
  customKinds: string[];
  onAddCustomKind: (value: string) => void;
  onRemoveCustomKind: (value: string) => void;
  onChange: (nextNode: RuntimeNode) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Runtime Node Details"
      hint="Describe what this runtime node is and what it owns in execution."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Node Name</SectionInputLabel>
          <TextInput
            value={node.name}
            onChange={(value) => onChange({ ...node, name: value })}
            placeholder="Node name"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Node Type</SectionInputLabel>
          <SelectWithOther
            value={node.kind}
            onChange={(value) => onChange({ ...node, kind: value as RuntimeNode["kind"] })}
            options={[...RUNTIME_NODE_TYPE_OPTIONS]}
            customOptions={customKinds}
            onAddCustomOption={onAddCustomKind}
            onRemoveCustomOption={onRemoveCustomKind}
            customPlaceholder="Enter custom runtime node type"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Host Runtime Boundary</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={node.hostNodeId ?? ""}
            onChange={(event) => onChange({ ...node, hostNodeId: event.target.value })}
          >
            <option value="">Top-level runtime boundary</option>
            {nodes
              .filter(
                (candidate) =>
                  candidate.id !== node.id &&
                  RUNTIME_BOUNDARY_HOST_OPTIONS.includes(candidate.kind as (typeof RUNTIME_BOUNDARY_HOST_OPTIONS)[number]),
              )
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name || "Unnamed runtime boundary"}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Responsibility</SectionInputLabel>
          <TextArea
            value={node.responsibility}
            onChange={(value) => onChange({ ...node, responsibility: value })}
            placeholder="What does this runtime node do?"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Notes</SectionInputLabel>
          <TextArea
            value={node.notes ?? ""}
            onChange={(value) => onChange({ ...node, notes: value })}
            placeholder="Any execution, priority, latency, or ownership notes."
          />
        </div>
      </div>
    </Field>
  </div>
);

const RuntimeLinkDetailEditor = ({
  link,
  nodes,
  customKinds,
  onAddCustomKind,
  onRemoveCustomKind,
  onChange,
}: {
  link: RuntimeLink;
  nodes: RuntimeNode[];
  customKinds: string[];
  onAddCustomKind: (value: string) => void;
  onRemoveCustomKind: (value: string) => void;
  onChange: (nextLink: RuntimeLink) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Runtime Link Details"
      hint="Describe how these runtime nodes are connected during execution."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Link Name</SectionInputLabel>
          <div className="rounded-2xl bg-white px-3 py-2 text-sm text-ink">
            {`${getRuntimeNodeNameById(nodes, link.fromNodeId)} -> ${getRuntimeNodeNameById(
              nodes,
              link.toNodeId,
            )}`}
          </div>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>From Node</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={link.fromNodeId}
            onChange={(event) => onChange({ ...link, fromNodeId: event.target.value })}
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name || "Unnamed node"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>To Node</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={link.toNodeId}
            onChange={(event) => onChange({ ...link, toNodeId: event.target.value })}
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name || "Unnamed node"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Link Type</SectionInputLabel>
          <SelectWithOther
            value={link.kind}
            onChange={(value) => onChange({ ...link, kind: value as RuntimeLink["kind"] })}
            options={[...RUNTIME_LINK_TYPE_OPTIONS]}
            customOptions={customKinds}
            onAddCustomOption={onAddCustomKind}
            onRemoveCustomOption={onRemoveCustomKind}
            customPlaceholder="Enter custom runtime link type"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Label</SectionInputLabel>
          <TextInput
            value={link.label}
            onChange={(value) => onChange({ ...link, label: value })}
            placeholder="What crosses this runtime boundary?"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Notes</SectionInputLabel>
          <TextArea
            value={link.notes ?? ""}
            onChange={(value) => onChange({ ...link, notes: value })}
            placeholder="Optional delivery, scheduling, or ownership notes."
          />
        </div>
      </div>
    </Field>
  </div>
);

const CandidateTaskDetailEditor = ({
  task,
  onChange,
}: {
  task: CandidateTask;
  onChange: (nextTask: CandidateTask) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Candidate Task Details"
      hint="Describe this possible execution unit before deciding whether it becomes part of the runtime topology."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Task Name</SectionInputLabel>
          <TextInput
            value={task.name}
            onChange={(value) => onChange({ ...task, name: value })}
            placeholder="Task name"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Responsibility</SectionInputLabel>
          <TextArea
            value={task.responsibility}
            onChange={(value) => onChange({ ...task, responsibility: value })}
            rows={3}
            placeholder="What would this execution unit handle?"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <SectionInputLabel>Priority</SectionInputLabel>
            <Select
              value={task.priority}
              onChange={(value) =>
                onChange({
                  ...task,
                  priority: value === "high" || value === "low" ? value : "medium",
                })
              }
              options={["high", "medium", "low"]}
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Task Type</SectionInputLabel>
            <Select
              value={task.type}
              onChange={(value) =>
                onChange({
                  ...task,
                  type:
                    value === "periodic" || value === "background" || value === "worker"
                      ? value
                      : "event-driven",
                })
              }
              options={["periodic", "event-driven", "background", "worker"]}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Trigger</SectionInputLabel>
          <TextInput
            value={task.trigger}
            onChange={(value) => onChange({ ...task, trigger: value })}
            placeholder="What starts or wakes this task?"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>May Block</SectionInputLabel>
          <Select
            value={task.mayBlock ? "yes" : "no"}
            onChange={(value) => onChange({ ...task, mayBlock: value === "yes" })}
            options={["yes", "no"]}
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Notes</SectionInputLabel>
          <TextArea
            value={task.notes ?? ""}
            onChange={(value) => onChange({ ...task, notes: value })}
            rows={3}
            placeholder="Optional notes, risks, or implementation considerations"
          />
        </div>
      </div>
    </Field>
  </div>
);

const ContextEntityDetailEditor = ({
  entity,
  flows,
  customKinds,
  onAddCustomKind,
  onRemoveCustomKind,
  onChange,
}: {
  entity: ContextEntity;
  flows: ContextFlow[];
  customKinds: string[];
  onAddCustomKind: (value: string) => void;
  onRemoveCustomKind: (value: string) => void;
  onChange: (nextEntity: ContextEntity, nextFlows: ContextFlow[]) => void;
}) => {
  const updateFlow = (flowId: string, updates: Partial<ContextFlow>) => {
    onChange(
      entity,
      flows.map((flow) => (flow.id === flowId ? { ...flow, ...updates } : flow)),
    );
  };

  return (
    <div className="space-y-4">
      <Field
        label="Context Entity"
        hint="Define the outside actor, device, system, or service and the boundary flows it exchanges with this feature."
      >
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <SectionInputLabel>Entity Name</SectionInputLabel>
            <TextInput
              value={entity.name}
              onChange={(value) => onChange({ ...entity, name: value }, flows)}
              placeholder="Entity name"
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Entity Type</SectionInputLabel>
            <SelectWithOther
              value={entity.kind}
              onChange={(value) => onChange({ ...entity, kind: value as ContextEntity["kind"] }, flows)}
              options={[...CONTEXT_ENTITY_TYPE_OPTIONS]}
              customOptions={customKinds}
              onAddCustomOption={onAddCustomKind}
              onRemoveCustomOption={onRemoveCustomKind}
              customPlaceholder="Enter custom entity type"
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Description</SectionInputLabel>
            <TextArea
              value={entity.description ?? ""}
              onChange={(value) => onChange({ ...entity, description: value }, flows)}
              placeholder="How does this entity relate to the feature?"
              rows={3}
            />
          </div>
        </div>
      </Field>

      <Field
        label="Boundary Flows"
        hint="Capture each input or output that crosses the feature boundary for this entity."
      >
        <div className="space-y-4">
          {flows.length === 0 ? (
            <p className="text-sm text-slate">No boundary flows yet.</p>
          ) : (
            flows.map((flow) => (
              <div
                key={flow.id}
                className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4"
              >
                <div className="space-y-1.5">
                  <SectionInputLabel>Direction</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={flow.direction}
                    onChange={(event) =>
                      updateFlow(flow.id, {
                        direction: event.target.value as ContextFlow["direction"],
                      })
                    }
                  >
                    {["inbound", "outbound", "bidirectional"].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Flow Label</SectionInputLabel>
                  <TextInput
                    value={flow.label}
                    onChange={(value) => updateFlow(flow.id, { label: value })}
                    placeholder="What crosses the boundary?"
                  />
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Description</SectionInputLabel>
                  <TextArea
                    value={flow.description ?? ""}
                    onChange={(value) => updateFlow(flow.id, { description: value })}
                    placeholder="Optional context for this boundary flow"
                    rows={3}
                  />
                </div>
                <Button
                  onClick={() =>
                    onChange(
                      entity,
                      flows.filter((item) => item.id !== flow.id),
                    )
                  }
                  tone="danger"
                  size="compact"
                >
                  Remove
                </Button>
              </div>
            ))
          )}
          <Button
            onClick={() =>
              onChange(
                entity,
                [...flows, createEmptyContextFlow(entity.id)],
              )
            }
          >
            Add Boundary Flow
          </Button>
        </div>
      </Field>
    </div>
  );
};

const SequenceScenarioDetailEditor = ({
  scenario,
  onChange,
}: {
  scenario: FeatureWorkspace["discovery"]["sequenceScenarios"][number];
  onChange: (nextScenario: FeatureWorkspace["discovery"]["sequenceScenarios"][number]) => void;
}) => {
  const updateParticipant = (
    participantId: string,
    patch: Partial<SequenceParticipant>,
  ) => {
    onChange({
      ...scenario,
      participants: scenario.participants.map((participant) =>
        participant.id === participantId ? { ...participant, ...patch } : participant,
      ),
    });
  };

  const updateStep = (stepId: string, patch: Partial<SequenceStep>) => {
    onChange({
      ...scenario,
      steps: scenario.steps.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <Field
        label="Scenario Metadata"
        hint="Define the scenario purpose, what starts it, and the expected result."
      >
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <SectionInputLabel>Scenario Name</SectionInputLabel>
            <TextInput
              value={scenario.name}
              onChange={(value) => onChange({ ...scenario, name: value })}
              placeholder="Handle a valid command packet"
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Scenario Goal</SectionInputLabel>
            <TextArea
              value={scenario.goal}
              onChange={(value) => onChange({ ...scenario, goal: value })}
              placeholder="What success looks like for this runtime flow."
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Trigger</SectionInputLabel>
            <TextArea
              value={scenario.trigger}
              onChange={(value) => onChange({ ...scenario, trigger: value })}
              placeholder="What starts this scenario?"
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Outcome</SectionInputLabel>
            <TextArea
              value={scenario.outcome}
              onChange={(value) => onChange({ ...scenario, outcome: value })}
              placeholder="What should be true when the flow completes?"
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Failure Path</SectionInputLabel>
            <TextArea
              value={scenario.failurePath ?? ""}
              onChange={(value) => onChange({ ...scenario, failurePath: value })}
              placeholder="Optional alternate or failure outcome."
            />
          </div>
        </div>
      </Field>

      <Field
        label="Participants"
        hint="List the actors, components, devices, or systems that appear in this scenario."
      >
        <div className="space-y-4">
          {scenario.participants.length === 0 ? (
            <p className="text-sm text-slate">No participants yet.</p>
          ) : (
            scenario.participants.map((participant) => (
              <div
                key={participant.id}
                className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4"
              >
                <div className="space-y-1.5">
                  <SectionInputLabel>Participant Name</SectionInputLabel>
                  <TextInput
                    value={participant.name}
                    onChange={(value) => updateParticipant(participant.id, { name: value })}
                    placeholder="Participant name"
                  />
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Participant Type</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={participant.kind}
                    onChange={(event) =>
                      updateParticipant(participant.id, {
                        kind: event.target.value as SequenceParticipant["kind"],
                      })
                    }
                  >
                    {["actor", "component", "system", "device", "service"].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Description</SectionInputLabel>
                  <TextArea
                    value={participant.description ?? ""}
                    onChange={(value) =>
                      updateParticipant(participant.id, { description: value })
                    }
                    placeholder="What role this participant plays in the scenario."
                  />
                </div>
                <Button
                  onClick={() =>
                    onChange({
                      ...scenario,
                      participants: scenario.participants.filter(
                        (item) => item.id !== participant.id,
                      ),
                      steps: scenario.steps.map((step) => ({
                        ...step,
                        fromParticipantId:
                          step.fromParticipantId === participant.id ? "" : step.fromParticipantId,
                        toParticipantId:
                          step.toParticipantId === participant.id ? "" : step.toParticipantId,
                      })),
                    })
                  }
                  tone="danger"
                  size="compact"
                >
                  Remove
                </Button>
              </div>
            ))
          )}
          <Button
            onClick={() =>
              onChange({
                ...scenario,
                participants: [...scenario.participants, createEmptySequenceParticipant()],
              })
            }
          >
            Add Participant
          </Button>
        </div>
      </Field>

      <Field
        label="Ordered Steps"
        hint="Describe the step-by-step messages or events between participants."
      >
        <div className="space-y-4">
          {scenario.steps.length === 0 ? (
            <p className="text-sm text-slate">No steps yet.</p>
          ) : (
            scenario.steps.map((step) => (
              <div
                key={step.id}
                className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4"
              >
                <div className="space-y-1.5">
                  <SectionInputLabel>From</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={step.fromParticipantId}
                    onChange={(event) =>
                      updateStep(step.id, { fromParticipantId: event.target.value })
                    }
                  >
                    <option value="">Select sender</option>
                    {scenario.participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.name || "Unnamed participant"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>To</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={step.toParticipantId}
                    onChange={(event) =>
                      updateStep(step.id, { toParticipantId: event.target.value })
                    }
                  >
                    <option value="">Select receiver</option>
                    {scenario.participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.name || "Unnamed participant"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Step Type</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={step.type}
                    onChange={(event) =>
                      updateStep(step.id, {
                        type: event.target.value as SequenceStep["type"],
                      })
                    }
                  >
                    {["call", "async", "return", "event"].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Message</SectionInputLabel>
                  <TextArea
                    value={step.message}
                    onChange={(value) => updateStep(step.id, { message: value })}
                    placeholder="What is sent or performed at this step?"
                  />
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Note</SectionInputLabel>
                  <TextArea
                    value={step.note ?? ""}
                    onChange={(value) => updateStep(step.id, { note: value })}
                    placeholder="Optional note or constraint for this step."
                  />
                </div>
                <Button
                  onClick={() =>
                    onChange({
                      ...scenario,
                      steps: scenario.steps.filter((item) => item.id !== step.id),
                    })
                  }
                  tone="danger"
                  size="compact"
                >
                  Remove
                </Button>
              </div>
            ))
          )}
          <Button
            onClick={() => {
              const firstParticipantId = scenario.participants[0]?.id ?? "";
              const secondParticipantId =
                scenario.participants[1]?.id ?? firstParticipantId;
              onChange({
                ...scenario,
                steps: [
                  ...scenario.steps,
                  createEmptySequenceStep(firstParticipantId, secondParticipantId),
                ],
              });
            }}
            disabled={scenario.participants.length === 0}
          >
            Add Step
          </Button>
        </div>
      </Field>
    </div>
  );
};

const WorkspaceSectionForm = ({
  activeSection,
  workspace,
  selectedComponent,
  selectedComponentId,
  setSelectedComponentId,
  selectedContextEntityId,
  selectedScenario,
  setSelectedScenarioId,
  selectedInteractionIndex,
  selectedDataFlowNodeId,
  selectedDataFlowId,
  setSelectedDataFlowNodeId,
  setSelectedDataFlowId,
  selectedRuntimeNodeId,
  selectedRuntimeLinkId,
  selectedCandidateTaskId,
  onOpenComponentDetail,
  onOpenContextDetail,
  onOpenScenarioDetail,
  onOpenInteractionDetail,
  onOpenDataFlowNodeDetail,
  onOpenDataFlowDetail,
  onOpenRuntimeNodeDetail,
  onOpenRuntimeLinkDetail,
  onOpenCandidateTaskDetail,
  canGenerateAiDraft,
  missingDiscoveryInputs,
  aiStatus,
  aiStage,
  aiMessage,
  aiElapsedSeconds,
  importStatus,
  importMessage,
  onGenerateAiDraft,
  onRefineComponentWithAi,
  onChange,
}: {
  activeSection: WorkspaceSectionId;
  workspace: FeatureWorkspace;
  selectedComponent: FeatureComponent | null;
  selectedComponentId: string | null;
  setSelectedComponentId: (componentId: string | null) => void;
  selectedContextEntityId: string | null;
  selectedScenario: FeatureWorkspace["discovery"]["sequenceScenarios"][number] | null;
  setSelectedScenarioId: (scenarioId: string | null) => void;
  selectedInteractionIndex: number | null;
  selectedDataFlowNodeId: string | null;
  selectedDataFlowId: string | null;
  setSelectedDataFlowNodeId: (nodeId: string | null) => void;
  setSelectedDataFlowId: (flowId: string | null) => void;
  selectedRuntimeNodeId: string | null;
  selectedRuntimeLinkId: string | null;
  selectedCandidateTaskId: string | null;
  onOpenComponentDetail: (componentId: string, mode?: ComponentDetailMode) => void;
  onOpenContextDetail: (entityId: string) => void;
  onOpenScenarioDetail: (scenarioId: string) => void;
  onOpenInteractionDetail: (interactionIndex: number) => void;
  onOpenDataFlowNodeDetail: (nodeId: string) => void;
  onOpenDataFlowDetail: (flowId: string) => void;
  onOpenRuntimeNodeDetail: (nodeId: string) => void;
  onOpenRuntimeLinkDetail: (linkId: string) => void;
  onOpenCandidateTaskDetail: (taskId: string) => void;
  canGenerateAiDraft: boolean;
  missingDiscoveryInputs: string[];
  aiStatus: "idle" | "loading" | "success" | "error";
  aiStage: AiStage;
  aiMessage: string;
  aiElapsedSeconds: number;
  importStatus: "idle" | "success" | "error";
  importMessage: string;
  onGenerateAiDraft: () => void;
  onRefineComponentWithAi: (component: FeatureComponent | null) => Promise<void>;
  onChange: (updater: (current: FeatureWorkspace) => FeatureWorkspace) => void;
}) => {
  const updateTimestamp = (next: FeatureWorkspace): FeatureWorkspace => ({
    ...next,
    updatedAt: new Date().toISOString(),
  });
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [activeObjectHelpDialogOpen, setActiveObjectHelpDialogOpen] = useState(false);
  const [implementationHelpDialogOpen, setImplementationHelpDialogOpen] = useState(false);

  switch (activeSection) {
    case "featureDefinition":
      return (
        <div className="grid gap-4">
          <StringListEditor
            label={
              <div className="flex items-center justify-between gap-3">
                <span>Feature Requirements</span>
                <InlineHelpTrigger
                  onClick={() => setHelpDialogOpen(true)}
                  label="Open requirement versus responsibility help"
                />
              </div>
            }
            hint="List the individual feature requirements as numbered requirement statements, for example REQ-1, REQ-2, and REQ-3."
            items={workspace.featureSummary.goals}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                requirement: requirementsToText(items),
                featureSummary: { ...current.featureSummary, goals: items },
              }))
            }
            getItemLabel={(index) => `REQ-${index + 1}`}
            getItemPlaceholder={(index) => `REQ-${index + 1}: Requirement statement`}
          />
          <StringListEditor
            label="Feature Responsibilities"
            hint="Responsibilities are the jobs the system must do to achieve each REQ-x. They help you discover component boundaries."
            items={workspace.discovery.responsibilities}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                discovery: { ...current.discovery, responsibilities: items },
              }))
            }
            getItemLabel={(index) => `RESP-${index + 1}`}
            getItemPlaceholder={(index) => `RESP-${index + 1}: Responsibility statement`}
          />
          <StringListEditor
            label="Constraints"
            items={workspace.featureSummary.constraints}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                featureSummary: { ...current.featureSummary, constraints: items },
              }))
            }
            placeholder="Constraint"
          />
          <StringListEditor
            label="Assumptions"
            items={workspace.featureSummary.assumptions}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                featureSummary: { ...current.featureSummary, assumptions: items },
              }))
            }
            placeholder="Assumption"
          />
          <StringListEditor
            label="Open Questions"
            items={workspace.featureSummary.openQuestions}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                featureSummary: { ...current.featureSummary, openQuestions: items },
              }))
            }
            placeholder="Question"
          />
          <div className="space-y-3 rounded-2xl border border-slate/10 bg-mist/50 px-4 py-4 text-sm text-slate">
            <p className="font-medium text-ink">Generate Discovery Draft</p>
            <p>
              This creates a first-pass architecture draft from the current feature definition. It will propose candidate components, component interactions, and implementation task ideas for you to review and edit.
            </p>
            {importMessage ? (
              <p
                className={`text-xs ${
                  importStatus === "error" ? "text-red-700" : "text-pine"
                }`}
              >
                {importMessage}
              </p>
            ) : null}
            <p
              className={`text-xs ${
                aiStatus === "error"
                  ? "text-red-700"
                  : aiStatus === "success"
                    ? "text-pine"
                    : "text-slate"
              }`}
            >
              {aiMessage ||
                (canGenerateAiDraft
                  ? "Ready to generate the discovery draft from the current inputs."
                  : `Add ${missingDiscoveryInputs.join(", ")} to enable AI drafting.`)}
              {aiStatus === "loading" ? ` ${aiElapsedSeconds}s elapsed.` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={onGenerateAiDraft}
                tone="primary"
                disabled={!canGenerateAiDraft || aiStatus === "loading"}
              >
                {aiStatus === "loading" && aiStage === "discovery"
                  ? "Generating Discovery Draft..."
                  : "Generate Discovery Draft"}
              </Button>
            </div>
            {helpDialogOpen ? (
              <div className="fixed inset-0 z-[70] bg-ink/70 p-4 backdrop-blur-sm">
                <div className="mx-auto max-w-[720px] rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-copper">Field Help</p>
                      <h3 className="mt-2 text-2xl font-semibold text-ink">
                        Requirement vs Responsibility
                      </h3>
                    </div>
                    <Button onClick={() => setHelpDialogOpen(false)} tone="ghost">
                      Close
                    </Button>
                  </div>
                  <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-2xl bg-white px-4 py-3">
                    <RequirementResponsibilityHelpContent />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      );
    case "featureDesign":
      return (
        <div className="space-y-5">
          <ArchitectureViewPanel
            title="Functional / Feature Breakdown"
            description="Explains what the feature must do through its summary, requirements, and responsibilities."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Field
                label="Feature Requirements"
                hint="These come from the Feature Definition tab and define what the feature must achieve."
              >
                <div className="rounded-2xl bg-mist/60 p-4 text-sm text-ink">
                  {workspace.featureSummary.goals.length > 0 ? (
                    <ul className="space-y-2">
                      {workspace.featureSummary.goals.map((goal, index) => (
                        <li key={`${goal}-${index}`}>
                          <span className="font-medium text-copper">REQ-{index + 1}</span>
                          <span className="ml-2">{goal}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate">No feature requirements documented yet.</p>
                  )}
                </div>
              </Field>
              <Field
                label="Feature Responsibilities"
                hint="Responsibilities define the jobs the feature must own and usually drive component boundaries."
              >
                <div className="rounded-2xl bg-mist/60 p-4 text-sm text-ink">
                  {workspace.discovery.responsibilities.length > 0 ? (
                    <ul className="space-y-2">
                      {workspace.discovery.responsibilities.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate">No responsibilities documented yet.</p>
                  )}
                </div>
              </Field>
            </div>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Context Diagram"
            description="Shows the system boundary, external actors, and what crosses into or out of the feature."
          >
            <Field
              label="Context Entities"
              hint="This view shows the external entities around the feature. Click one to open its detail popup and edit its boundary flows there."
            >
              <div className="space-y-4">
                {workspace.discovery.contextEntities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                    No context entities yet. Add one to define something outside the feature boundary, then click it to refine its details.
                  </div>
                ) : (
                  workspace.discovery.contextEntities.map((entity, index) => {
                    const flowCount = workspace.discovery.contextFlows.filter(
                      (flow) => flow.entityId === entity.id,
                    ).length;
                    return (
                      <div
                        key={entity.id}
                        className={designSelectionCardClass(selectedContextEntityId === entity.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenContextDetail(entity.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block font-semibold">
                              {entity.name || "Unnamed entity"}
                            </span>
                            <p className="mt-1 text-sm text-slate">
                              {entity.kind}
                              {entity.description ? ` | ${entity.description}` : ""}
                            </p>
                            <p className="mt-2 text-xs text-slate/80">
                              {flowCount} boundary flow{flowCount === 1 ? "" : "s"}
                            </p>
                          </button>
                          <Button
                            onClick={() =>
                              onChange((current) => ({
                                ...current,
                                discovery: {
                                  ...current.discovery,
                                  contextEntities: current.discovery.contextEntities.filter(
                                    (_, currentIndex) => currentIndex !== index,
                                  ),
                                  contextFlows: current.discovery.contextFlows.filter(
                                    (flow) => flow.entityId !== entity.id,
                                  ),
                                },
                              }))
                            }
                            tone="danger"
                            size="compact"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
                <Button
                  onClick={() => {
                    const entity = createEmptyContextEntity();
                    onChange((current) => ({
                      ...current,
                      discovery: {
                        ...current.discovery,
                        contextEntities: [...current.discovery.contextEntities, entity],
                      },
                    }));
                    onOpenContextDetail(entity.id);
                  }}
                >
                  Add Context Entity
                </Button>
              </div>
            </Field>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Component / Container Diagram"
            description="Identifies the major internal building blocks and the responsibility of each one."
          >
            <Field
              label="Candidate Components"
              hint="This view shows the main component boxes for the feature. Click a component to open its detail popup and refine it there."
            >
              <div className="space-y-4">
                {workspace.discovery.candidateComponents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                    No components yet. Add one to define a feature building block, then click it to refine the detail view.
                  </div>
                ) : (
                  workspace.discovery.candidateComponents.map((candidate, index) => (
                    <div
                      key={candidate.id}
                      className={designSelectionCardClass(selectedComponentId === candidate.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenComponentDetail(candidate.id, "container")}
                            className="min-w-0 flex-1 text-left"
                          >
                          <span className="block font-semibold">
                            {candidate.name || "Unnamed component"}
                          </span>
                          <p className="mt-1 text-sm text-slate">
                            {candidate.responsibility || "No responsibility documented yet."}
                          </p>
                          {candidate.rationale ? (
                            <p className="mt-2 text-xs text-slate/80">{candidate.rationale}</p>
                          ) : null}
                        </button>
                        <Button
                          onClick={() => {
                            const fallbackId =
                              workspace.discovery.candidateComponents[index + 1]?.id ??
                              workspace.discovery.candidateComponents[index - 1]?.id ??
                              null;
                            setSelectedComponentId(
                              selectedComponentId === candidate.id ? fallbackId : selectedComponentId,
                            );
                            onChange((current) => ({
                              ...current,
                              discovery: {
                                ...current.discovery,
                                candidateComponents: current.discovery.candidateComponents.filter(
                                  (item) => item.id !== candidate.id,
                                ),
                                interactions: current.discovery.interactions.filter(
                                  (interaction) =>
                                    interaction.fromComponentId !== candidate.id &&
                                    interaction.toComponentId !== candidate.id,
                                ),
                              },
                              components: current.components.filter((component) => component.id !== candidate.id),
                            }));
                          }}
                          tone="danger"
                          size="compact"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <Button
                  onClick={() => {
                    const candidate = createEmptyCandidateComponent();
                    setSelectedComponentId(candidate.id);
                    onChange((current) => ({
                      ...current,
                      discovery: {
                        ...current.discovery,
                        candidateComponents: [...current.discovery.candidateComponents, candidate],
                      },
                      components: [...current.components, createEmptyComponent(candidate)],
                    }));
                    onOpenComponentDetail(candidate.id);
                  }}
                >
                  Add Candidate Component
                </Button>
              </div>
            </Field>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Interaction Diagram"
            description="Shows which components communicate with each other and by what mechanism."
          >
            <Field
              label="Component Interactions"
              hint="Describe how the candidate components communicate before refining their internal state."
            >
              <div className="space-y-4">
                {workspace.discovery.interactions.map((interaction, index) => (
                  <div
                    key={`${interaction.fromComponentId}-${interaction.toComponentId}-${index}`}
                    className={designSelectionCardClass(selectedInteractionIndex === index)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenInteractionDetail(index)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block font-semibold">
                          {formatInteractionName(workspace, interaction)}
                        </span>
                        <p className="mt-1 text-sm text-slate">
                          {interaction.mechanism}
                          {interaction.data ? ` | ${interaction.data}` : ""}
                        </p>
                      </button>
                      <Button
                        onClick={() =>
                          onChange((current) => ({
                            ...current,
                            discovery: {
                              ...current.discovery,
                              interactions: current.discovery.interactions.filter(
                                (_, currentIndex) => currentIndex !== index,
                              ),
                            },
                          }))
                        }
                        tone="danger"
                        size="compact"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  onClick={() => {
                    if (workspace.discovery.candidateComponents.length < 2) {
                      return;
                    }
                    const first = workspace.discovery.candidateComponents[0];
                    const second = workspace.discovery.candidateComponents[1];
                    onChange((current) => ({
                      ...current,
                      discovery: {
                        ...current.discovery,
                        interactions: [
                          ...current.discovery.interactions,
                          {
                            fromComponentId: first.id,
                            toComponentId: second.id,
                            mechanism: "queue",
                            data: "",
                            notes: "",
                          },
                        ],
                      },
                    }));
                    onOpenInteractionDetail(workspace.discovery.interactions.length);
                  }}
                >
                  Add Interaction
                </Button>
              </div>
            </Field>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Data Flow Diagram"
            description="Shows what information moves through the feature, where it is transformed, and where it is stored."
          >
            <div className="space-y-4">
              <Field
                label="Data Flow Nodes"
                hint="Model external entities, internal processes, and data stores that participate in the information path."
              >
                <div className="space-y-3">
                  {workspace.discovery.dataFlowNodes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                      No data flow nodes yet. Add one to describe an external entity, process, or data store in this feature.
                    </div>
                  ) : (
                    workspace.discovery.dataFlowNodes.map((node, index) => (
                      <div
                        key={node.id}
                        className={designSelectionCardClass(selectedDataFlowNodeId === node.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenDataFlowNodeDetail(node.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block font-semibold">
                              {node.name || "Unnamed data flow node"}
                            </span>
                            <p className="mt-1 text-sm text-slate">
                              {node.kind}
                              {node.description ? ` | ${node.description}` : ""}
                            </p>
                          </button>
                          <Button
                            onClick={() => {
                              const fallbackId =
                                workspace.discovery.dataFlowNodes[index + 1]?.id ??
                                workspace.discovery.dataFlowNodes[index - 1]?.id ??
                                null;
                              setSelectedDataFlowNodeId(
                                selectedDataFlowNodeId === node.id ? fallbackId : selectedDataFlowNodeId,
                              );
                              onChange((current) => ({
                                ...current,
                                discovery: {
                                  ...current.discovery,
                                  dataFlowNodes: current.discovery.dataFlowNodes.filter(
                                    (item) => item.id !== node.id,
                                  ),
                                  dataFlows: current.discovery.dataFlows.filter(
                                    (flow) =>
                                      flow.fromNodeId !== node.id && flow.toNodeId !== node.id,
                                  ),
                                },
                              }));
                            }}
                            tone="danger"
                            size="compact"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  <Button
                    onClick={() => {
                      const node = createEmptyDataFlowNode();
                      setSelectedDataFlowNodeId(node.id);
                      onChange((current) => ({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          dataFlowNodes: [...current.discovery.dataFlowNodes, node],
                        },
                      }));
                      onOpenDataFlowNodeDetail(node.id);
                    }}
                  >
                    Add Data Flow Node
                  </Button>
                </div>
              </Field>

              <Field
                label="Data Flows"
                hint="Describe the actual payloads or records that move between those nodes."
              >
                <div className="space-y-3">
                  {workspace.discovery.dataFlowNodes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-4 text-sm text-slate">
                      Add at least one data flow node before defining data flows.
                    </div>
                  ) : null}
                  {workspace.discovery.dataFlows.map((flow) => (
                    <div
                      key={flow.id}
                      className={designSelectionCardClass(selectedDataFlowId === flow.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenDataFlowDetail(flow.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block font-semibold">
                            {formatDataFlowName(workspace, flow)}
                          </span>
                          <p className="mt-1 text-sm text-slate">
                            {flow.label || "No data label yet."}
                          </p>
                        </button>
                        <Button
                          onClick={() =>
                            onChange((current) => ({
                              ...current,
                              discovery: {
                                ...current.discovery,
                                dataFlows: current.discovery.dataFlows.filter(
                                  (item) => item.id !== flow.id,
                                ),
                              },
                            }))
                          }
                          tone="danger"
                          size="compact"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={() => {
                      const nextFlow = createEmptyDataFlow(
                        workspace.discovery.dataFlowNodes[0]?.id ?? "",
                        workspace.discovery.dataFlowNodes[1]?.id ??
                          workspace.discovery.dataFlowNodes[0]?.id ??
                          "",
                      );
                      setSelectedDataFlowId(nextFlow.id);
                      onChange((current) => {
                        const firstNodeId = current.discovery.dataFlowNodes[0]?.id ?? "";
                        const secondNodeId =
                          current.discovery.dataFlowNodes[1]?.id ?? firstNodeId;
                        return {
                          ...current,
                          discovery: {
                            ...current.discovery,
                            dataFlows: [
                              ...current.discovery.dataFlows,
                              {
                                ...nextFlow,
                                fromNodeId: firstNodeId,
                                toNodeId: secondNodeId,
                              },
                            ],
                          },
                        };
                      });
                      onOpenDataFlowDetail(nextFlow.id);
                    }}
                    disabled={workspace.discovery.dataFlowNodes.length === 0}
                  >
                    Add Data Flow
                  </Button>
                </div>
              </Field>
            </div>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="State Diagram"
            description="Brainstorm internal objects first, then model state only for the objects that actually behave over time."
          >
            <Field
              label={
                <div className="flex items-center justify-between gap-3">
                  <span>Component Details</span>
                  <InlineHelpTrigger
                    onClick={() => setActiveObjectHelpDialogOpen(true)}
                    label="Open active object and state help"
                  />
                </div>
              }
              hint="Each feature workspace can hold multiple components. Refine one component at a time, then define its internal objects before modeling states."
            >
              <div className="space-y-3">
                {workspace.components.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                    No components yet. Add candidate components first, then refine one here.
                  </div>
                ) : (
                  workspace.components.map((component) => {
                    const active = component.id === selectedComponent?.id;
                    return (
                      <div
                        key={component.id}
                        className={designSelectionCardClass(active)}
                      >
                        <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => onOpenComponentDetail(component.id, "state")}
                              className="min-w-0 flex-1 text-left"
                            >
                            <span className="block font-semibold">
                              {component.name || "Unnamed component"}
                            </span>
                            <p className="mt-1 text-sm text-slate">
                              {component.summary || "No component summary yet."}
                            </p>
                            <p className="mt-2 text-xs text-slate/80">
                              {component.objects.length} object{component.objects.length === 1 ? "" : "s"} |{" "}
                              {component.objects.filter((object) => object.needsState).length} with state
                            </p>
                          </button>
                          <div className="group relative shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                setSelectedComponentId(component.id);
                                await onRefineComponentWithAi(component);
                              }}
                              disabled={
                                !canRefineComponentWithAi(workspace, component.id) ||
                                (aiStatus === "loading" && aiStage === "component")
                              }
                              className="rounded-xl border border-copper/30 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-copper transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {aiStatus === "loading" &&
                              aiStage === "component" &&
                              selectedComponentId === component.id
                                ? "refining"
                                : "refine"}
                            </button>
                            <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden w-56 rounded-xl bg-ink px-3 py-2 text-[11px] leading-5 text-white shadow-lg group-hover:block">
                              Use AI to refine this component’s internal design, including inputs, outputs, events, states, failures, and debugging hooks.
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Field>
            {activeObjectHelpDialogOpen ? (
              <div className="fixed inset-0 z-[70] bg-ink/70 p-4 backdrop-blur-sm">
                <div className="mx-auto max-w-[720px] rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-copper">Field Help</p>
                      <h3 className="mt-2 text-2xl font-semibold text-ink">
                        Active Object And State
                      </h3>
                    </div>
                    <Button onClick={() => setActiveObjectHelpDialogOpen(false)} tone="ghost">
                      Close
                    </Button>
                  </div>
                  <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-2xl bg-white px-4 py-3">
                    <ActiveObjectStateHelpContent />
                  </div>
                </div>
              </div>
            ) : null}
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Sequence Diagram"
            description="Shows how one scenario unfolds step by step across components over time."
          >
            <Field
              label="Runtime Scenarios"
              hint="Capture one scenario at a time so the sequence diagram can show who participates and what order messages occur."
            >
              <div className="space-y-3">
                {workspace.discovery.sequenceScenarios.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                    No scenarios yet. Add one to describe a concrete runtime flow such as command handling, startup, or error recovery.
                  </div>
                ) : (
                  workspace.discovery.sequenceScenarios.map((scenario) => {
                    const active = scenario.id === selectedScenario?.id;
                    return (
                      <div
                        key={scenario.id}
                        className={designSelectionCardClass(active)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenScenarioDetail(scenario.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block font-semibold">
                              {scenario.name || "Unnamed scenario"}
                            </span>
                            <p className="mt-1 text-sm text-slate">
                              {scenario.trigger || "No trigger documented yet."}
                            </p>
                          </button>
                          <Button
                            onClick={() =>
                              onChange((current) =>
                                updateTimestamp({
                                  ...current,
                                  discovery: {
                                    ...current.discovery,
                                    sequenceScenarios: current.discovery.sequenceScenarios.filter(
                                      (item) => item.id !== scenario.id,
                                    ),
                                  },
                                }),
                              )
                            }
                            tone="danger"
                            size="compact"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
                <Button
                  onClick={() => {
                    const nextScenario = createEmptySequenceScenario();
                    setSelectedScenarioId(nextScenario.id);
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          sequenceScenarios: [
                            ...current.discovery.sequenceScenarios,
                            nextScenario,
                          ],
                        },
                      }),
                    );
                  }}
                >
                  Add Scenario
                </Button>
              </div>
            </Field>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Deployment / Runtime Diagram"
            description="Shows where execution runs: tasks, threads, processes, services, devices, and other runtime boundaries."
          >
            <div className="space-y-4">
              <Field
                label="Runtime Nodes"
                hint="Model the execution and hardware/runtime nodes that participate in this feature."
              >
                <div className="space-y-3">
                  {workspace.discovery.runtimeNodes.map((node, index) => (
                    <div
                      key={node.id}
                      className={designSelectionCardClass(selectedRuntimeNodeId === node.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenRuntimeNodeDetail(node.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block font-semibold">
                            {node.name || "Unnamed runtime node"}
                          </span>
                          <p className="mt-1 text-sm text-slate">
                            {node.kind}
                            {node.responsibility ? ` | ${node.responsibility}` : ""}
                          </p>
                          {node.hostNodeId ? (
                            <p className="mt-1 text-sm text-slate/85">
                              Inside{" "}
                              {getRuntimeNodeNameById(
                                workspace.discovery.runtimeNodes,
                                node.hostNodeId,
                              )}
                            </p>
                          ) : null}
                        </button>
                        <Button
                          onClick={() =>
                            onChange((current) => ({
                              ...current,
                              discovery: {
                                ...current.discovery,
                                runtimeNodes: current.discovery.runtimeNodes
                                  .filter((_, currentIndex) => currentIndex !== index)
                                  .map((candidateNode) =>
                                    candidateNode.hostNodeId === node.id
                                      ? { ...candidateNode, hostNodeId: "" }
                                      : candidateNode,
                                  ),
                                runtimeLinks: current.discovery.runtimeLinks.filter(
                                  (link) =>
                                    link.fromNodeId !== node.id && link.toNodeId !== node.id,
                                ),
                              },
                            }))
                          }
                          tone="danger"
                          size="compact"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={() => {
                      const defaultHostId =
                        workspace.discovery.runtimeNodes.find((candidate) =>
                          ["mcu", "core", "device", "peripheral", "service", "other"].includes(
                            candidate.kind,
                          ),
                        )?.id ?? "";
                      const nextNode = createEmptyRuntimeNode(defaultHostId);
                      onOpenRuntimeNodeDetail(nextNode.id);
                      onChange((current) => {
                        return {
                          ...current,
                          discovery: {
                            ...current.discovery,
                            runtimeNodes: [
                              ...current.discovery.runtimeNodes,
                              nextNode,
                            ],
                          },
                        };
                      });
                    }}
                  >
                    Add Runtime Node
                  </Button>
                </div>
              </Field>

              <Field
                label="Runtime Links"
                hint="Describe how runtime nodes are connected through queues, interrupts, driver calls, timers, or shared resources."
              >
                <div className="space-y-3">
                  {workspace.discovery.runtimeNodes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-4 text-sm text-slate">
                      Add at least one runtime node before defining runtime links.
                    </div>
                  ) : null}
                  {workspace.discovery.runtimeLinks.map((link, index) => (
                    <div
                      key={link.id}
                      className={designSelectionCardClass(selectedRuntimeLinkId === link.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenRuntimeLinkDetail(link.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block font-semibold">
                            {formatRuntimeLinkName(workspace, link)}
                          </span>
                          <p className="mt-1 text-sm text-slate">
                            {link.kind}
                            {link.label ? ` | ${link.label}` : ""}
                          </p>
                        </button>
                        <Button
                          onClick={() =>
                            onChange((current) => ({
                              ...current,
                              discovery: {
                                ...current.discovery,
                                runtimeLinks: current.discovery.runtimeLinks.filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              },
                            }))
                          }
                          tone="danger"
                          size="compact"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={() => {
                      const nextLink = createEmptyRuntimeLink(
                        workspace.discovery.runtimeNodes[0]?.id ?? "",
                        workspace.discovery.runtimeNodes[1]?.id ??
                          workspace.discovery.runtimeNodes[0]?.id ??
                          "",
                      );
                      onOpenRuntimeLinkDetail(nextLink.id);
                      onChange((current) => {
                        const firstNodeId = current.discovery.runtimeNodes[0]?.id ?? "";
                        const secondNodeId =
                          current.discovery.runtimeNodes[1]?.id ?? firstNodeId;
                        return {
                          ...current,
                          discovery: {
                            ...current.discovery,
                            runtimeLinks: [
                              ...current.discovery.runtimeLinks,
                              {
                                ...nextLink,
                                fromNodeId: firstNodeId,
                                toNodeId: secondNodeId,
                              },
                            ],
                          },
                        };
                      });
                    }}
                    disabled={workspace.discovery.runtimeNodes.length === 0}
                  >
                    Add Runtime Link
                  </Button>
                </div>
              </Field>

              <Field
                label="Candidate Tasks"
                hint="Capture the execution units that likely carry this feature as part of the design."
              >
                <div className="space-y-3">
                  {workspace.discovery.candidateTasks.map((task, index) => (
                    <div
                      key={task.id}
                      className={designSelectionCardClass(selectedCandidateTaskId === task.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenCandidateTaskDetail(task.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block font-semibold">
                            {task.name || "Unnamed candidate task"}
                          </span>
                          <p className="mt-1 text-sm text-slate">
                            {task.type}
                            {task.priority ? ` | ${task.priority}` : ""}
                            {task.responsibility ? ` | ${task.responsibility}` : ""}
                          </p>
                          <p className="mt-1 text-sm text-slate/85">
                            {task.trigger || "No trigger documented yet."}
                          </p>
                        </button>
                      <Button
                        onClick={() =>
                          onChange((current) => ({
                            ...current,
                            discovery: {
                              ...current.discovery,
                              candidateTasks: current.discovery.candidateTasks.filter(
                                (_, currentIndex) => currentIndex !== index,
                              ),
                            },
                          }))
                        }
                        tone="danger"
                        size="compact"
                      >
                        Remove
                      </Button>
                    </div>
                    </div>
                  ))}
                  <Button
                    onClick={() => {
                      const nextTask = createEmptyCandidateTask();
                      onOpenCandidateTaskDetail(nextTask.id);
                      onChange((current) => ({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          candidateTasks: [
                            ...current.discovery.candidateTasks,
                            nextTask,
                          ],
                        },
                      }));
                    }}
                  >
                    Add Candidate Task
                  </Button>
                </div>
              </Field>
            </div>
          </ArchitectureViewPanel>
        </div>
      );
    case "implementationMapping":
      return (
        <div className="space-y-5">
          <ArchitectureViewPanel
            title={
              <div className="flex items-center justify-between gap-3">
                <span>Implementation Mapping Guide</span>
                <InlineHelpTrigger
                  onClick={() => setImplementationHelpDialogOpen(true)}
                  label="Open implementation mapping help"
                />
              </div>
            }
            description="Turn the design into code-facing units and a build order without losing traceability back to requirements, components, runtime nodes, and candidate tasks."
          >
            <div className="grid gap-4">
              <StringListEditor
                label="Implementation Rules"
                hint="Capture rules the code should follow, such as layering, ownership, error handling, or threading boundaries."
                items={workspace.implementation.rules}
                onChange={(items) =>
                  onChange((current) => ({
                    ...current,
                    implementation: { ...current.implementation, rules: items },
                  }))
                }
                placeholder="Implementation rule"
              />
            </div>
            {implementationHelpDialogOpen ? (
              <div className="fixed inset-0 z-[70] bg-ink/70 p-4 backdrop-blur-sm">
                <div className="mx-auto max-w-[720px] rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-copper">Field Help</p>
                      <h3 className="mt-2 text-2xl font-semibold text-ink">
                        Implementation Mapping Guide
                      </h3>
                    </div>
                    <Button onClick={() => setImplementationHelpDialogOpen(false)} tone="ghost">
                      Close
                    </Button>
                  </div>
                  <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-2xl bg-white px-4 py-3">
                    <ImplementationMappingHelpContent />
                  </div>
                </div>
              </div>
            ) : null}
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Implementation Steps"
            description="Start from the build slices first. This is the main implementation view and usually easier to maintain than reading all code units at once."
          >
            <div className="space-y-4">
              {workspace.implementation.steps.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                  No implementation steps yet. Add the first slice you would build and how you would verify it.
                </div>
              ) : (
                workspace.implementation.steps.map((step, index) => (
                  <ImplementationStepEditor
                    key={step.id}
                    step={step}
                    units={workspace.implementation.units}
                    onChange={(nextStep) =>
                      onChange((current) => ({
                        ...current,
                        implementation: {
                          ...current.implementation,
                          steps: current.implementation.steps.map((item) =>
                            item.id === nextStep.id ? nextStep : item,
                          ),
                        },
                      }))
                    }
                    onRemove={() =>
                      onChange((current) => ({
                        ...current,
                        implementation: {
                          ...current.implementation,
                          steps: current.implementation.steps.filter((item) => item.id !== step.id),
                        },
                      }))
                    }
                    index={index}
                  />
                ))
              )}
              <Button
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    implementation: {
                      ...current.implementation,
                      steps: [...current.implementation.steps, createEmptyImplementationStep()],
                    },
                  }))
                }
              >
                Add Implementation Step
              </Button>
            </div>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Code Units"
            description="Define the code-facing ownership blocks after the steps are clear. Keep the main unit summary simple and use advanced traceability only when needed."
          >
            <div className="space-y-4">
              {workspace.implementation.units.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                  No implementation units yet. Add one to map a piece of the design into a module, adapter, worker, store, or interface.
                </div>
              ) : (
                workspace.implementation.units.map((unit, index) => (
                  <ImplementationUnitEditor
                    key={unit.id}
                    unit={unit}
                    requirementLabels={workspace.featureSummary.goals.map((_, goalIndex) => `REQ-${goalIndex + 1}`)}
                    components={workspace.discovery.candidateComponents}
                    runtimeNodes={workspace.discovery.runtimeNodes}
                    candidateTasks={workspace.discovery.candidateTasks}
                    onChange={(nextUnit) =>
                      onChange((current) => ({
                        ...current,
                        implementation: {
                          ...current.implementation,
                          units: current.implementation.units.map((item) =>
                            item.id === nextUnit.id ? nextUnit : item,
                          ),
                        },
                      }))
                    }
                    onRemove={() =>
                      onChange((current) => ({
                        ...current,
                        implementation: {
                          ...current.implementation,
                          units: current.implementation.units.filter((item) => item.id !== unit.id),
                          steps: current.implementation.steps.map((step) => ({
                            ...step,
                            moduleIds: step.moduleIds.filter((moduleId) => moduleId !== unit.id),
                          })),
                        },
                      }))
                    }
                    index={index}
                  />
                ))
              )}
              <Button
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    implementation: {
                      ...current.implementation,
                      units: [...current.implementation.units, createEmptyImplementationUnit()],
                    },
                  }))
                }
              >
                Add Implementation Unit
              </Button>
            </div>
          </ArchitectureViewPanel>
        </div>
      );
    default:
      return null;
  }
};

const ComponentContainerEditor = ({
  component,
  candidate,
  onChange,
}: {
  component: FeatureComponent;
  candidate: ComponentCandidate | null;
  onChange: (component: FeatureComponent, candidate: ComponentCandidate | null) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Component Boundary"
      hint="Focus this view on what the component is responsible for, what crosses its boundary, and its non-state design ownership."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Component Name</SectionInputLabel>
          <TextInput
            value={candidate?.name ?? component.name}
            onChange={(value) =>
              onChange(
                {
                  ...component,
                  name: value,
                },
                candidate
                  ? {
                      ...candidate,
                      name: value,
                    }
                  : null,
              )
            }
            placeholder="Component name"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Component Responsibility</SectionInputLabel>
          <TextArea
            value={candidate?.responsibility ?? component.summary}
            onChange={(value) =>
              onChange(
                {
                  ...component,
                  summary: value,
                },
                candidate
                  ? {
                      ...candidate,
                      responsibility: value,
                    }
                  : null,
              )
            }
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Rationale</SectionInputLabel>
          <TextArea
            value={candidate?.rationale ?? ""}
            onChange={(value) =>
              onChange(
                component,
                candidate
                  ? {
                      ...candidate,
                      rationale: value,
                    }
                  : null,
              )
            }
            placeholder="Why does this component exist?"
            rows={2}
          />
        </div>
      </div>
    </Field>
    <StringListEditor
      label="Inputs"
      items={component.inputs}
      onChange={(items) => onChange({ ...component, inputs: items }, candidate)}
      placeholder="Input"
    />
    <StringListEditor
      label="Outputs"
      items={component.outputs}
      onChange={(items) => onChange({ ...component, outputs: items }, candidate)}
      placeholder="Output"
    />
    <EventListEditor
      title="Incoming Events"
      hint="Events coming from outside the component that this component reacts to."
      items={component.incomingEvents}
      onChange={(items) => onChange({ ...component, incomingEvents: items }, candidate)}
    />
    <EventListEditor
      title="Internal Signals"
      hint="Signals generated by the component itself and used by its internal behavior."
      items={component.internalSignals}
      onChange={(items) => onChange({ ...component, internalSignals: items }, candidate)}
    />
    <EventListEditor
      title="Outgoing Signals"
      hint="Signals or events this component emits for other components to handle."
      items={component.outgoingSignals}
      onChange={(items) => onChange({ ...component, outgoingSignals: items }, candidate)}
    />
    <ObjectListEditor<OwnershipDefinition>
      label="Resource Ownership"
      items={component.ownership}
      onChange={(items) => onChange({ ...component, ownership: items }, candidate)}
      template={{ resource: "", owner: "", accessRules: "" }}
      fields={[
        { key: "resource", label: "Resource" },
        { key: "owner", label: "Owner" },
        { key: "accessRules", label: "Access Rules", type: "textarea" },
      ]}
    />
    <ObjectListEditor<FailureModeDefinition>
      label="Failure Modes"
      items={component.failureModes}
      onChange={(items) => onChange({ ...component, failureModes: items }, candidate)}
      template={{ scenario: "", impact: "", recovery: "" }}
      fields={[
        { key: "scenario", label: "Failure Scenario" },
        { key: "impact", label: "Impact", type: "textarea" },
        { key: "recovery", label: "Recovery", type: "textarea" },
      ]}
    />
    <StringListEditor
      label="Logs"
      items={component.debugging.logs}
      onChange={(items) =>
        onChange(
          {
            ...component,
            debugging: { ...component.debugging, logs: items },
          },
          candidate,
        )
      }
      placeholder="Log signal"
    />
    <StringListEditor
      label="Trace Points"
      items={component.debugging.traces}
      onChange={(items) =>
        onChange(
          {
            ...component,
            debugging: { ...component.debugging, traces: items },
          },
          candidate,
        )
      }
      placeholder="Trace point"
    />
    <StringListEditor
      label="Observability Points"
      items={component.debugging.observability}
      onChange={(items) =>
        onChange(
          {
            ...component,
            debugging: { ...component.debugging, observability: items },
          },
          candidate,
        )
      }
      placeholder="Observability point"
    />
  </div>
);

const ComponentStateEditor = ({
  component,
  selectedObjectId,
  onSelectObject,
  onChange,
}: {
  component: FeatureComponent;
  selectedObjectId: string | null;
  onSelectObject: (objectId: string | null) => void;
  onChange: (component: FeatureComponent) => void;
}) => {
  const selectedObject =
    component.objects.find((object) => object.id === selectedObjectId) ??
    component.objects[0] ??
    null;

  const updateObject = (objectId: string, updater: (object: ComponentObject) => ComponentObject) =>
    onChange({
      ...component,
      objects: component.objects.map((object) =>
        object.id === objectId ? updater(object) : object,
      ),
    });

  return (
    <div className="space-y-4">
      <Field
        label="Internal Objects"
        hint="Brainstorm the objects inside this component first. Then decide which objects are active and which ones need state."
      >
        <div className="space-y-3">
          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate">
            <p className="font-semibold text-ink">{component.name || "Unnamed component"}</p>
            <p className="mt-1">{component.summary || "No component summary yet."}</p>
          </div>
          {component.objects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate/20 bg-mist/45 p-4 text-sm text-slate">
              No internal objects yet. Add one to capture what exists inside this component before modeling state.
            </div>
          ) : null}
          {component.objects.map((object) => {
            const active = selectedObject?.id === object.id;
            return (
              <div key={object.id} className={designSelectionCardClass(active)}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectObject(object.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block font-semibold">
                      {object.name || "Unnamed object"}
                    </span>
                    <p className="mt-1 text-sm text-slate">
                      {object.objectType === "active" ? "Active object" : "Passive object"}
                      {object.responsibility ? ` | ${object.responsibility}` : ""}
                    </p>
                    <p className="mt-2 text-xs text-slate/80">
                      {object.needsState
                        ? `${object.states.length} state(s) modeled`
                        : "No state modeled"}
                    </p>
                  </button>
                  <Button
                    onClick={() => {
                      const remaining = component.objects.filter((item) => item.id !== object.id);
                      onChange({
                        ...component,
                        objects: remaining,
                        objectInteractions: component.objectInteractions.filter(
                          (interaction) =>
                            interaction.fromObjectId !== object.id &&
                            interaction.toObjectId !== object.id,
                        ),
                      });
                      onSelectObject(remaining[0]?.id ?? null);
                    }}
                    tone="danger"
                    size="compact"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            onClick={() => {
              const nextObject = createEmptyComponentObject();
              onChange({
                ...component,
                objects: [...component.objects, nextObject],
              });
              onSelectObject(nextObject.id);
            }}
          >
            Add Internal Object
          </Button>
        </div>
      </Field>

      {selectedObject ? (
        <Field
          label="Selected Object"
          hint="Describe this object, decide whether it is active or passive, and only then model its states if needed."
        >
          <div className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4">
            <div className="space-y-1.5">
              <SectionInputLabel>Object Name</SectionInputLabel>
              <TextInput
                value={selectedObject.name}
                onChange={(value) =>
                  updateObject(selectedObject.id, (object) => ({ ...object, name: value }))
                }
                placeholder="Object name"
              />
            </div>
            <div className="space-y-1.5">
              <SectionInputLabel>Responsibility</SectionInputLabel>
              <TextArea
                value={selectedObject.responsibility}
                onChange={(value) =>
                  updateObject(selectedObject.id, (object) => ({
                    ...object,
                    responsibility: value,
                  }))
                }
                rows={3}
                placeholder="What does this object do inside the component?"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <SectionInputLabel>Object Type</SectionInputLabel>
                <Select
                  value={selectedObject.objectType}
                  onChange={(value) =>
                    updateObject(selectedObject.id, (object) => ({
                      ...object,
                      objectType: value === "active" ? "active" : "passive",
                    }))
                  }
                  options={["active", "passive"]}
                />
              </div>
              <div className="space-y-1.5">
                <SectionInputLabel>Needs State</SectionInputLabel>
                <Select
                  value={selectedObject.needsState ? "yes" : "no"}
                  onChange={(value) =>
                    updateObject(selectedObject.id, (object) => ({
                      ...object,
                      needsState: value === "yes",
                      states: value === "yes" ? object.states : [],
                    }))
                  }
                  options={["yes", "no"]}
                />
              </div>
            </div>
          </div>
        </Field>
      ) : null}

      <Field
        label="Object Interactions"
        hint="Capture how objects inside this component collaborate with each other."
      >
        <div className="space-y-4">
          {component.objectInteractions.length === 0 ? (
            <p className="text-sm text-slate">No object interactions yet.</p>
          ) : null}
          {component.objectInteractions.map((interaction, index) => (
            <div
              key={`${interaction.fromObjectId}-${interaction.toObjectId}-${index}`}
              className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <SectionInputLabel>From Object</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={interaction.fromObjectId}
                    onChange={(event) => {
                      const next = [...component.objectInteractions];
                      next[index] = { ...next[index], fromObjectId: event.target.value };
                      onChange({ ...component, objectInteractions: next });
                    }}
                  >
                    <option value="">Select object</option>
                    {component.objects.map((object) => (
                      <option key={object.id} value={object.id}>
                        {object.name || "Unnamed object"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>To Object</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={interaction.toObjectId}
                    onChange={(event) => {
                      const next = [...component.objectInteractions];
                      next[index] = { ...next[index], toObjectId: event.target.value };
                      onChange({ ...component, objectInteractions: next });
                    }}
                  >
                    <option value="">Select object</option>
                    {component.objects.map((object) => (
                      <option key={object.id} value={object.id}>
                        {object.name || "Unnamed object"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <SectionInputLabel>Relationship</SectionInputLabel>
                <TextInput
                  value={interaction.relationship}
                  onChange={(value) => {
                    const next = [...component.objectInteractions];
                    next[index] = { ...next[index], relationship: value };
                    onChange({ ...component, objectInteractions: next });
                  }}
                  placeholder="e.g. sends work to, reads from, updates"
                />
              </div>
              <div className="space-y-1.5">
                <SectionInputLabel>Notes</SectionInputLabel>
                <TextArea
                  value={interaction.notes ?? ""}
                  onChange={(value) => {
                    const next = [...component.objectInteractions];
                    next[index] = { ...next[index], notes: value };
                    onChange({ ...component, objectInteractions: next });
                  }}
                  rows={2}
                  placeholder="Optional detail"
                />
              </div>
              <Button
                onClick={() =>
                  onChange({
                    ...component,
                    objectInteractions: component.objectInteractions.filter(
                      (_, currentIndex) => currentIndex !== index,
                    ),
                  })
                }
                tone="danger"
                size="compact"
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            onClick={() =>
              onChange({
                ...component,
                objectInteractions: [
                  ...component.objectInteractions,
                  {
                    fromObjectId: component.objects[0]?.id ?? "",
                    toObjectId: component.objects[1]?.id ?? component.objects[0]?.id ?? "",
                    relationship: "",
                    notes: "",
                  },
                ],
              })
            }
            disabled={component.objects.length === 0}
          >
            Add Object Interaction
          </Button>
        </div>
      </Field>

      {selectedObject?.needsState ? (
        <StateListEditor
          items={selectedObject.states}
          onChange={(items) =>
            updateObject(selectedObject.id, (object) => ({ ...object, states: items }))
          }
        />
      ) : selectedObject ? (
        <div className="rounded-2xl border border-dashed border-slate/20 bg-mist/45 p-4 text-sm text-slate">
          This object does not currently need state. Turn on <span className="font-medium text-ink">Needs State</span> when this object has meaningful lifecycle modes like idle, waiting, processing, retrying, or failed.
        </div>
      ) : null}
    </div>
  );
};
