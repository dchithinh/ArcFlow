import type { FirmwareDesign } from "./firmware-design";

const createId = (): string =>
  `design-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isoNow = (): string => new Date().toISOString();

export const createEmptyDesign = (): FirmwareDesign => ({
  id: createId(),
  title: "Untitled firmware design",
  requirement: "",
  createdAt: isoNow(),
  updatedAt: isoNow(),
  featureSummary: {
    summary: "",
    purpose: "",
    constraints: [],
  },
  systemPurpose: {
    shouldDo: [],
    shouldNotDo: [],
    successCriteria: [],
    failureCriteria: [],
    boundaries: [],
  },
  io: {
    inputs: [],
    outputs: [],
  },
  events: [],
  states: [],
  responsibilities: [],
  interactions: [],
  rtos: {
    tasks: [],
    synchronization: [],
    timingRisks: [],
  },
  ownership: [],
  failureModes: [],
  layers: {
    application: [],
    service: [],
    driver: [],
    halBsp: [],
  },
  debugging: {
    logs: [],
    traces: [],
    observability: [],
  },
  implementationPlan: {
    milestones: [],
    apis: [],
    tests: [],
  },
});

export const createSampleDesign = (): FirmwareDesign => ({
  id: createId(),
  title: "UART Command Processor",
  requirement:
    "Support command packets over UART to configure the device, validate input, update runtime configuration, and report success or failure without blocking time-sensitive tasks.",
  createdAt: isoNow(),
  updatedAt: isoNow(),
  featureSummary: {
    summary: "Process UART commands and safely apply runtime configuration updates.",
    purpose: "Provide a controlled operator interface without compromising real-time responsiveness.",
    constraints: ["Low-latency response", "Bounded queue depth", "Static memory allocation", "Recover from malformed packets"],
  },
  systemPurpose: {
    shouldDo: ["Accept UART packets", "Validate command framing", "Update config state", "Respond with acknowledgements"],
    shouldNotDo: ["Block control loop timing", "Allow partial invalid updates"],
    successCriteria: ["Valid command applied within 50 ms", "Command errors produce deterministic NACK"],
    failureCriteria: ["Queue overflow drops valid traffic", "Malformed packet corrupts configuration"],
    boundaries: ["UART transport", "Command parser", "Configuration service", "Logging hooks"],
  },
  io: {
    inputs: ["UART RX bytes", "Command timeout", "Configuration write request"],
    outputs: ["UART TX response", "Updated runtime config", "Error logs"],
  },
  events: [
    { name: "uart_packet_received", source: "UART ISR", trigger: "Valid frame detected", frequency: "Burst", latencySensitive: true },
    { name: "command_timeout", source: "Timer", trigger: "Parser deadline expired", frequency: "Occasional", latencySensitive: false },
  ],
  states: [
    {
      name: "IDLE",
      description: "Waiting for a complete command frame.",
      transitions: [{ event: "uart_packet_received", targetState: "VALIDATING", action: "Queue packet for processing" }],
    },
    {
      name: "VALIDATING",
      description: "Parser checks frame integrity and command schema.",
      transitions: [
        { event: "packet_valid", targetState: "APPLYING", action: "Dispatch command" },
        { event: "packet_invalid", targetState: "ERROR", action: "Emit NACK" },
      ],
    },
    {
      name: "APPLYING",
      description: "Configuration service applies the validated command.",
      transitions: [{ event: "apply_complete", targetState: "IDLE", action: "Send ACK" }],
    },
    {
      name: "ERROR",
      description: "Invalid data or internal failure was detected.",
      transitions: [{ event: "error_handled", targetState: "IDLE", action: "Reset parser state" }],
    },
  ],
  responsibilities: [
    { responsibility: "Acquire UART data", module: "UartRxAdapter" },
    { responsibility: "Parse and validate packets", module: "CommandParser" },
    { responsibility: "Apply configuration updates", module: "ConfigService" },
    { responsibility: "Emit acknowledgements and logs", module: "ResponseReporter" },
  ],
  interactions: [
    { from: "UART_ISR", to: "UART_RX_Queue", mechanism: "queue", data: "Raw frame bytes" },
    { from: "UART_RX_Queue", to: "Command_Task", mechanism: "notification", data: "Packet available" },
    { from: "Command_Task", to: "ConfigService", mechanism: "direct_call", data: "Validated command" },
  ],
  rtos: {
    tasks: [
      {
        name: "Command_Task",
        responsibility: "Validate and dispatch command packets",
        priority: "high",
        type: "event-driven",
        trigger: "UART_RX_Queue notification",
        mayBlock: false,
      },
      {
        name: "Logging_Task",
        responsibility: "Flush diagnostic messages",
        priority: "low",
        type: "background",
        trigger: "Buffered log data",
        mayBlock: true,
      },
    ],
    synchronization: ["Protect configuration state with a mutex", "Use ISR-safe queue push from UART interrupt"],
    timingRisks: ["Burst RX traffic may overflow queue", "Command validation must not starve control loop"],
  },
  ownership: [
    { resource: "UART RX ring buffer", owner: "UartRxAdapter", accessRules: "ISR writes, parser task reads" },
    { resource: "Runtime configuration", owner: "ConfigService", accessRules: "Mutate only through validated command API" },
  ],
  failureModes: [
    { scenario: "Queue overflow under burst traffic", impact: "Dropped commands", recovery: "Count overflow, drop oldest packet, report health event" },
    { scenario: "Malformed command payload", impact: "Command rejected", recovery: "Emit NACK and reset parser state" },
  ],
  layers: {
    application: ["CommandCoordinator", "StateMachine"],
    service: ["CommandParser", "ConfigService", "HealthReporter"],
    driver: ["UartDriver", "TimerDriver"],
    halBsp: ["MCU UART HAL", "Clock BSP"],
  },
  debugging: {
    logs: ["Command accepted", "Command rejected", "Queue overflow"],
    traces: ["UART RX interrupt count", "Command processing latency"],
    observability: ["Queue depth watermark", "Parser error counter"],
  },
  implementationPlan: {
    milestones: ["Create parser skeleton", "Integrate RTOS task flow", "Add failure injection tests"],
    apis: ["parseCommand(frame)", "applyConfiguration(command)", "sendResponse(result)"],
    tests: ["Invalid checksum rejection", "Queue overflow behavior", "Config update latency budget"],
  },
});
