import {
  createEmptyComponent,
  createEmptyComponentObject,
  createEmptyWorkspace,
} from "../schema/defaults";
import type {
  ComponentCandidate,
  ComponentObject,
  ComponentObjectInteraction,
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

const migrateLegacyStatesToObjects = (
  componentName: string,
  states: StateDefinition[] | undefined,
): ComponentObject[] =>
  Array.isArray(states) && states.length > 0
    ? [
        createEmptyComponentObject({
          name: componentName ? `${componentName} Controller` : "Primary Object",
          responsibility: "Migrated from legacy component-level state modeling.",
          objectType: "active",
          needsState: true,
          states,
        }),
      ]
    : [];

const normalizeComponentObjects = (
  objects: unknown,
  legacyStates: StateDefinition[] | undefined,
  componentName: string,
): ComponentObject[] => {
  if (!Array.isArray(objects)) {
    return migrateLegacyStatesToObjects(componentName, legacyStates);
  }

  const normalized = objects.map((item, index) => {
    const candidate = typeof item === "object" && item !== null ? item as Partial<ComponentObject> : {};
    return createEmptyComponentObject({
      id:
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id
          : `component-object-${index}-${Math.random().toString(36).slice(2, 7)}`,
      name: typeof candidate.name === "string" ? candidate.name : "",
      responsibility:
        typeof candidate.responsibility === "string" ? candidate.responsibility : "",
      objectType: candidate.objectType === "active" ? "active" : "passive",
      needsState: Boolean(candidate.needsState),
      states: Array.isArray(candidate.states) ? candidate.states : [],
    });
  });

  if (normalized.length > 0) {
    return normalized;
  }

  return migrateLegacyStatesToObjects(componentName, legacyStates);
};

const normalizeObjectInteractions = (
  interactions: unknown,
): ComponentObjectInteraction[] => {
  if (!Array.isArray(interactions)) {
    return [];
  }

  return interactions.reduce<ComponentObjectInteraction[]>((result, item) => {
    if (typeof item !== "object" || item === null) {
      return result;
    }

    const candidate = item as Partial<ComponentObjectInteraction>;
    result.push({
      fromObjectId: typeof candidate.fromObjectId === "string" ? candidate.fromObjectId : "",
      toObjectId: typeof candidate.toObjectId === "string" ? candidate.toObjectId : "",
      relationship:
        typeof candidate.relationship === "string" ? candidate.relationship : "",
      notes: typeof candidate.notes === "string" ? candidate.notes : undefined,
    });
    return result;
  }, []);
};

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
        objects: migrateLegacyStatesToObjects(candidate.name, legacy.states),
        objectInteractions: [],
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
      responsibility: legacy.featureSummary?.summary || "Migrated from legacy design",
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
        objects: migrateLegacyStatesToObjects(legacy.title || "Legacy Component", legacy.states),
        objectInteractions: [],
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
    implementation: {
      units: [],
      steps: [],
      rules: [],
    },
  };
};

export const normalizeImportedWorkspace = (workspace: FeatureWorkspace): FeatureWorkspace => {
  const base = createEmptyWorkspace();
  const normalizeImplementationRules = (rules: unknown): string[] =>
    Array.isArray(rules)
      ? rules
          .map((rule) => {
            if (typeof rule === "string") {
              return rule;
            }

            if (rule && typeof rule === "object") {
              const candidate = rule as {
                name?: unknown;
                description?: unknown;
              };
              const name =
                typeof candidate.name === "string" ? candidate.name.trim() : "";
              const description =
                typeof candidate.description === "string"
                  ? candidate.description.trim()
                  : "";

              if (name && description) {
                return `${name}: ${description}`;
              }
              if (name) {
                return name;
              }
              if (description) {
                return description;
              }
            }

            return "";
          })
          .filter((rule) => rule.trim().length > 0)
      : [];

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
    components: Array.isArray(workspace.components)
      ? workspace.components.map((component) => ({
          ...createEmptyComponent(component),
          ...component,
          objects: normalizeComponentObjects(
            (component as FeatureComponent & { objects?: unknown }).objects,
            (component as FeatureComponent & { states?: StateDefinition[] }).states,
            component.name,
          ),
          objectInteractions: normalizeObjectInteractions(
            (component as FeatureComponent & { objectInteractions?: unknown }).objectInteractions,
          ),
        }))
      : [],
    implementation: {
      ...base.implementation,
      ...workspace.implementation,
      units: Array.isArray(workspace.implementation?.units)
        ? workspace.implementation.units.map((unit) => ({
            ...unit,
            requirementRefs: Array.isArray(unit.requirementRefs) ? unit.requirementRefs : [],
            componentIds: Array.isArray(unit.componentIds) ? unit.componentIds : [],
            runtimeNodeIds: Array.isArray(unit.runtimeNodeIds) ? unit.runtimeNodeIds : [],
            candidateTaskIds: Array.isArray(unit.candidateTaskIds)
              ? unit.candidateTaskIds
              : [],
            interfaces: Array.isArray(unit.interfaces) ? unit.interfaces : [],
            files: Array.isArray(unit.files) ? unit.files : [],
          }))
        : [],
      steps: Array.isArray(workspace.implementation?.steps)
        ? workspace.implementation.steps.map((step) => ({
            ...step,
            moduleIds: Array.isArray(step.moduleIds) ? step.moduleIds : [],
            verification: Array.isArray(step.verification) ? step.verification : [],
          }))
        : [],
      rules: normalizeImplementationRules(workspace.implementation?.rules),
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
