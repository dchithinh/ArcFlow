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

export type SectionId =
  | "featureSummary"
  | "systemPurpose"
  | "io"
  | "events"
  | "states"
  | "responsibilities"
  | "interactions"
  | "rtos"
  | "ownership"
  | "failureModes"
  | "layers"
  | "debugging"
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

export type ResponsibilityDefinition = {
  responsibility: string;
  module: string;
  notes?: string;
};

export type InteractionDefinition = {
  from: string;
  to: string;
  mechanism: InteractionMechanism;
  data: string;
  notes?: string;
};

export type RtosTaskDefinition = {
  name: string;
  responsibility: string;
  priority: DesignPriority;
  type: TaskType;
  trigger: string;
  mayBlock: boolean;
  notes?: string;
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

export type FirmwareDesign = {
  id: string;
  title: string;
  requirement: string;
  createdAt: string;
  updatedAt: string;
  featureSummary: {
    summary: string;
    purpose: string;
    constraints: string[];
  };
  systemPurpose: {
    shouldDo: string[];
    shouldNotDo: string[];
    successCriteria: string[];
    failureCriteria: string[];
    boundaries: string[];
  };
  io: {
    inputs: string[];
    outputs: string[];
  };
  events: EventDefinition[];
  states: StateDefinition[];
  responsibilities: ResponsibilityDefinition[];
  interactions: InteractionDefinition[];
  rtos: {
    tasks: RtosTaskDefinition[];
    synchronization: string[];
    timingRisks: string[];
  };
  ownership: OwnershipDefinition[];
  failureModes: FailureModeDefinition[];
  layers: {
    application: string[];
    service: string[];
    driver: string[];
    halBsp: string[];
  };
  debugging: {
    logs: string[];
    traces: string[];
    observability: string[];
  };
  implementationPlan: {
    milestones: string[];
    apis: string[];
    tests: string[];
  };
};

export type SectionDefinition = {
  id: SectionId;
  label: string;
  description: string;
};

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  { id: "featureSummary", label: "Feature Summary", description: "Capture the feature intent and major constraints." },
  { id: "systemPurpose", label: "System Purpose", description: "Define expected behavior, boundaries, and success." },
  { id: "io", label: "Inputs / Outputs", description: "List the signals, data, and effects that matter." },
  { id: "events", label: "Events", description: "Describe what triggers behavior." },
  { id: "states", label: "States", description: "Model the major operating states and transitions." },
  { id: "responsibilities", label: "Responsibilities", description: "Split the feature into focused responsibilities." },
  { id: "interactions", label: "Interactions", description: "Describe data flow and subsystem relationships." },
  { id: "rtos", label: "RTOS / Concurrency", description: "Outline tasks, triggers, and timing concerns." },
  { id: "ownership", label: "Resource Ownership", description: "Clarify ownership and access rules." },
  { id: "failureModes", label: "Failure Analysis", description: "List failure scenarios and recovery paths." },
  { id: "layers", label: "Layered Architecture", description: "Group modules into architectural layers." },
  { id: "debugging", label: "Debuggability", description: "Define the observability strategy." },
  { id: "implementationPlan", label: "Implementation Plan", description: "Lay out milestones, APIs, and tests." }
];
