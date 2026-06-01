import type {
  CandidateTask,
  ComponentCandidate,
  ContextEntity,
  ContextFlow,
  FeatureComponent,
  FeatureWorkspace,
  RuntimeLink,
  RuntimeNode,
  SequenceParticipant,
  SequenceScenario,
  SequenceStep,
} from "./workspace";

const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isoNow = (): string => new Date().toISOString();

export const createEmptyComponent = (candidate?: Partial<ComponentCandidate>): FeatureComponent => ({
  id: candidate?.id ?? createId("component"),
  name: candidate?.name ?? "New Component",
  summary: candidate?.responsibility ?? "",
  inputs: [],
  outputs: [],
  incomingEvents: [],
  internalSignals: [],
  outgoingSignals: [],
  states: [],
  ownership: [],
  failureModes: [],
  debugging: {
    logs: [],
    traces: [],
    observability: [],
  },
});

export const createEmptyCandidateComponent = (): ComponentCandidate => ({
  id: createId("component"),
  name: "",
  responsibility: "",
  rationale: "",
});

export const createEmptyCandidateTask = (): CandidateTask => ({
  id: createId("task"),
  name: "",
  responsibility: "",
  priority: "medium",
  type: "event-driven",
  trigger: "",
  mayBlock: false,
  notes: "",
});

export const createEmptyContextEntity = (): ContextEntity => ({
  id: createId("context-entity"),
  name: "",
  kind: "system",
  description: "",
});

export const createEmptyContextFlow = (entityId = ""): ContextFlow => ({
  id: createId("context-flow"),
  entityId,
  direction: "inbound",
  label: "",
  description: "",
});

export const createEmptySequenceParticipant = (): SequenceParticipant => ({
  id: createId("sequence-participant"),
  name: "",
  kind: "component",
  description: "",
});

export const createEmptySequenceStep = (
  fromParticipantId = "",
  toParticipantId = "",
): SequenceStep => ({
  id: createId("sequence-step"),
  fromParticipantId,
  toParticipantId,
  message: "",
  type: "call",
  note: "",
});

export const createEmptySequenceScenario = (): SequenceScenario => ({
  id: createId("sequence-scenario"),
  name: "",
  goal: "",
  trigger: "",
  outcome: "",
  failurePath: "",
  participants: [],
  steps: [],
});

export const createEmptyRuntimeNode = (hostNodeId = ""): RuntimeNode => ({
  id: createId("runtime-node"),
  name: "",
  kind: "task",
  responsibility: "",
  hostNodeId,
  notes: "",
});

export const createEmptyRuntimeLink = (
  fromNodeId = "",
  toNodeId = "",
): RuntimeLink => ({
  id: createId("runtime-link"),
  fromNodeId,
  toNodeId,
  kind: "queue",
  label: "",
  notes: "",
});

export const createEmptyWorkspace = (): FeatureWorkspace => ({
  id: createId("workspace"),
  title: "Untitled feature workspace",
  requirement: "",
  createdAt: isoNow(),
  updatedAt: isoNow(),
  featureSummary: {
    summary: "",
    problem: "",
    goals: [],
    constraints: [],
    assumptions: [],
    openQuestions: [],
  },
  discovery: {
    contextEntities: [],
    contextFlows: [],
    responsibilities: [],
    candidateComponents: [],
    interactions: [],
    sequenceScenarios: [],
    runtimeNodes: [],
    runtimeLinks: [],
    candidateTasks: [],
    systemRisks: [],
  },
  components: [],
  implementationPlan: {
    milestones: [],
    apis: [],
    tests: [],
  },
});

