import type { FeatureComponent, FeatureWorkspace } from "../schema/workspace";

export type WorkspaceOutputs = {
  markdown: string;
  architectureFlowchart: string;
  behavioralArchitectureDiagram: string;
  componentStateDiagram: string;
  taskTable: string;
  riskReview: string[];
};

const listBlock = (items: string[]): string =>
  items.filter((item) => item.trim()).length > 0
    ? items.filter((item) => item.trim()).map((item) => `- ${item}`).join("\n")
    : "- None documented yet";

const getComponentById = (
  workspace: FeatureWorkspace,
  componentId?: string,
): FeatureComponent | null =>
  workspace.components.find((component) => component.id === componentId) ??
  workspace.components[0] ??
  null;

const cleanNode = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_]/g, "_") || "Node";
const escapeLabel = (value: string): string => value.replace(/"/g, "&quot;");
const componentAnchorId = (componentId: string, index: number): string =>
  cleanNode(`${componentId || "component"}_${index}`);
const shorten = (value: string, maxLength = 52): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);

const formatTransitionEventLabel = (
  event: string,
  triggerKind?: "incoming" | "internal",
): string => {
  const prefix =
    triggerKind === "incoming"
      ? "incoming"
      : triggerKind === "internal"
        ? "internal"
        : "event";
  return `${prefix}: ${event || "event"}`;
};

const stateAnchorId = (
  componentId: string,
  stateName: string,
  stateIndex: number,
): string => `${componentId}_state_${cleanNode(stateName || `state_${stateIndex}`)}_${stateIndex}`;

const findIncomingStateTargets = (
  component: FeatureComponent,
  componentId: string,
): Map<string, string[]> => {
  const targets = new Map<string, string[]>();

  component.states.forEach((state, stateIndex) => {
    const sourceId = stateAnchorId(componentId, state.name, stateIndex);
    state.transitions
      .filter((transition) => transition.triggerKind === "incoming")
      .forEach((transition) => {
        const key = transition.event.trim().toLowerCase();
        if (!key) {
          return;
        }

        const current = targets.get(key) ?? [];
        if (!current.includes(sourceId)) {
          current.push(sourceId);
        }
        targets.set(key, current);
      });
  });

  return targets;
};

const scoreStateForOutgoingSignal = (
  state: FeatureComponent["states"][number],
  signalName: string,
): number => {
  const signalTokens = tokenize(signalName);
  const stateTokens = tokenize(`${state.name} ${state.description}`);
  let score = signalTokens.filter((token) => stateTokens.includes(token)).length;

  state.transitions.forEach((transition) => {
    if (transition.triggerKind !== "internal") {
      return;
    }

    const transitionTokens = tokenize(
      `${transition.event} ${transition.action || ""} ${transition.targetState}`,
    );
    score += signalTokens.filter((token) => transitionTokens.includes(token)).length;
  });

  if (score === 0 && state.transitions.some((transition) => transition.triggerKind === "internal")) {
    score += 1;
  }

  return score;
};

const findOutgoingStateSource = (
  component: FeatureComponent,
  componentId: string,
  signalName: string,
): string => {
  if (component.states.length === 0) {
    return componentId;
  }

  const scoredStates = component.states.map((state, stateIndex) => ({
    anchor: stateAnchorId(componentId, state.name, stateIndex),
    score: scoreStateForOutgoingSignal(state, signalName),
    index: stateIndex,
  }));

  scoredStates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.index - left.index;
  });

  return scoredStates[0].anchor;
};

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
            workspace.discovery.candidateComponents.find(
              (item) => item.id === interaction.fromComponentId,
            )?.name || "Unknown component";
          const toName =
            workspace.discovery.candidateComponents.find(
              (item) => item.id === interaction.toComponentId,
            )?.name || "Unknown component";
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
- Incoming Events:
${component.incomingEvents.length > 0
              ? component.incomingEvents
                  .map(
                    (event) =>
                      `  - ${event.name || "Unnamed event"} from ${event.source || "Unknown source"} triggered by ${event.trigger || "Unknown trigger"}`,
                  )
                  .join("\n")
              : "  - None documented yet"}
- Internal Signals:
${component.internalSignals.length > 0
              ? component.internalSignals
                  .map(
                    (signal) =>
                      `  - ${signal.name || "Unnamed signal"} from ${signal.source || "Unknown source"} triggered by ${signal.trigger || "Unknown trigger"}`,
                  )
                  .join("\n")
              : "  - None documented yet"}
