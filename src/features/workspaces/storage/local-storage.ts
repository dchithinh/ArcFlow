import { createEmptyComponent } from "../schema/defaults";
import type {
  FeatureWorkspace,
  ComponentCandidate,
  FeatureComponent,
  InteractionMechanism,
  EventDefinition,
  StateDefinition,
  OwnershipDefinition,
  FailureModeDefinition,
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
  implementationPlan?: {
    milestones?: string[];
    apis?: string[];
    tests?: string[];
  };
};

const isBrowser = typeof window !== "undefined";

const createComponentId = (index: number): string => `legacy-component-${index}-${Math.random().toString(36).slice(2, 7)}`;
const createTaskId = (index: number): string => `legacy-task-${index}-${Math.random().toString(36).slice(2, 7)}`;

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
      externalActors: [
        ...(legacy.io?.inputs ?? []),
        ...(legacy.io?.outputs ?? []),
      ],
      responsibilities: (legacy.responsibilities ?? []).map((item) => item.responsibility ?? "").filter(Boolean),
      candidateComponents,
      interactions: (legacy.interactions ?? []).map((item, index) => ({
        fromComponentId: nameToId.get(item.from ?? "") ?? candidateComponents[0].id,
        toComponentId: nameToId.get(item.to ?? "") ?? candidateComponents[Math.min(index + 1, candidateComponents.length - 1)].id,
        mechanism: item.mechanism ?? "other",
        data: item.data ?? "",
        notes: item.notes ?? "",
      })),
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
    },
    components: Array.from(componentMap.values()),
    implementationPlan: {
      milestones: legacy.implementationPlan?.milestones ?? [],
      apis: legacy.implementationPlan?.apis ?? [],
      tests: legacy.implementationPlan?.tests ?? [],
    },
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
      return Array.isArray(parsed.workspaces) ? parsed.workspaces : [];
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