export const createSampleWorkspace = (): FeatureWorkspace => {
  const commandIngress: ComponentCandidate = {
    id: createId("component"),
    name: "Command Ingress",
    responsibility: "Acquire UART bytes, frame packets, and hand valid packets into the feature pipeline.",
    rationale: "Separates transport-facing concerns from parsing and business logic.",
  };
  const commandParser: ComponentCandidate = {
    id: createId("component"),
    name: "Command Parser",
    responsibility: "Validate packet structure, decode commands, and reject malformed input deterministically.",
    rationale: "Keeps protocol validation focused and independently testable.",
  };
  const configCoordinator: ComponentCandidate = {
    id: createId("component"),
    name: "Config Coordinator",
    responsibility: "Apply validated configuration updates and own runtime configuration consistency.",
    rationale: "Centralizes configuration ownership to avoid partial or conflicting writes.",
  };
  const responseReporter: ComponentCandidate = {
    id: createId("component"),
    name: "Response Reporter",
    responsibility: "Generate acknowledgements, errors, and diagnostic health reporting.",
    rationale: "Keeps user-facing responses and logs separate from control-path logic.",
  };
  const operatorTerminalEntity: ContextEntity = {
    id: createId("context-entity"),
    name: "Operator Terminal",
    kind: "user",
    description: "Human operator issuing commands and reading responses.",
  };
  const uartPeripheralEntity: ContextEntity = {
    id: createId("context-entity"),
    name: "UART Peripheral",
    kind: "device",
    description: "Transport interface providing command bytes to the feature.",
  };
  const runtimeConfigEntity: ContextEntity = {
    id: createId("context-entity"),
    name: "Runtime Configuration Store",
    kind: "system",
    description: "Shared configuration state affected by validated commands.",
  };
  const terminalParticipant: SequenceParticipant = {
    id: createId("sequence-participant"),
    name: "Operator Terminal",
    kind: "actor",
    description: "Originates configuration commands and reads responses.",
  };
  const ingressParticipant: SequenceParticipant = {
    id: createId("sequence-participant"),
    name: "Command Ingress",
    kind: "component",
    description: "Frames UART traffic into packets.",
  };
  const parserParticipant: SequenceParticipant = {
    id: createId("sequence-participant"),
    name: "Command Parser",
    kind: "component",
    description: "Validates and decodes commands.",
  };
  const coordinatorParticipant: SequenceParticipant = {
    id: createId("sequence-participant"),
    name: "Config Coordinator",
    kind: "component",
    description: "Applies validated updates.",
  };
  const reporterParticipant: SequenceParticipant = {
    id: createId("sequence-participant"),
    name: "Response Reporter",
    kind: "component",
    description: "Produces user-visible success or error feedback.",
  };
  const mcuNode: RuntimeNode = {
    id: createId("runtime-node"),
    name: "STM32F4 MCU",
    kind: "mcu",
    responsibility: "Executes the firmware feature and hosts RTOS tasks, ISRs, and device drivers.",
    notes: "Primary execution environment.",
  };
  const uartIsrNode: RuntimeNode = {
    id: createId("runtime-node"),
    name: "UART RX ISR",
    kind: "isr",
    responsibility: "Captures RX bytes and pushes framed data toward the command path.",
    hostNodeId: mcuNode.id,
    notes: "Must remain short and non-blocking.",
  };
  const commandTaskNode: RuntimeNode = {
    id: createId("runtime-node"),
    name: "Command Task",
    kind: "task",
    responsibility: "Validates packets and dispatches configuration work.",
    hostNodeId: mcuNode.id,
    notes: "High priority event-driven task.",
  };
  const responseTaskNode: RuntimeNode = {
    id: createId("runtime-node"),
    name: "Response / Logging Task",
    kind: "task",
    responsibility: "Flushes acknowledgements and diagnostic output.",
    hostNodeId: mcuNode.id,
    notes: "Low priority background work.",
  };
  const rxQueueNode: RuntimeNode = {
    id: createId("runtime-node"),
    name: "RX Packet Queue",
    kind: "queue",
    responsibility: "Carries framed command packets from ISR context into task context.",
    hostNodeId: mcuNode.id,
    notes: "Bounded queue depth.",
  };
  const configStoreNode: RuntimeNode = {
    id: createId("runtime-node"),
    name: "Runtime Configuration Store",
    kind: "store",
    responsibility: "Holds validated runtime configuration state.",
    hostNodeId: mcuNode.id,
    notes: "Single ownership path through Config Coordinator.",
  };
  const uartPeripheralNode: RuntimeNode = {
    id: createId("runtime-node"),
    name: "UART Peripheral",
    kind: "device",
    responsibility: "Physical serial hardware boundary that receives command bytes and transmits responses.",
    notes: "External hardware module connected to the MCU UART driver path.",
  };

  return {
    id: createId("workspace"),
    title: "UART Command Handling Feature",
    requirement:
      "Support command packets over UART to configure the device, validate input, update runtime configuration, and report success or failure without blocking time-sensitive tasks.",
    createdAt: isoNow(),
    updatedAt: isoNow(),
    featureSummary: {
      summary: "Accept operator commands over UART and safely apply runtime configuration updates.",
      problem: "The device needs a controlled runtime configuration path without compromising control-loop timing or corrupting shared configuration state.",
      goals: [
        "Accept well-formed UART commands",
        "Reject malformed or unsafe commands deterministically",
        "Apply valid configuration updates within latency budget",
      ],
      constraints: [
        "Static memory allocation preferred",
        "Bounded queue depth",
        "Must not block time-sensitive control tasks",
        "Recover gracefully from malformed packets",
      ],
      assumptions: [
        "UART framing rules are already defined",
        "Configuration schema is known to firmware",
      ],
      openQuestions: [
        "Should command authentication be added later?",
        "What is the maximum expected burst rate on UART RX?",
      ],
    },
    discovery: {
      contextEntities: [
        operatorTerminalEntity,
        uartPeripheralEntity,
        runtimeConfigEntity,
      ],
      contextFlows: [
        {
          id: createId("context-flow"),
          entityId: operatorTerminalEntity.id,
          direction: "bidirectional",
          label: "Operator commands and status feedback",
          description: "The operator sends configuration commands and receives acknowledgements.",
        },
        {
          id: createId("context-flow"),
          entityId: uartPeripheralEntity.id,
          direction: "inbound",
          label: "UART RX command bytes",
          description: "The transport interface delivers raw command traffic into the feature.",
        },
        {
          id: createId("context-flow"),
          entityId: runtimeConfigEntity.id,
          direction: "outbound",
          label: "Validated configuration updates",
          description: "The feature applies approved configuration changes into shared runtime state.",
        },
      ],
      responsibilities: [
        "Acquire UART data safely",
        "Validate command framing and payload integrity",
        "Apply configuration changes through one ownership path",
        "Report acknowledgements and errors",
      ],
      candidateComponents: [commandIngress, commandParser, configCoordinator, responseReporter],
      interactions: [
        {
          fromComponentId: commandIngress.id,
          toComponentId: commandParser.id,
          mechanism: "queue",
          data: "Framed command packet",
          notes: "Bound queue depth and ISR-safe push required",
        },
        {
          fromComponentId: commandParser.id,
          toComponentId: configCoordinator.id,
          mechanism: "direct_call",
          data: "Validated command object",
        },
        {
          fromComponentId: configCoordinator.id,
          toComponentId: responseReporter.id,
          mechanism: "notification",
          data: "Apply result and status details",
        },
      ],
      sequenceScenarios: [
        {
          id: createId("sequence-scenario"),
          name: "Apply a valid UART configuration command",
          goal: "Accept a valid command packet and apply the requested configuration change.",
          trigger: "A complete UART command packet arrives from the operator terminal.",
          outcome: "Runtime configuration is updated and a success response is reported.",
          failurePath: "If validation fails, configuration is left unchanged and an error response is sent instead.",
          participants: [
            terminalParticipant,
            ingressParticipant,
            parserParticipant,
            coordinatorParticipant,
            reporterParticipant,
          ],
          steps: [
            {
              id: createId("sequence-step"),
              fromParticipantId: terminalParticipant.id,
              toParticipantId: ingressParticipant.id,
              message: "Send UART command packet",
              type: "async",
              note: "Transport-facing ingress begins framing and integrity checks.",
            },
            {
              id: createId("sequence-step"),
              fromParticipantId: ingressParticipant.id,
              toParticipantId: parserParticipant.id,
              message: "Deliver framed command packet",
              type: "async",
            },
            {
              id: createId("sequence-step"),
              fromParticipantId: parserParticipant.id,
              toParticipantId: coordinatorParticipant.id,
              message: "Apply validated command object",
              type: "call",
              note: "Only validated commands cross into configuration ownership.",
            },
            {
              id: createId("sequence-step"),
              fromParticipantId: coordinatorParticipant.id,
              toParticipantId: reporterParticipant.id,
              message: "Notify apply result",
              type: "event",
            },
            {
              id: createId("sequence-step"),
              fromParticipantId: reporterParticipant.id,
              toParticipantId: terminalParticipant.id,
              message: "Return success acknowledgement",
              type: "return",
            },
          ],
        },
      ],
      runtimeNodes: [
        mcuNode,
        uartPeripheralNode,
        uartIsrNode,
        rxQueueNode,
        commandTaskNode,
        responseTaskNode,
        configStoreNode,
      ],
      runtimeLinks: [
        {
          id: createId("runtime-link"),
          fromNodeId: uartPeripheralNode.id,
          toNodeId: uartIsrNode.id,
          kind: "driver",
          label: "RX byte stream",
          notes: "External UART hardware raises receive events into the MCU execution boundary.",
        },
        {
          id: createId("runtime-link"),
          fromNodeId: uartIsrNode.id,
          toNodeId: rxQueueNode.id,
          kind: "interrupt",
          label: "UART RX bytes",
          notes: "ISR pushes framed packet data into queue-safe handoff.",
        },
        {
          id: createId("runtime-link"),
          fromNodeId: rxQueueNode.id,
          toNodeId: commandTaskNode.id,
          kind: "queue",
          label: "Framed command packets",
          notes: "Command task drains packets and validates them.",
        },
        {
          id: createId("runtime-link"),
          fromNodeId: commandTaskNode.id,
          toNodeId: configStoreNode.id,
          kind: "call",
          label: "Validated configuration updates",
          notes: "Only validated commands write runtime state.",
        },
        {
          id: createId("runtime-link"),
          fromNodeId: commandTaskNode.id,
          toNodeId: responseTaskNode.id,
          kind: "notification",
          label: "Apply result",
          notes: "Response task reports success or failure asynchronously.",
        },
        {
          id: createId("runtime-link"),
          fromNodeId: responseTaskNode.id,
          toNodeId: uartPeripheralNode.id,
          kind: "driver",
          label: "TX response bytes",
          notes: "Response path leaves the MCU through the UART hardware boundary.",
        },
      ],
      candidateTasks: [
        {
          id: createId("task"),
          name: "Command_Task",
          responsibility: "Validate and dispatch UART command packets",
          priority: "high",
          type: "event-driven",
          trigger: "Packet available in RX queue",
          mayBlock: false,
          notes: "Should never starve control loop",
        },
        {
          id: createId("task"),
          name: "Logging_Task",
          responsibility: "Flush diagnostic and operator-facing messages",
          priority: "low",
          type: "background",
          trigger: "Buffered log or response message",
          mayBlock: true,
          notes: "Keep noncritical output off main command path",
        },
      ],
      systemRisks: [
        "Burst UART traffic may overflow packet queue",
        "Shared configuration ownership may be violated by future features",
        "Parser latency could impact response budget under malformed traffic bursts",
      ],
    },
    components: [
      {
        ...createEmptyComponent(commandIngress),
        summary: "Owns UART RX framing and packet handoff into the feature pipeline.",
        inputs: ["UART RX bytes", "Framing timeout"],
        outputs: ["Framed command packets", "Ingress health counters"],
        incomingEvents: [
          { name: "uart_packet_received", source: "UART ISR", trigger: "Valid frame detected", frequency: "Burst", latencySensitive: true },
          { name: "command_timeout", source: "Timer", trigger: "Frame not completed before deadline", frequency: "Occasional", latencySensitive: false },
        ],
        internalSignals: [
          { name: "frame_complete", source: "Command Ingress", trigger: "Frame validator accepted packet", frequency: "Burst", latencySensitive: true },
        ],
        outgoingSignals: [
          { name: "packet_ready", source: "Command Ingress", trigger: "Packet queued for parser", frequency: "Burst", latencySensitive: true },
        ],
        states: [
          {
            name: "IDLE",
            description: "Waiting for a new frame.",
            transitions: [{ event: "uart_packet_received", triggerKind: "incoming", targetState: "DISPATCHING", action: "Queue packet" }],
          },
          {
            name: "DISPATCHING",
            description: "Handing a validated frame to downstream processing.",
            transitions: [{ event: "frame_complete", triggerKind: "internal", targetState: "IDLE", action: "Reset ingress buffer state" }],
          },
        ],
        ownership: [{ resource: "UART RX ring buffer", owner: "Command Ingress", accessRules: "ISR writes, task drains through framed packet API" }],
        failureModes: [{ scenario: "Queue overflow under burst traffic", impact: "Dropped command packets", recovery: "Count overflow, drop packet, raise health event" }],
        debugging: {
          logs: ["Frame accepted", "Frame dropped"],
          traces: ["UART RX interrupt count"],
          observability: ["Queue depth watermark", "Dropped frame counter"],
        },
      },
      {
        ...createEmptyComponent(commandParser),
        summary: "Validates packet integrity and decodes operator commands.",
        inputs: ["Framed command packet"],
        outputs: ["Validated command object", "NACK reason"],
        incomingEvents: [{ name: "packet_ready", source: "Command Ingress", trigger: "Packet queued for parse", frequency: "Burst", latencySensitive: true }],
        internalSignals: [
          { name: "packet_valid", source: "Command Parser", trigger: "Frame and schema validation passed", frequency: "Burst", latencySensitive: true },
          { name: "packet_invalid", source: "Command Parser", trigger: "Checksum or schema validation failed", frequency: "Burst", latencySensitive: true },
        ],
        outgoingSignals: [
          { name: "apply_request", source: "Command Parser", trigger: "Validated command ready for config coordinator", frequency: "Burst", latencySensitive: true },
        ],
        states: [
          {
            name: "VALIDATING",
            description: "Checking frame integrity and command schema.",
            transitions: [
              { event: "packet_valid", triggerKind: "internal", targetState: "DONE", action: "Return decoded command" },
              { event: "packet_invalid", triggerKind: "internal", targetState: "ERROR", action: "Generate rejection details" },
            ],
          },
          {
            name: "ERROR",
            description: "Parser rejected the packet.",
            transitions: [{ event: "packet_ready", triggerKind: "incoming", targetState: "VALIDATING", action: "Reset parser scratch state" }],
          },
        ],
        ownership: [{ resource: "Parser scratch buffer", owner: "Command Parser", accessRules: "Only parser logic mutates validation workspace" }],
        failureModes: [{ scenario: "Malformed payload", impact: "Rejected command", recovery: "Emit deterministic NACK and reset parser state" }],
        debugging: {
          logs: ["Command accepted", "Command rejected"],
          traces: ["Parser latency"],
          observability: ["Checksum failure counter", "Schema rejection counter"],
        },
      },
      {
        ...createEmptyComponent(configCoordinator),
        summary: "Owns validated configuration writes and system consistency checks.",
        inputs: ["Validated command object"],
        outputs: ["Updated runtime config", "Apply result"],
        incomingEvents: [{ name: "apply_request", source: "Command Parser", trigger: "Validated command ready", frequency: "Burst", latencySensitive: true }],
        internalSignals: [
          { name: "apply_complete", source: "Config Coordinator", trigger: "Configuration update committed successfully", frequency: "Burst", latencySensitive: true },
          { name: "apply_failed", source: "Config Coordinator", trigger: "Configuration update rejected or rolled back", frequency: "Burst", latencySensitive: true },
        ],
        outgoingSignals: [
          { name: "response_needed", source: "Config Coordinator", trigger: "Apply result ready for response path", frequency: "Burst", latencySensitive: false },
        ],
        states: [
          {
            name: "READY",
            description: "Waiting for configuration apply request.",
            transitions: [{ event: "apply_request", triggerKind: "incoming", targetState: "APPLYING", action: "Lock config ownership and validate semantics" }],
          },
          {
            name: "APPLYING",
            description: "Writing runtime configuration.",
            transitions: [
              { event: "apply_complete", triggerKind: "internal", targetState: "READY", action: "Release ownership and notify reporter" },
              { event: "apply_failed", triggerKind: "internal", targetState: "READY", action: "Report failure and rollback if needed" },
            ],
          },
        ],
        ownership: [{ resource: "Runtime configuration", owner: "Config Coordinator", accessRules: "Mutate only through validated command API guarded by ownership rules" }],
        failureModes: [{ scenario: "Partial invalid update", impact: "Inconsistent runtime config", recovery: "Reject update atomically and preserve last known good config" }],
        debugging: {
          logs: ["Config apply success", "Config apply failure"],
          traces: ["Apply latency"],
          observability: ["Config version counter", "Apply failure counter"],
        },
      },
      {
        ...createEmptyComponent(responseReporter),
        summary: "Formats ACK/NACK responses and noncritical health output.",
        inputs: ["Apply result", "Parser rejection details", "Health events"],
        outputs: ["UART response packet", "Diagnostic log message"],
        incomingEvents: [{ name: "response_needed", source: "Config Coordinator", trigger: "Command result ready", frequency: "Burst", latencySensitive: false }],
        internalSignals: [
          { name: "send_complete", source: "Response Reporter", trigger: "Response flushed to TX path", frequency: "Burst", latencySensitive: false },
        ],
        outgoingSignals: [
          { name: "ack_emitted", source: "Response Reporter", trigger: "ACK or NACK emitted to operator", frequency: "Burst", latencySensitive: false },
        ],
        states: [
          {
            name: "WAITING",
            description: "Idle until a response needs to be emitted.",
            transitions: [{ event: "response_needed", triggerKind: "incoming", targetState: "SENDING", action: "Build response packet" }],
          },
          {
            name: "SENDING",
            description: "Sending response or health output.",
            transitions: [{ event: "send_complete", triggerKind: "internal", targetState: "WAITING", action: "Flush output buffers" }],
          },
        ],
        ownership: [{ resource: "UART TX response buffer", owner: "Response Reporter", accessRules: "Only response path formats operator-facing packets" }],
        failureModes: [{ scenario: "Response backlog", impact: "Delayed acknowledgements", recovery: "Prioritize ACK/NACK over verbose diagnostics" }],
        debugging: {
          logs: ["ACK emitted", "NACK emitted"],
          traces: ["Response flush latency"],
          observability: ["Pending response depth"],
        },
      },
    ],
    implementationPlan: {
      milestones: ["Create feature discovery skeleton", "Implement parser and config coordinator boundaries", "Inject malformed-packet and burst-traffic tests"],
      apis: ["enqueueFramedPacket()", "parseCommand()", "applyConfiguration()", "emitResponse()"],
      tests: ["Malformed checksum rejection", "Queue overflow behavior", "Config ownership invariants", "End-to-end response latency budget"],
    },
  };
};
