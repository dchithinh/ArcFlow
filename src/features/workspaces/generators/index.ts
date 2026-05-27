import type { FeatureComponent, FeatureWorkspace } from "../schema/workspace";

export type WorkspaceOutputs = {
  markdown: string;
  architectureFlowchart: string;
  componentStateDiagram: string;
  taskTable: string;
  riskReview: string[];
};

const listBlock = (items: string[]): string =>
  items.filter((item) => item.trim()).length > 0
    ? items.filter((item) => item.trim()).map((item) => `- ${item}`).join("\n")
    : "- None documented yet";

const getComponentById = (workspace: FeatureWorkspace, componentId?: string): FeatureComponent | null =>
  workspace.components.find((component) => component.id === componentId) ?? workspace.components[0] ?? null;

const cleanNode = (value: string): string => value.replace(/[^a-zA-Z0-9_]/g, "_") || "Node";

const generateMarkdown = (workspace: FeatureWorkspace): string => `# ${workspace.title}

## Requirement
${workspace.requirement || "Requirement not written yet."}

## Feature Summary
- Summary: ${workspace.featureSummary.summary || "Not documented yet"}
- Problem: ${workspace.featureSummary.problem || "Not documented yet"}

## Goals
${listBlock(workspace.featureSummary.goals)}

## Constraints
${listBlock(workspace.featureSummary.constraints)}

## Assumptions
${listBlock(workspace.featureSummary.assumptions)}

## Open Questions
${listBlock(workspace.featureSummary.openQuestions)}

## External Actors
${listBlock(workspace.discovery.externalActors)}

## Responsibilities
${listBlock(workspace.discovery.responsibilities)}

## Candidate Components
${workspace.discovery.candidateComponents.length > 0
    ? workspace.discovery.candidateComponents
        .map(
          (component) =>
            `- ${component.name || "Unnamed component"}: ${component.responsibility || "No responsibility yet"}${component.rationale ? ` (${component.rationale})` : ""}`,
        )
        .join("\n")
    : "- No candidate components documented yet"}

## Component Interactions
${workspace.discovery.interactions.length > 0
    ? workspace.discovery.interactions
        .map((interaction) => {
          const fromName =
            workspace.discovery.candidateComponents.find((item) => item.id === interaction.fromComponentId)?.name ||
            "Unknown component";
          const toName =
            workspace.discovery.candidateComponents.find((item) => item.id === interaction.toComponentId)?.name ||
            "Unknown component";
          return `- ${fromName} -> ${toName} via ${interaction.mechanism}: ${interaction.data || "No data"}${interaction.notes ? ` (${interaction.notes})` : ""}`;
        })
        .join("\n")
    : "- No interactions documented yet"}

## Candidate RTOS Tasks
${workspace.discovery.candidateTasks.length > 0
    ? workspace.discovery.candidateTasks
        .map(
          (task) =>
            `- ${task.name || "Unnamed task"} | ${task.priority} | ${task.type} | trigger: ${task.trigger || "Unknown"} | may block: ${task.mayBlock ? "yes" : "no"}`,
        )
        .join("\n")
    : "- No tasks documented yet"}

## System Risks
${listBlock(workspace.discovery.systemRisks)}

## Components
${workspace.components.length > 0
    ? workspace.components
        .map(
          (component) => `### ${component.name || "Unnamed component"}
- Summary: ${component.summary || "Not documented yet"}
- Inputs:
${listBlock(component.inputs)}
- Outputs:
${listBlock(component.outputs)}
- Events:
${component.events.length > 0
              ? component.events
                  .map(
                    (event) =>
                      `  - ${event.name || "Unnamed event"} from ${event.source || "Unknown source"} triggered by ${event.trigger || "Unknown trigger"}`,
                  )
                  .join("\n")
              : "  - None documented yet"}
- States:
${component.states.length > 0
              ? component.states
                  .map(
                    (state) =>
                      `  - ${state.name || "Unnamed state"}: ${state.description || "No description"}${
                        state.transitions.length > 0
                          ? `\n${state.transitions
                              .map(
                                (transition) =>
                                  `    - on ${transition.event || "event"} -> ${transition.targetState || "state"}${transition.action ? ` (${transition.action})` : ""}`,
                              )
                              .join("\n")}`
                          : ""
                      }`,
                  )
                  .join("\n")
              : "  - None documented yet"}
- Ownership:
${component.ownership.length > 0
              ? component.ownership.map((item) => `  - ${item.resource || "Resource"} owned by ${item.owner || "Unknown"}: ${item.accessRules || "No rules"}`).join("\n")
              : "  - None documented yet"}
