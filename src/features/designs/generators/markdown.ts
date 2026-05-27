import type { FirmwareDesign } from "../schema/firmware-design";

const listBlock = (items: string[]): string =>
  items.filter((item) => item.trim()).length > 0
    ? items.filter((item) => item.trim()).map((item) => `- ${item}`).join("\n")
    : "- None documented yet";

export const generateMarkdown = (design: FirmwareDesign): string => `# ${design.title}

## Requirement
${design.requirement || "Requirement not written yet."}

## Feature Summary
- Summary: ${design.featureSummary.summary || "Not documented yet"}
- Purpose: ${design.featureSummary.purpose || "Not documented yet"}
- Constraints:
${listBlock(design.featureSummary.constraints)}

## System Purpose
### Should Do
${listBlock(design.systemPurpose.shouldDo)}

### Should Not Do
${listBlock(design.systemPurpose.shouldNotDo)}

### Success Criteria
${listBlock(design.systemPurpose.successCriteria)}

### Failure Criteria
${listBlock(design.systemPurpose.failureCriteria)}

### Boundaries
${listBlock(design.systemPurpose.boundaries)}

## Inputs
${listBlock(design.io.inputs)}

## Outputs
${listBlock(design.io.outputs)}

## Events
${design.events.length > 0
    ? design.events
        .map(
          (event) =>
            `- ${event.name || "Unnamed event"} from ${event.source || "Unknown source"} triggered by ${event.trigger || "Unknown trigger"}${event.frequency ? ` (${event.frequency})` : ""}${event.latencySensitive ? " [latency-sensitive]" : ""}`,
        )
        .join("\n")
    : "- No events documented yet"}

## States
${design.states.length > 0
    ? design.states
        .map((state) => {
          const transitions =
            state.transitions.length > 0
              ? state.transitions
                  .map((transition) => `  - on ${transition.event || "unknown event"} -> ${transition.targetState || "unknown state"}${transition.action ? ` (${transition.action})` : ""}`)
                  .join("\n")
              : "  - No transitions documented";
          return `- ${state.name || "Unnamed state"}: ${state.description || "No description"}\n${transitions}`;
        })
        .join("\n")
    : "- No states documented yet"}

## Responsibilities
${design.responsibilities.length > 0
    ? design.responsibilities
        .map((item) => `- ${item.responsibility || "Unnamed responsibility"} -> ${item.module || "Unassigned module"}${item.notes ? ` (${item.notes})` : ""}`)
        .join("\n")
    : "- No responsibilities documented yet"}

## Interactions
${design.interactions.length > 0
    ? design.interactions
        .map((item) => `- ${item.from || "Unknown"} -> ${item.to || "Unknown"} via ${item.mechanism}: ${item.data || "No data"}${item.notes ? ` (${item.notes})` : ""}`)
        .join("\n")
    : "- No interactions documented yet"}

## RTOS Tasks
${design.rtos.tasks.length > 0
    ? design.rtos.tasks
        .map((task) => `- ${task.name || "Unnamed task"} | ${task.priority} | ${task.type} | trigger: ${task.trigger || "Unknown"} | may block: ${task.mayBlock ? "yes" : "no"}`)
        .join("\n")
    : "- No RTOS tasks documented yet"}

### Synchronization
${listBlock(design.rtos.synchronization)}

### Timing Risks
${listBlock(design.rtos.timingRisks)}

## Resource Ownership
${design.ownership.length > 0
    ? design.ownership
        .map((item) => `- ${item.resource || "Unnamed resource"} owned by ${item.owner || "Unknown owner"}: ${item.accessRules || "No rules documented"}`)
        .join("\n")
    : "- No ownership rules documented yet"}

## Failure Modes
${design.failureModes.length > 0
    ? design.failureModes
        .map((item) => `- ${item.scenario || "Unnamed scenario"} | impact: ${item.impact || "Unknown"} | recovery: ${item.recovery || "Unknown"}`)
        .join("\n")
    : "- No failure modes documented yet"}

## Layers
### Application
${listBlock(design.layers.application)}

### Service
${listBlock(design.layers.service)}

### Driver
${listBlock(design.layers.driver)}

### HAL/BSP
${listBlock(design.layers.halBsp)}

## Debuggability
### Logs
${listBlock(design.debugging.logs)}

### Traces
${listBlock(design.debugging.traces)}

### Observability
${listBlock(design.debugging.observability)}

## Implementation Plan
### Milestones
${listBlock(design.implementationPlan.milestones)}

### APIs
${listBlock(design.implementationPlan.apis)}

### Tests
${listBlock(design.implementationPlan.tests)}
`;