- Outgoing Signals:
${component.outgoingSignals.length > 0
              ? component.outgoingSignals
                  .map(
                    (signal) =>
                      `  - ${signal.name || "Unnamed signal"} from ${signal.source || "Unknown source"} triggered by ${signal.trigger || "Unknown trigger"}`,
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
                                  `    - on ${formatTransitionEventLabel(transition.event, transition.triggerKind)} -> ${transition.targetState || "state"}${transition.action ? ` (${transition.action})` : ""}`,
                              )
                              .join("\n")}`
                          : ""
                      }`,
                  )
                  .join("\n")
              : "  - None documented yet"}
- Ownership:
${component.ownership.length > 0
              ? component.ownership
                  .map(
                    (item) =>
                      `  - ${item.resource || "Resource"} owned by ${item.owner || "Unknown"}: ${item.accessRules || "No rules"}`,
                  )
                  .join("\n")
              : "  - None documented yet"}
- Failure Modes:
${component.failureModes.length > 0
              ? component.failureModes
                  .map(
                    (item) =>
                      `  - ${item.scenario || "Scenario"} | impact: ${item.impact || "Unknown"} | recovery: ${item.recovery || "Unknown"}`,
                  )
                  .join("\n")
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
      workspace.discovery.candidateComponents.find(
        (item) => item.id === interaction.fromComponentId,
      )?.name || "Unknown";
    const toName =
      workspace.discovery.candidateComponents.find(
        (item) => item.id === interaction.toComponentId,
      )?.name || "Unknown";
    return `    ${cleanNode(fromName)}["${fromName}"] -->|${[interaction.mechanism, interaction.data].filter(Boolean).join(": ") || "interaction"}| ${cleanNode(toName)}["${toName}"]`;
  });

  return `flowchart LR
${lines.join("\n")}`;
};