- Failure Modes:
${component.failureModes.length > 0
              ? component.failureModes.map((item) => `  - ${item.scenario || "Scenario"} | impact: ${item.impact || "Unknown"} | recovery: ${item.recovery || "Unknown"}`).join("\n")
              : "  - None documented yet"}
`,
        )
        .join("\n")
    : "- No components refined yet"}

## Implementation Plan
### Milestones
${listBlock(workspace.implementationPlan.milestones)}

### APIs
${listBlock(workspace.implementationPlan.apis)}

### Tests
${listBlock(workspace.implementationPlan.tests)}
`;

const generateArchitectureFlowchart = (workspace: FeatureWorkspace): string => {
  if (workspace.discovery.interactions.length === 0) {
    return `flowchart LR
    Requirement["${workspace.title}"] --> Discovery["Component discovery"]
    Discovery --> Detail["Component refinement"]`;
  }

  const lines = workspace.discovery.interactions.map((interaction) => {
    const fromName =
      workspace.discovery.candidateComponents.find((item) => item.id === interaction.fromComponentId)?.name ||
      "Unknown";
    const toName =
      workspace.discovery.candidateComponents.find((item) => item.id === interaction.toComponentId)?.name ||
      "Unknown";
    return `    ${cleanNode(fromName)}["${fromName}"] -->|${[interaction.mechanism, interaction.data].filter(Boolean).join(": ") || "interaction"}| ${cleanNode(toName)}["${toName}"]`;
  });

  return `flowchart LR
${lines.join("\n")}`;
};

const generateComponentStateDiagram = (
  workspace: FeatureWorkspace,
  selectedComponentId?: string,
): string => {
  const component = getComponentById(workspace, selectedComponentId);
  if (!component || component.states.length === 0) {
    return `stateDiagram-v2
    [*] --> DISCOVERY
    DISCOVERY --> REFINEMENT
    REFINEMENT --> REVIEW`;
  }

  const firstState = cleanNode(component.states[0].name || "INITIAL");
  const lines: string[] = ["stateDiagram-v2", `    [*] --> ${firstState}`];

  for (const state of component.states) {
    const source = cleanNode(state.name || "STATE");

    if (state.transitions.length === 0) {
      lines.push(`    ${source}: ${state.description || "No description"}`);
      continue;
    }

    for (const transition of state.transitions) {
      lines.push(`    ${source} --> ${cleanNode(transition.targetState || "UNKNOWN")}: ${transition.event || "event"}`);
    }
  }

  return lines.join("\n");
};

const generateTaskTable = (workspace: FeatureWorkspace): string => {
  const header = `| Task | Responsibility | Priority | Type | Trigger | May Block |
|---|---|---|---|---|---|`;

  if (workspace.discovery.candidateTasks.length === 0) {
    return `${header}
| No task yet | - | - | - | - | - |`;
  }

  const rows = workspace.discovery.candidateTasks.map(
    (task) =>
      `| ${task.name || "-"} | ${task.responsibility || "-"} | ${task.priority} | ${task.type} | ${task.trigger || "-"} | ${task.mayBlock ? "Yes" : "No"} |`,
  );

  return [header, ...rows].join("\n");
};

const generateRiskReview = (workspace: FeatureWorkspace): string[] => {
  const risks = [
    {
      label: "Missing candidate components",
      active: workspace.discovery.candidateComponents.length === 0,
    },
    {
      label: "Missing component interaction mapping",
      active: workspace.discovery.interactions.length === 0,
    },
    {
      label: "Missing task proposal",
      active: workspace.discovery.candidateTasks.length === 0,
    },
    {
      label: "Unowned component state or resources",
      active: workspace.components.some((component) => component.ownership.length === 0),
    },
    {
      label: "Missing failure recovery",
      active:
        workspace.components.length === 0 ||
        workspace.components.some(
          (component) =>
            component.failureModes.length === 0 ||
            component.failureModes.some((mode) => !mode.recovery.trim()),
        ),
    },
  ];

  return risks.map((risk) => `${risk.active ? "[ ]" : "[x]"} ${risk.label}`);
};

export const generateWorkspaceOutputs = (
  workspace: FeatureWorkspace,
  selectedComponentId?: string,
): WorkspaceOutputs => ({
  markdown: generateMarkdown(workspace),
  architectureFlowchart: generateArchitectureFlowchart(workspace),
  componentStateDiagram: generateComponentStateDiagram(workspace, selectedComponentId),
  taskTable: generateTaskTable(workspace),
  riskReview: generateRiskReview(workspace),
});
