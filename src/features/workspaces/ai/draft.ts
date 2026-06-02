import { createEmptyComponent } from "../schema/defaults";
import type {
  CandidateTask,
  ComponentCandidate,
  FeatureComponent,
  FeatureWorkspace,
  InteractionMechanism,
} from "../schema/workspace";

type AiEventDefinition = {
  name: string;
  source: string;
  trigger: string;
  frequency: string;
  latencySensitive: boolean;
};

type AiStateTransition = {
  event: string;
  triggerKind: "incoming" | "internal";
  targetState: string;
  action: string;
};

type AiStateDefinition = {
  name: string;
  description: string;
  transitions: AiStateTransition[];
};

type AiOwnershipDefinition = {
  resource: string;
  owner: string;
  accessRules: string;
};

type AiFailureModeDefinition = {
  scenario: string;
  impact: string;
  recovery: string;
};

type AiCandidateComponent = {
  name: string;
  responsibility: string;
  rationale: string;
};

type AiComponentInteraction = {
  fromComponentName: string;
  toComponentName: string;
  mechanism: InteractionMechanism;
  data: string;
  notes: string;
};

type AiCandidateTask = {
  name: string;
  responsibility: string;
  priority: CandidateTask["priority"];
  type: CandidateTask["type"];
  trigger: string;
  mayBlock: boolean;
  notes: string;
};

export type AiDiscoveryDraft = {
  featureSummary: {
    summary: string;
    problem: string;
    goals: string[];
    assumptions: string[];
    openQuestions: string[];
  };
  discovery: {
    externalActors: string[];
    candidateComponents: AiCandidateComponent[];
    interactions: AiComponentInteraction[];
    candidateTasks: AiCandidateTask[];
    systemRisks: string[];
  };
};

export type AiComponentDraft = {
  summary: string;
  inputs: string[];
  outputs: string[];
  incomingEvents: AiEventDefinition[];
  internalSignals: AiEventDefinition[];
  outgoingSignals: AiEventDefinition[];
  states: AiStateDefinition[];
  ownership: AiOwnershipDefinition[];
  failureModes: AiFailureModeDefinition[];
  debugging: {
    logs: string[];
    traces: string[];
    observability: string[];
  };
};

export type AiImplementationDraft = {
  milestones: string[];
  apis: string[];
  tests: string[];
};

export type AiDefinitionDraft = {
  featureRequirements: string[];
  featureResponsibilities: string[];
};

const createLocalId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalize = (value: string): string => value.trim().toLowerCase();

const uniqueList = (items: string[]): string[] => {
  const seen = new Set<string>();
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
};

const toCandidateTask = (task: AiCandidateTask): CandidateTask => ({
  id: createLocalId("task"),
  name: task.name.trim(),
  responsibility: task.responsibility.trim(),
  priority: task.priority,
  type: task.type,
  trigger: task.trigger.trim(),
  mayBlock: task.mayBlock,
  notes: task.notes.trim(),
});

const toComponentShape = (
  draft: AiComponentDraft,
  candidate: ComponentCandidate,
): FeatureComponent => ({
  ...createEmptyComponent(candidate),
  summary: draft.summary.trim(),
  inputs: uniqueList(draft.inputs),
  outputs: uniqueList(draft.outputs),
  incomingEvents: draft.incomingEvents.map((event) => ({
    name: event.name.trim(),
    source: event.source.trim(),
    trigger: event.trigger.trim(),
    frequency: event.frequency.trim(),
    latencySensitive: event.latencySensitive,
  })),
  internalSignals: draft.internalSignals.map((signal) => ({
    name: signal.name.trim(),
    source: signal.source.trim(),
    trigger: signal.trigger.trim(),
    frequency: signal.frequency.trim(),
    latencySensitive: signal.latencySensitive,
  })),
  outgoingSignals: draft.outgoingSignals.map((signal) => ({
    name: signal.name.trim(),
    source: signal.source.trim(),
    trigger: signal.trigger.trim(),
    frequency: signal.frequency.trim(),
    latencySensitive: signal.latencySensitive,
  })),
  states: draft.states.map((state) => ({
    name: state.name.trim(),
    description: state.description.trim(),
    transitions: state.transitions.map((transition) => ({
      event: transition.event.trim(),
      triggerKind: transition.triggerKind,
      targetState: transition.targetState.trim(),
      action: transition.action.trim(),
    })),
  })),
  ownership: draft.ownership.map((item) => ({
    resource: item.resource.trim(),
    owner: item.owner.trim(),
    accessRules: item.accessRules.trim(),
  })),
  failureModes: draft.failureModes.map((item) => ({
    scenario: item.scenario.trim(),
    impact: item.impact.trim(),
    recovery: item.recovery.trim(),
  })),
  debugging: {
    logs: uniqueList(draft.debugging.logs),
    traces: uniqueList(draft.debugging.traces),
    observability: uniqueList(draft.debugging.observability),
  },
});

