import { createEmptyComponent, createEmptyWorkspace } from "../schema/defaults";
import type {
  ComponentCandidate,
  ContextEntity,
  InteractionMechanism,
  EventDefinition,
  FeatureComponent,
  FeatureWorkspace,
  OwnershipDefinition,
  FailureModeDefinition,
  StateDefinition,
} from "../schema/workspace";

const STORAGE_KEY = "archflow.workspaces.v2";
const LEGACY_STORAGE_KEY = "archflow.designs.v1";

type StoredPayload = {
  version: 2;
  workspaces: FeatureWorkspace[];
};

type LegacyFirmwareDesign = {
  id: string;
  title: string;
  requirement: string;
  createdAt: string;
  updatedAt: string;
  featureSummary?: {
    summary?: string;
    purpose?: string;
    constraints?: string[];
  };
  systemPurpose?: {
    shouldDo?: string[];
    shouldNotDo?: string[];
    successCriteria?: string[];
    failureCriteria?: string[];
    boundaries?: string[];
  };
  io?: {
    inputs?: string[];
    outputs?: string[];
  };
  events?: EventDefinition[];
  states?: StateDefinition[];
  responsibilities?: Array<{ responsibility?: string; module?: string; notes?: string }>;
  interactions?: Array<{ from?: string; to?: string; mechanism?: InteractionMechanism; data?: string; notes?: string }>;
  rtos?: {
    tasks?: Array<{
      name?: string;
      responsibility?: string;
      priority?: "high" | "medium" | "low";
      type?: "periodic" | "event-driven" | "background" | "worker";
      trigger?: string;
      mayBlock?: boolean;
      notes?: string;
    }>;
    synchronization?: string[];
    timingRisks?: string[];
  };
  ownership?: OwnershipDefinition[];
  failureModes?: FailureModeDefinition[];
  debugging?: {
    logs?: string[];
    traces?: string[];
    observability?: string[];
  };
};

const isBrowser = typeof window !== "undefined";

const createComponentId = (index: number): string => `legacy-component-${index}-${Math.random().toString(36).slice(2, 7)}`;
const createTaskId = (index: number): string => `legacy-task-${index}-${Math.random().toString(36).slice(2, 7)}`;
const createContextEntityId = (index: number): string =>
  `legacy-context-entity-${index}-${Math.random().toString(36).slice(2, 7)}`;