const generateBehavioralArchitectureDiagram = (workspace: FeatureWorkspace): string => {
  const components =
    workspace.components.length > 0
      ? workspace.components
      : workspace.discovery.candidateComponents.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          summary: candidate.responsibility,
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
        }));

  if (components.length === 0) {
    return `flowchart LR
    Requirement["${escapeLabel(workspace.title)}"] --> Discovery["Component discovery"]
    Discovery --> Refinement["Component refinement"]
    Refinement --> Behavior["Behavioral architecture view"]`;
  }

  const subgraphs = components.flatMap((component, index) => {
    const componentId = componentAnchorId(component.id || component.name || "component", index);
    const groupId = `${componentId}_group`;
    const stateGroupId = `${componentId}_states`;
    const roleNode = `${componentId}_role`;
    const summary = component.summary.trim() || "No responsibility summary yet";

    const stateIds = new Map(
      component.states.map((state, stateIndex) => [
        state.name,
        `${componentId}_state_${cleanNode(state.name || `state_${stateIndex}`)}_${stateIndex}`,
      ]),
    );

    const stateNodes =
      component.states.length > 0
        ? component.states.flatMap((state, stateIndex) => {
            const currentStateId =
              stateIds.get(state.name) ||
              `${componentId}_state_${cleanNode(state.name || `state_${stateIndex}`)}_${stateIndex}`;
            const labelParts = [state.name || `State ${stateIndex + 1}`];
            if (state.description.trim()) {
              labelParts.push(shorten(state.description.trim(), 42));
            }

            const lines = [
              `        ${currentStateId}["${escapeLabel(labelParts.join("<br/>"))}"]`,
              `        class ${currentStateId} componentState`,
            ];

            if (stateIndex === 0) {
              lines.push(`        ${componentId} -. entry .-> ${currentStateId}`);
            }

            if (state.transitions.length === 0) {
              return lines;
            }

            const transitionLines = state.transitions.map((transition, transitionIndex) => {
              const matchedTarget = component.states.find(
                (candidateState) => candidateState.name === transition.targetState,
              );
              const targetId = matchedTarget
                ? stateIds.get(matchedTarget.name) ||
                  `${componentId}_state_${cleanNode(matchedTarget.name)}_${component.states.indexOf(matchedTarget)}`
                : `${currentStateId}_unknown_${transitionIndex}`;

              const fallbackTargetNode = matchedTarget
                ? []
                : [
                    `        ${targetId}["${escapeLabel(transition.targetState || "Unknown target")}"]`,
                    `        class ${targetId} componentStateGhost`,
                  ];

              return [
                ...fallbackTargetNode,
                `        ${currentStateId} -->|"${escapeLabel(
                  formatTransitionEventLabel(transition.event, transition.triggerKind),
                )}"| ${targetId}`,
              ];
            });

            return [...lines, ...transitionLines.flat()];
          })
        : [
            `        ${componentId}_state_placeholder["No states yet"]`,
            `        class ${componentId}_state_placeholder componentStateGhost`,
            `        ${componentId} -.-> ${componentId}_state_placeholder`,
          ];

    return [
      `    subgraph ${groupId}["${escapeLabel(component.name || `Component ${index + 1}`)}"]`,
      "        direction TB",
      `        ${componentId}["${escapeLabel(component.name || `Component ${index + 1}`)}"]`,
      `        subgraph ${stateGroupId}[" "]`,
      "            direction TB",
      ...stateNodes.map((line) => `    ${line}`),
      "        end",
      `        ${roleNode}["Role<br/>${escapeLabel(summary)}"]`,
      "    end",
      `    class ${componentId} componentCore`,
      `    class ${roleNode} componentMeta`,
      `    style ${groupId} fill:#fff8ef,stroke:#b85f2c,stroke-width:3px,color:#081521`,
      `    style ${stateGroupId} fill:transparent,stroke:transparent`,
    ];
  });

  const componentIds = new Set(components.map((component) => component.id));
  const edges =
    workspace.discovery.interactions.length > 0
      ? workspace.discovery.interactions.map((interaction, index) => {
          const fromComponent = components.find(
            (component) => component.id === interaction.fromComponentId,
          );
          const toComponent = components.find(
            (component) => component.id === interaction.toComponentId,
          );
          const fromIndex = fromComponent ? components.indexOf(fromComponent) : index;
          const toIndex = toComponent ? components.indexOf(toComponent) : index + 1;
          const fromId = componentAnchorId(
            fromComponent?.id || interaction.fromComponentId || "from",
            fromIndex,
          );
          const toId = componentAnchorId(
            toComponent?.id || interaction.toComponentId || "to",
            toIndex,
          );
          const sourceAnchor = fromComponent
            ? findOutgoingStateSource(fromComponent, fromId, interaction.data || interaction.mechanism)
            : fromId;
          const incomingTargets = toComponent
            ? findIncomingStateTargets(toComponent, toId)
            : new Map<string, string[]>();
          const targetAnchors =
            incomingTargets.get((interaction.data || "").trim().toLowerCase()) ??
            incomingTargets.get((interaction.notes || "").trim().toLowerCase()) ??
            [
              toComponent && toComponent.states.length > 0
                ? stateAnchorId(toId, toComponent.states[0].name, 0)
                : toId,
            ];
          const label =
            [interaction.mechanism, interaction.data].filter(Boolean).join(": ") ||
            "interaction";
          return targetAnchors.map(
            (targetAnchor) =>
              `    ${sourceAnchor} -->|"${escapeLabel(label)}"| ${targetAnchor}`,
          );
        })
          .flat()
      : components.slice(0, -1).map((component, index) => {
          const nextComponent = components[index + 1];
          const fromId = componentAnchorId(component.id, index);
          const toId = componentAnchorId(nextComponent.id, index + 1);
          const sourceAnchor = findOutgoingStateSource(component, fromId, "discovery relation");
          const targetAnchor =
            nextComponent.states.length > 0
              ? stateAnchorId(toId, nextComponent.states[0].name, 0)
              : toId;
          return `    ${sourceAnchor} -->|"discovery relation"| ${targetAnchor}`;
        });

  const actorEdges = workspace.discovery.externalActors
    .map((actor) => actor.trim())
    .filter(Boolean)
    .slice(0, 4)
    .flatMap((actor, index) => {
      const actorId = `actor_${index}`;
      const targetComponent =
        workspace.discovery.interactions[index]?.fromComponentId &&
        componentIds.has(workspace.discovery.interactions[index].fromComponentId)
          ? components.find(
              (component) =>
                component.id === workspace.discovery.interactions[index].fromComponentId,
            )
          : components[index % components.length];
      const normalizedTargetId = componentAnchorId(
        targetComponent?.id || "component",
        targetComponent ? components.indexOf(targetComponent) : 0,
      );
      return [
        `    ${actorId}["${escapeLabel(actor)}"]`,
        `    ${actorId} -.-> ${normalizedTargetId}`,
        `    class ${actorId} actorNode`,
      ];
    });

  const externalIncomingEdges = components.flatMap((component, componentIndex) =>
    component.incomingEvents
      .filter((event) => {
        const normalizedSource = event.source.trim().toLowerCase();
        if (!normalizedSource) {
          return true;
        }

        return !components.some(
          (candidate) => candidate.name.trim().toLowerCase() === normalizedSource,
        );
      })
      .map((event, eventIndex) => {
        const incomingTargets = findIncomingStateTargets(
          component,
          componentAnchorId(component.id, componentIndex),
        );
        const targetAnchors =
          incomingTargets.get(event.name.trim().toLowerCase()) ??
          [
            component.states.length > 0
              ? stateAnchorId(
                  componentAnchorId(component.id, componentIndex),
                  component.states[0].name,
                  0,
                )
              : componentAnchorId(component.id, componentIndex),
          ];
        const sourceNode = `${componentAnchorId(component.id, componentIndex)}_incoming_external_${eventIndex}`;
        return [
          `    ${sourceNode}["${escapeLabel(event.source || "Outside World")}<br/>${escapeLabel(event.name || "incoming event")}"]`,
          ...targetAnchors.map(
            (targetAnchor) =>
              `    ${sourceNode} -->|"${escapeLabel(event.trigger || event.name || "incoming")}"| ${targetAnchor}`,
          ),
          `    class ${sourceNode} actorNode`,
        ];
      })
      .flat(),
  );

  const externalOutgoingEdges = components.flatMap((component, componentIndex) =>
    component.outgoingSignals
      .filter((signal) => {
        const normalizedTarget = signal.trigger.trim().toLowerCase();
        const normalizedName = signal.name.trim().toLowerCase();
        return !workspace.discovery.interactions.some((interaction) => {
          if (interaction.fromComponentId !== component.id) {
            return false;
          }

          const interactionLabel = [interaction.mechanism, interaction.data]
            .join(" ")
            .trim()
            .toLowerCase();

          return (
            (normalizedName && interactionLabel.includes(normalizedName)) ||
            (normalizedTarget && interactionLabel.includes(normalizedTarget))
          );
        });
      })
      .map((signal, signalIndex) => {
        const sinkNode = `${componentAnchorId(component.id, componentIndex)}_outgoing_external_${signalIndex}`;
        const sourceAnchor = findOutgoingStateSource(
          component,
          componentAnchorId(component.id, componentIndex),
          signal.name,
        );
        return [
          `    ${sinkNode}["${escapeLabel(signal.name || "outgoing signal")}<br/>${escapeLabel(signal.trigger || "Outside World")}"]`,
          `    ${sourceAnchor} -->|"${escapeLabel(signal.name || "outgoing")}"| ${sinkNode}`,
          `    class ${sinkNode} actorNode`,
        ];
      })
      .flat(),
  );

  return `flowchart LR
    classDef componentCore fill:#f4e7cf,stroke:#123a35,stroke-width:3px,color:#081521,font-weight:bold;
    classDef componentMeta fill:#ffffff,stroke:#365166,stroke-width:2px,color:#081521;
    classDef componentState fill:#fffdf8,stroke:#365166,stroke-width:2px,color:#081521;
    classDef componentStateGhost fill:#f8f1e4,stroke:#8a9aa8,stroke-dasharray: 4 4,color:#4b6477;
    classDef actorNode fill:#eef4f7,stroke:#365166,stroke-width:2px,color:#081521;
${subgraphs.join("\n")}
${actorEdges.join("\n")}
${externalIncomingEdges.join("\n")}
${externalOutgoingEdges.join("\n")}
${edges.join("\n")}`;
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
      lines.push(
        `    ${source} --> ${cleanNode(transition.targetState || "UNKNOWN")}: ${formatTransitionEventLabel(transition.event, transition.triggerKind)}`,
      );
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
  behavioralArchitectureDiagram: generateBehavioralArchitectureDiagram(workspace),
  componentStateDiagram: generateComponentStateDiagram(workspace, selectedComponentId),
  taskTable: generateTaskTable(workspace),
  riskReview: generateRiskReview(workspace),
});