const buildCandidateComponents = (
  workspace: FeatureWorkspace,
  draftCandidates: AiDiscoveryDraft["discovery"]["candidateComponents"],
): ComponentCandidate[] => {
  const existingIdsByName = new Map(
    workspace.discovery.candidateComponents.map((candidate) => [
      normalize(candidate.name),
      candidate.id,
    ]),
  );

  return draftCandidates
    .filter((candidate) => candidate.name.trim())
    .map((candidate) => ({
      id: existingIdsByName.get(normalize(candidate.name)) ?? createLocalId("component"),
      name: candidate.name.trim(),
      responsibility: candidate.responsibility.trim(),
      rationale: candidate.rationale.trim(),
    }));
};

const syncComponentsFromCandidates = (
  candidates: ComponentCandidate[],
  existingComponents: FeatureComponent[],
): FeatureComponent[] =>
  candidates.map((candidate) => {
    const existing = existingComponents.find((component) => component.id === candidate.id);
    if (!existing) {
      return createEmptyComponent(candidate);
    }

    return {
      ...existing,
      name: candidate.name,
      summary: existing.summary || candidate.responsibility,
    };
  });

export const hasRequiredAiDraftInputs = (workspace: FeatureWorkspace): boolean =>
  workspace.title.trim().length > 0 &&
  workspace.requirement.trim().length > 0 &&
  workspace.featureSummary.constraints.some((item) => item.trim()) &&
  workspace.discovery.responsibilities.some((item) => item.trim());

export const getMissingDiscoveryDraftInputs = (workspace: FeatureWorkspace): string[] => {
  const missing: string[] = [];

  if (!workspace.title.trim()) {
    missing.push("Feature name");
  }

  if (!workspace.requirement.trim()) {
    missing.push("at least one feature requirement");
  }

  if (!workspace.featureSummary.constraints.some((item) => item.trim())) {
    missing.push("at least one constraint");
  }

  if (!workspace.discovery.responsibilities.some((item) => item.trim())) {
    missing.push("at least one responsibility");
  }

  return missing;
};

export const canGenerateDiscoveryDraft = hasRequiredAiDraftInputs;

export const canGenerateDefinitionAssist = (workspace: FeatureWorkspace): boolean =>
  workspace.title.trim().length > 0 && workspace.featureSummary.summary.trim().length > 0;

export const canRefineComponentWithAi = (
  workspace: FeatureWorkspace,
  componentId?: string | null,
): boolean =>
  hasRequiredAiDraftInputs(workspace) &&
  Boolean(componentId) &&
  workspace.components.some((component) => component.id === componentId);

export const canGenerateImplementationPlanWithAi = (workspace: FeatureWorkspace): boolean =>
  hasRequiredAiDraftInputs(workspace) &&
  workspace.discovery.candidateComponents.length > 0 &&
  workspace.components.length > 0;