const migrateLegacyDesign = (legacy: LegacyFirmwareDesign): FeatureWorkspace => {
  const candidateComponents: ComponentCandidate[] =
    legacy.responsibilities?.map((item, index) => ({
      id: createComponentId(index),
      name: item.module?.trim() || `Component ${index + 1}`,
      responsibility: item.responsibility?.trim() || "",
      rationale: item.notes?.trim() || "",
    })) ?? [];

  const componentMap = new Map<string, FeatureComponent>();
  for (const candidate of candidateComponents) {
    componentMap.set(
      candidate.id,
      {
        ...createEmptyComponent(candidate),
        summary: candidate.responsibility,
        inputs: legacy.io?.inputs ?? [],
        outputs: legacy.io?.outputs ?? [],
        incomingEvents: legacy.events ?? [],
        internalSignals: [],
        outgoingSignals: [],
        states: legacy.states ?? [],
        ownership: legacy.ownership ?? [],
        failureModes: legacy.failureModes ?? [],
        debugging: {
          logs: legacy.debugging?.logs ?? [],
          traces: legacy.debugging?.traces ?? [],
          observability: legacy.debugging?.observability ?? [],
        },
      },
    );
  }

  if (candidateComponents.length === 0) {
    const fallbackId = createComponentId(0);
    candidateComponents.push({
      id: fallbackId,
      name: legacy.title || "Legacy Component",
      responsibility: legacy.featureSummary?.summary || "Migrated from flat firmware design",
      rationale: "Auto-created during workspace migration",
    });
    componentMap.set(
      fallbackId,
      {
        ...createEmptyComponent({ id: fallbackId, name: legacy.title || "Legacy Component" }),
        summary: legacy.featureSummary?.summary || "",
        inputs: legacy.io?.inputs ?? [],
        outputs: legacy.io?.outputs ?? [],
        incomingEvents: legacy.events ?? [],
        internalSignals: [],
        outgoingSignals: [],
        states: legacy.states ?? [],
        ownership: legacy.ownership ?? [],
        failureModes: legacy.failureModes ?? [],
        debugging: {
          logs: legacy.debugging?.logs ?? [],
          traces: legacy.debugging?.traces ?? [],
          observability: legacy.debugging?.observability ?? [],
        },
      },
    );
  }

  const nameToId = new Map(candidateComponents.map((item) => [item.name, item.id]));
  const legacyContextEntities: ContextEntity[] = [
    ...(legacy.io?.inputs ?? []).map((input, index) => ({
      id: createContextEntityId(index),
      name: input,
      kind: "other" as const,
      description: "Migrated from legacy input list",
    })),
    ...(legacy.io?.outputs ?? []).map((output, index) => ({
      id: createContextEntityId(index + (legacy.io?.inputs?.length ?? 0)),
      name: output,
      kind: "other" as const,
      description: "Migrated from legacy output list",
    })),
  ];

  return {
    id: legacy.id,
    title: legacy.title,
    requirement: legacy.requirement,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    featureSummary: {
      summary: legacy.featureSummary?.summary ?? "",
      problem: legacy.featureSummary?.purpose ?? "",
      goals: [
        ...(legacy.systemPurpose?.shouldDo ?? []),
        ...(legacy.systemPurpose?.successCriteria ?? []),
      ],
      constraints: legacy.featureSummary?.constraints ?? [],
      assumptions: legacy.systemPurpose?.boundaries ?? [],
      openQuestions: legacy.systemPurpose?.failureCriteria ?? [],
    },
    discovery: {
      contextEntities: legacyContextEntities,
      contextFlows: [],
      responsibilities: (legacy.responsibilities ?? []).map((item) => item.responsibility ?? "").filter(Boolean),
      candidateComponents,
      interactions: (legacy.interactions ?? []).map((item, index) => ({
        fromComponentId: nameToId.get(item.from ?? "") ?? candidateComponents[0].id,
        toComponentId: nameToId.get(item.to ?? "") ?? candidateComponents[Math.min(index + 1, candidateComponents.length - 1)].id,
        mechanism: item.mechanism ?? "other",
        data: item.data ?? "",
        notes: item.notes ?? "",
      })),
      dataFlowNodes: candidateComponents.map((candidate) => ({
        id: `legacy-data-flow-node-${candidate.id}`,
        name: candidate.name,
        kind: "process" as const,
        description: candidate.responsibility,
      })),
      dataFlows: (legacy.interactions ?? []).map((item, index) => ({
        id: `legacy-data-flow-${index}-${Math.random().toString(36).slice(2, 7)}`,
        fromNodeId: `legacy-data-flow-node-${
          nameToId.get(item.from ?? "") ?? candidateComponents[0].id
        }`,
        toNodeId: `legacy-data-flow-node-${
          nameToId.get(item.to ?? "") ??
          candidateComponents[Math.min(index + 1, candidateComponents.length - 1)].id
        }`,
        label: item.data ?? "",
        notes: item.notes ?? "",
      })),
      sequenceScenarios: [],
      runtimeNodes: [],
      runtimeLinks: [],
      candidateTasks: (legacy.rtos?.tasks ?? []).map((task, index) => ({
        id: createTaskId(index),
        name: task.name ?? "",
        responsibility: task.responsibility ?? "",
        priority: task.priority ?? "medium",
        type: task.type ?? "event-driven",
        trigger: task.trigger ?? "",
        mayBlock: Boolean(task.mayBlock),
        notes: task.notes ?? "",
      })),
      systemRisks: [
        ...(legacy.rtos?.timingRisks ?? []),
        ...(legacy.rtos?.synchronization ?? []),
      ],
      customOptions: {
        interactionMechanisms: [],
        dataFlowNodeKinds: [],
        runtimeNodeKinds: [],
        runtimeLinkKinds: [],
        contextEntityKinds: [],
      },
    },
    components: Array.from(componentMap.values()),
  };
};

