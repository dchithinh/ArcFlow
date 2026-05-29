export type DesignPriority = "high" | "medium" | "low";
export type TaskType = "periodic" | "event-driven" | "background" | "worker";
export type InteractionMechanism =
  | "queue"
  | "event"
  | "notification"
  | "callback"
  | "shared_memory"
  | "direct_call"
  | "other";
export type ContextEntityKind =
  | "user"
  | "device"
  | "system"
  | "service"
  | "timer"
  | "sensor"
  | "actuator"
  | "other";
export type ContextFlowDirection = "inbound" | "outbound" | "bidirectional";
export type SequenceParticipantKind = "actor" | "component" | "system" | "device" | "service";
export type SequenceStepType = "call" | "async" | "return" | "event";

export type WorkspaceSectionId =
  | "featureDefinition"
  | "featureDesign"
  | "implementationPlan";

export type EventDefinition = {
  name: string;
  source: string;
  trigger: string;
  frequency?: string;
  latencySensitive?: boolean;
};

export type StateTransition = {
  event: string;
  triggerKind?: "incoming" | "internal";
  targetState: string;
  action?: string;
};

export type StateDefinition = {
  name: string;
  description: string;
  transitions: StateTransition[];
};

export type OwnershipDefinition = {
  resource: string;
  owner: string;
  accessRules: string;
};

export type FailureModeDefinition = {
  scenario: string;
  impact: string;
  recovery: string;
};

export type ContextEntity = {
  id: string;
  name: string;
  kind: ContextEntityKind;
  description?: string;
};

export type ContextFlow = {
  id: string;
  entityId: string;
  direction: ContextFlowDirection;
  label: string;
  description?: string;
};

export type SequenceParticipant = {
  id: string;
  name: string;
  kind: SequenceParticipantKind;
  description?: string;
};

export type SequenceStep = {
  id: string;
  fromParticipantId: string;
  toParticipantId: string;
  message: string;
  type: SequenceStepType;
  note?: string;
};

export type SequenceScenario = {
  id: string;
  name: string;
  goal: string;
  trigger: string;
  outcome: string;
  failurePath?: string;
  participants: SequenceParticipant[];
  steps: SequenceStep[];
};

export type ComponentCandidate = {
  id: string;
  name: string;
  responsibility: string;
  rationale?: string;
};

export type ComponentInteraction = {
  fromComponentId: string;
  toComponentId: string;
  mechanism: InteractionMechanism;
  data: string;
  notes?: string;
};

export type CandidateTask = {
  id: string;
  name: string;
  responsibility: string;
  priority: DesignPriority;
  type: TaskType;
  trigger: string;
  mayBlock: boolean;
  notes?: string;
};

export type FeatureComponent = {
  id: string;
  name: string;
  summary: string;
  inputs: string[];
  outputs: string[];
  incomingEvents: EventDefinition[];
  internalSignals: EventDefinition[];
  outgoingSignals: EventDefinition[];
  states: StateDefinition[];
  ownership: OwnershipDefinition[];
  failureModes: FailureModeDefinition[];
  debugging: {
    logs: string[];
    traces: string[];
    observability: string[];
  };
};

export type FeatureWorkspace = {
  id: string;
  title: string;
  requirement: string;
  createdAt: string;
  updatedAt: string;
  featureSummary: {
    summary: string;
    problem: string;
    goals: string[];
    constraints: string[];
    assumptions: string[];
    openQuestions: string[];
  };
  discovery: {
    contextEntities: ContextEntity[];
    contextFlows: ContextFlow[];
    responsibilities: string[];
    candidateComponents: ComponentCandidate[];
    interactions: ComponentInteraction[];
    sequenceScenarios: SequenceScenario[];
    candidateTasks: CandidateTask[];
    systemRisks: string[];
  };
  components: FeatureComponent[];
  implementationPlan: {
    milestones: string[];
    apis: string[];
    tests: string[];
  };
};

export type WorkspaceSectionDefinition = {
  id: WorkspaceSectionId;
  label: string;
  description: string;
  stage: "definition" | "design" | "implementation";
};

export const WORKSPACE_SECTIONS: WorkspaceSectionDefinition[] = [
  { id: "featureDefinition", label: "Feature Definition", description: "Define the feature intent, scope, goals, constraints, and responsibilities.", stage: "definition" },
  { id: "featureDesign", label: "Feature Design", description: "Define candidate components, their interactions, and each component detail in one place.", stage: "design" },
  { id: "implementationPlan", label: "Implementation Plan", description: "Plan tasks, milestones, APIs, and tests after the design stabilizes.", stage: "implementation" },
];
