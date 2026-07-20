export type DesignPriority = "high" | "medium" | "low";
export type TaskType = "periodic" | "event-driven" | "background" | "worker";
type FlexibleString<T extends string> = T | (string & {});

type KnownInteractionMechanism =
  | "queue"
  | "event"
  | "notification"
  | "callback"
  | "shared_memory"
  | "direct_call"
  | "other";
export type InteractionMechanism = FlexibleString<KnownInteractionMechanism>;
type KnownContextEntityKind =
  | "user"
  | "device"
  | "system"
  | "service"
  | "timer"
  | "sensor"
  | "actuator"
  | "other";
export type ContextEntityKind = FlexibleString<KnownContextEntityKind>;
export type ContextFlowDirection = "inbound" | "outbound" | "bidirectional";
type KnownSequenceParticipantKind =
  | "actor"
  | "component"
  | "system"
  | "device"
  | "service"
  | "other";
export type SequenceParticipantKind = FlexibleString<KnownSequenceParticipantKind>;
export type SequenceStepType = "call" | "async" | "return" | "event";
type KnownDataFlowNodeKind =
  | "external_entity"
  | "process"
  | "data_store"
  | "other";
export type DataFlowNodeKind = FlexibleString<KnownDataFlowNodeKind>;
type KnownRuntimeNodeKind =
  | "mcu"
  | "core"
  | "task"
  | "thread"
  | "isr"
  | "timer"
  | "queue"
  | "mutex"
  | "peripheral"
  | "device"
  | "service"
  | "store"
  | "other";
export type RuntimeNodeKind = FlexibleString<KnownRuntimeNodeKind>;
type KnownRuntimeLinkKind =
  | "interrupt"
  | "queue"
  | "notification"
  | "call"
  | "shared_memory"
  | "driver"
  | "timer"
  | "mutex"
  | "data"
  | "other";
export type RuntimeLinkKind = FlexibleString<KnownRuntimeLinkKind>;
type KnownArchitectureComponentLayer =
  | "interface"
  | "application"
  | "service"
  | "driver"
  | "platform"
  | "other";
export type ArchitectureComponentLayer = FlexibleString<KnownArchitectureComponentLayer>;

export type WorkspaceSectionId =
  | "featureDefinition"
  | "featureDesign"
  | "implementationMapping";

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

export type ComponentObjectType = "active" | "passive";

export type ComponentObject = {
  id: string;
  name: string;
  responsibility: string;
  objectType: ComponentObjectType;
  needsState: boolean;
  states: StateDefinition[];
};

export type ComponentObjectInteraction = {
  fromObjectId: string;
  toObjectId: string;
  relationship: string;
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

export type DataFlowNode = {
  id: string;
  name: string;
  kind: DataFlowNodeKind;
  description?: string;
};

export type DataFlow = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string;
  notes?: string;
};

export type RuntimeNode = {
  id: string;
  name: string;
  kind: RuntimeNodeKind;
  responsibility: string;
  hostNodeId?: string;
  notes?: string;
};

export type RuntimeLink = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  kind: RuntimeLinkKind;
  label: string;
  notes?: string;
};

export type ComponentCandidate = {
  id: string;
  name: string;
  responsibility: string;
  rationale?: string;
  layer?: ArchitectureComponentLayer;
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

type KnownImplementationUnitKind =
  | "module"
  | "service"
  | "adapter"
  | "worker"
  | "interface"
  | "store"
  | "other";
export type ImplementationUnitKind = FlexibleString<KnownImplementationUnitKind>;

export type ImplementationUnit = {
  id: string;
  name: string;
  kind: ImplementationUnitKind;
  responsibility: string;
  requirementRefs: string[];
  componentIds: string[];
  runtimeNodeIds: string[];
  candidateTaskIds: string[];
  interfaces: string[];
  files: string[];
  notes?: string;
};

export type ImplementationStep = {
  id: string;
  name: string;
  goal: string;
  moduleIds: string[];
  verification: string[];
  notes?: string;
};

export type WorkspaceCustomOptions = {
  interactionMechanisms: string[];
  dataFlowNodeKinds: string[];
  runtimeNodeKinds: string[];
  runtimeLinkKinds: string[];
  contextEntityKinds: string[];
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
  objects: ComponentObject[];
  objectInteractions: ComponentObjectInteraction[];
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
    dataFlowNodes: DataFlowNode[];
    dataFlows: DataFlow[];
    sequenceScenarios: SequenceScenario[];
    runtimeNodes: RuntimeNode[];
    runtimeLinks: RuntimeLink[];
    candidateTasks: CandidateTask[];
    systemRisks: string[];
    customOptions: WorkspaceCustomOptions;
  };
  components: FeatureComponent[];
  implementation: {
    units: ImplementationUnit[];
    steps: ImplementationStep[];
    rules: string[];
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
  { id: "implementationMapping", label: "Implementation Mapping", description: "Map the design into code-facing units, interfaces, and implementation steps.", stage: "implementation" },
];