export const normalizeImportedWorkspace = (workspace: FeatureWorkspace): FeatureWorkspace => {
  const base = createEmptyWorkspace();

  return {
    ...base,
    ...workspace,
    featureSummary: {
      ...base.featureSummary,
      ...workspace.featureSummary,
    },
    discovery: {
      ...base.discovery,
      ...workspace.discovery,
      contextEntities: Array.isArray(workspace.discovery?.contextEntities)
        ? workspace.discovery.contextEntities
        : [],
      contextFlows: Array.isArray(workspace.discovery?.contextFlows)
        ? workspace.discovery.contextFlows
        : [],
      responsibilities: Array.isArray(workspace.discovery?.responsibilities)
        ? workspace.discovery.responsibilities
        : [],
      candidateComponents: Array.isArray(workspace.discovery?.candidateComponents)
        ? workspace.discovery.candidateComponents
        : [],
      interactions: Array.isArray(workspace.discovery?.interactions)
        ? workspace.discovery.interactions
        : [],
      dataFlowNodes: Array.isArray(workspace.discovery?.dataFlowNodes)
        ? workspace.discovery.dataFlowNodes
        : [],
      dataFlows: Array.isArray(workspace.discovery?.dataFlows)
        ? workspace.discovery.dataFlows
        : [],
      sequenceScenarios: Array.isArray(workspace.discovery?.sequenceScenarios)
        ? workspace.discovery.sequenceScenarios
        : [],
      runtimeNodes: Array.isArray(workspace.discovery?.runtimeNodes)
        ? workspace.discovery.runtimeNodes.map((node) => ({
            ...node,
            hostNodeId: typeof node.hostNodeId === "string" ? node.hostNodeId : "",
          }))
        : [],
      runtimeLinks: Array.isArray(workspace.discovery?.runtimeLinks)
        ? workspace.discovery.runtimeLinks
        : [],
      candidateTasks: Array.isArray(workspace.discovery?.candidateTasks)
        ? workspace.discovery.candidateTasks
        : [],
      systemRisks: Array.isArray(workspace.discovery?.systemRisks)
        ? workspace.discovery.systemRisks
        : [],
      customOptions: {
        ...base.discovery.customOptions,
        ...workspace.discovery?.customOptions,
        interactionMechanisms: Array.isArray(
          workspace.discovery?.customOptions?.interactionMechanisms,
        )
          ? workspace.discovery.customOptions.interactionMechanisms
          : [],
        dataFlowNodeKinds: Array.isArray(
          workspace.discovery?.customOptions?.dataFlowNodeKinds,
        )
          ? workspace.discovery.customOptions.dataFlowNodeKinds
          : [],
        runtimeNodeKinds: Array.isArray(
          workspace.discovery?.customOptions?.runtimeNodeKinds,
        )
          ? workspace.discovery.customOptions.runtimeNodeKinds
          : [],
        runtimeLinkKinds: Array.isArray(
          workspace.discovery?.customOptions?.runtimeLinkKinds,
        )
          ? workspace.discovery.customOptions.runtimeLinkKinds
          : [],
        contextEntityKinds: Array.isArray(
          workspace.discovery?.customOptions?.contextEntityKinds,
        )
          ? workspace.discovery.customOptions.contextEntityKinds
          : [],
      },
    },
    components: Array.isArray(workspace.components) ? workspace.components : [],
  };
};

export const loadWorkspaces = (): FeatureWorkspace[] => {
  if (!isBrowser) {
    return [];
  }

  try {
    const currentRaw = window.localStorage.getItem(STORAGE_KEY);
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw) as StoredPayload;
      return Array.isArray(parsed.workspaces) ? parsed.workspaces.map(normalizeImportedWorkspace) : [];
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      return [];
    }

    const legacyParsed = JSON.parse(legacyRaw) as { designs?: LegacyFirmwareDesign[] };
    return Array.isArray(legacyParsed.designs) ? legacyParsed.designs.map(migrateLegacyDesign) : [];
  } catch {
    return [];
  }
};

export const saveWorkspaces = (workspaces: FeatureWorkspace[]): void => {
  if (!isBrowser) {
    return;
  }

  const payload: StoredPayload = {
    version: 2,
    workspaces,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};