export const mergeAiDiscoveryIntoWorkspace = (
  workspace: FeatureWorkspace,
  draft: AiDiscoveryDraft,
): FeatureWorkspace => {
  const candidateComponents = buildCandidateComponents(
    workspace,
    draft.discovery.candidateComponents,
  );
  const componentIdByName = new Map(
    candidateComponents.map((candidate) => [normalize(candidate.name), candidate.id]),
  );

  const interactions = draft.discovery.interactions
    .map((interaction) => {
      const fromComponentId = componentIdByName.get(normalize(interaction.fromComponentName));
      const toComponentId = componentIdByName.get(normalize(interaction.toComponentName));
      if (!fromComponentId || !toComponentId) {
        return null;
      }

      return {
        fromComponentId,
        toComponentId,
        mechanism: interaction.mechanism,
        data: interaction.data.trim(),
        notes: interaction.notes.trim(),
      };
    })
    .filter((interaction): interaction is NonNullable<typeof interaction> => Boolean(interaction));
  const existingContextEntities = workspace.discovery.contextEntities;
  const entityByName = new Map(
    existingContextEntities.map((entity) => [normalize(entity.name), entity]),
  );
  const nextContextEntities = uniqueList(draft.discovery.externalActors).map((actor, index) => {
    const existing = entityByName.get(normalize(actor));
    if (existing) {
      return existing;
    }

    return {
      id: `context-entity-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      name: actor,
      kind: "other" as const,
      description: "",
    };
  });

  return {
    ...workspace,
    featureSummary: {
      ...workspace.featureSummary,
      summary: draft.featureSummary.summary.trim(),
      problem: draft.featureSummary.problem.trim(),
      goals: uniqueList(draft.featureSummary.goals),
      assumptions: uniqueList(draft.featureSummary.assumptions),
      openQuestions: uniqueList(draft.featureSummary.openQuestions),
    },
    discovery: {
      ...workspace.discovery,
      contextEntities:
        nextContextEntities.length > 0
          ? nextContextEntities
          : workspace.discovery.contextEntities,
      candidateComponents,
      interactions,
      candidateTasks: draft.discovery.candidateTasks.map(toCandidateTask),
      systemRisks: uniqueList(draft.discovery.systemRisks),
    },
    components: syncComponentsFromCandidates(candidateComponents, workspace.components),
  };
};

export const mergeAiComponentIntoWorkspace = (
  workspace: FeatureWorkspace,
  componentId: string,
  draft: AiComponentDraft,
): FeatureWorkspace => {
  const component = workspace.components.find((item) => item.id === componentId);
  const candidate =
    workspace.discovery.candidateComponents.find((item) => item.id === componentId) ??
    (component
      ? {
          id: component.id,
          name: component.name,
          responsibility: component.summary,
          rationale: "",
        }
      : null);

  if (!candidate) {
    return workspace;
  }

  const nextComponent = toComponentShape(draft, candidate);
  return {
    ...workspace,
    components: workspace.components.map((item) =>
      item.id === componentId ? nextComponent : item,
    ),
  };
};

export const mergeAiImplementationIntoWorkspace = (
  workspace: FeatureWorkspace,
  draft: AiImplementationDraft,
): FeatureWorkspace => ({
  ...workspace,
  implementationPlan: {
    milestones: uniqueList(draft.milestones),
    apis: uniqueList(draft.apis),
    tests: uniqueList(draft.tests),
  },
});

export const mergeAiDefinitionIntoWorkspace = (
  workspace: FeatureWorkspace,
  draft: AiDefinitionDraft,
): FeatureWorkspace => {
  const featureRequirements = uniqueList(draft.featureRequirements);
  const featureResponsibilities = uniqueList(draft.featureResponsibilities);

  return {
    ...workspace,
    requirement:
      featureRequirements.length > 0
        ? featureRequirements.join("\n")
        : workspace.requirement,
    featureSummary: {
      ...workspace.featureSummary,
      goals:
        featureRequirements.length > 0
          ? featureRequirements
          : workspace.featureSummary.goals,
    },
    discovery: {
      ...workspace.discovery,
      responsibilities:
        featureResponsibilities.length > 0
          ? featureResponsibilities
          : workspace.discovery.responsibilities,
    },
  };
};
