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

export type WorkspaceSectionId =
  | "featureSummary"
  | "scope"
  | "responsibilities"
  | "candidateComponents"
  | "interactions"
  | "candidateTasks"
  | "systemRisks"
  | "componentDetail"
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
  events: EventDefinition[];
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
    externalActors: string[];
    responsibilities: string[];
    candidateComponents: ComponentCandidate[];
    interactions: ComponentInteraction[];
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
  stage: "discovery" | "component" | "delivery";
};

export const WORKSPACE_SECTIONS: WorkspaceSectionDefinition[] = [
  { id: "featureSummary", label: "Feature Summary", description: "Capture the feature intent and user problem.", stage: "discovery" },
  { id: "scope", label: "Scope / Constraints", description: "Track goals, constraints, assumptions, and open questions.", stage: "discovery" },
  { id: "responsibilities", label: "Responsibilities", description: "Break the feature into responsibilities before components.", stage: "discovery" },
  { id: "candidateComponents", label: "Candidate Components", description: "Propose the components or subsystems this feature likely needs.", stage: "discovery" },
  { id: "interactions", label: "Component Interactions", description: "Describe how candidate components exchange control and data.", stage: "discovery" },
  { id: "candidateTasks", label: "Candidate RTOS Tasks", description: "Propose concurrency boundaries and task responsibilities.", stage: "discovery" },
  { id: "systemRisks", label: "System Risks", description: "Capture cross-component risks before detailed design.", stage: "discovery" },
  { id: "componentDetail", label: "Component Detail", description: "Refine one selected component at a time.", stage: "component" },
  { id: "implementationPlan", label: "Implementation Plan", description: "Plan milestones, APIs, and tests after the design stabilizes.", stage: "delivery" },
];
