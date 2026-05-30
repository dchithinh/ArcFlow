import type { FeatureComponent, FeatureWorkspace } from "../schema/workspace";

export type WorkspaceOutputs = {
  markdown: string;
  contextDiagram: string;
  architectureFlowchart: string;
  behavioralArchitectureDiagram: string;
  componentStateDiagram: string;
  sequenceDiagram: string;
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
const wrapText = (value: string, maxCharsPerLine: number): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }

    if (`${currentLine} ${word}`.length <= maxCharsPerLine) {
      currentLine = `${currentLine} ${word}`;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.map(escapeLabel).join("<br/>");
};
const componentAnchorId = (componentId: string, index: number): string =>
  cleanNode(`${componentId || "component"}_${index}`);
const shorten = (value: string, maxLength = 52): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);

type FlowchartShape =
  | "rectangle"
  | "rounded"
  | "stadium"
  | "subroutine"
  | "database"
  | "circle"
  | "hexagon";

const wrapFlowchartNode = (id: string, label: string, shape: FlowchartShape): string => {
  const escaped = escapeLabel(label);
  switch (shape) {
    case "rounded":
      return `${id}("${escaped}")`;
    case "stadium":
      return `${id}(["${escaped}"])`;
    case "subroutine":
      return `${id}[["${escaped}"]]`;
    case "database":
      return `${id}[("${escaped}")]`;
    case "circle":
      return `${id}(("${escaped}"))`;
    case "hexagon":
      return `${id}{{"${escaped}"}}`;
    default:
      return `${id}["${escaped}"]`;
  }
};

const contextEntityShape = (
  kind: FeatureWorkspace["discovery"]["contextEntities"][number]["kind"],
): FlowchartShape => {
  switch (kind) {
    case "user":
      return "stadium";
    case "device":
    case "sensor":
    case "actuator":
      return "hexagon";
    case "service":
      return "subroutine";
    case "timer":
      return "circle";
    case "system":
      return "rectangle";
    default:
      return "rectangle";
  }
};

const interactionLabel = (mechanism: string, data: string): string =>
  [mechanism, data].filter(Boolean).join(": ") || "interaction";

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

## Feature Summary
${workspace.featureSummary.summary || "Not documented yet."}

## Feature Requirements
${listBlock(workspace.featureSummary.goals)}

## Feature Responsibilities
${listBlock(workspace.discovery.responsibilities)}

## Constraints
${listBlock(workspace.featureSummary.constraints)}

## Assumptions
${listBlock(workspace.featureSummary.assumptions)}

## Open Questions
${listBlock(workspace.featureSummary.openQuestions)}

## Context Entities
${workspace.discovery.contextEntities.length > 0
    ? workspace.discovery.contextEntities
        .map(
          (entity) =>
            `- ${entity.name || "Unnamed entity"} (${entity.kind})${entity.description ? `: ${entity.description}` : ""}`,
        )
        .join("\n")
    : "- No context entities documented yet"}

## Boundary Flows
${workspace.discovery.contextFlows.length > 0
    ? workspace.discovery.contextFlows
        .map((flow) => {
          const entityName =
            workspace.discovery.contextEntities.find((entity) => entity.id === flow.entityId)?.name ||
            "Unknown entity";
          return `- ${entityName} | ${flow.direction} | ${flow.label || "Unlabeled flow"}${flow.description ? ` (${flow.description})` : ""}`;
        })
        .join("\n")
    : "- No boundary flows documented yet"}

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

## Sequence Scenarios
${workspace.discovery.sequenceScenarios.length > 0
    ? workspace.discovery.sequenceScenarios
        .map(
          (scenario) => `### ${scenario.name || "Unnamed scenario"}
- Goal: ${scenario.goal || "Not documented yet"}
- Trigger: ${scenario.trigger || "Not documented yet"}
- Outcome: ${scenario.outcome || "Not documented yet"}
- Failure Path: ${scenario.failurePath || "Not documented yet"}
- Participants:
${scenario.participants.length > 0
              ? scenario.participants
                  .map(
                    (participant) =>
                      `  - ${participant.name || "Unnamed participant"} (${participant.kind})${participant.description ? `: ${participant.description}` : ""}`,
                  )
                  .join("\n")
              : "  - None documented yet"}
- Steps:
${scenario.steps.length > 0
              ? scenario.steps
                  .map((step, index) => {
                    const fromName =
                      scenario.participants.find(
                        (participant) => participant.id === step.fromParticipantId,
                      )?.name || "Unknown sender";
                    const toName =
                      scenario.participants.find(
                        (participant) => participant.id === step.toParticipantId,
                      )?.name || "Unknown receiver";
                    return `  - ${index + 1}. ${fromName} -> ${toName} [${step.type}]: ${step.message || "No message"}${step.note ? ` (${step.note})` : ""}`;
                  })
                  .join("\n")
              : "  - None documented yet"}
`,
        )
        .join("\n")
    : "- No sequence scenarios documented yet"}

## Implementation Tasks
${workspace.discovery.candidateTasks.length > 0
    ? workspace.discovery.candidateTasks
        .map(
          (task) =>
            `- ${task.name || "Unnamed task"} | ${task.priority} | ${task.type} | trigger: ${task.trigger || "Unknown"} | may block: ${task.mayBlock ? "yes" : "no"}`,
        )
        .join("\n")
    : "- No implementation tasks documented yet"}

## Component Details
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

const generateContextDiagram = (
  workspace: FeatureWorkspace,
  selectedContextEntityId?: string,
): string => {
  const featureNode = cleanNode(workspace.title || "FeatureWorkspace");
  const entities = workspace.discovery.contextEntities;
  const flows = workspace.discovery.contextFlows;

  if (entities.length === 0) {
    return `flowchart LR
    ${wrapFlowchartNode(featureNode, workspace.title || "Feature Workspace", "subroutine")}
    ${wrapFlowchartNode("Outside", "Outside World", "rectangle")} -. boundary not modeled yet .-> ${featureNode}`;
  }

  const entityLines = entities.flatMap((entity, index) => {
    const entityId = `context_${cleanNode(entity.id || entity.name || `entity_${index}`)}_${index}`;
    const selected = selectedContextEntityId === entity.id;
    const label = entity.description?.trim()
      ? `${entity.name || "Unnamed entity"}<br/>${escapeLabel(entity.description.trim())}`
      : `${entity.name || "Unnamed entity"}<br/>${entity.kind}`;
    return [
      `    ${wrapFlowchartNode(entityId, label, contextEntityShape(entity.kind))}`,
      `    class ${entityId} ${selected ? "contextEntitySelected" : "contextEntity"}`,
    ];
  });

  const flowLines =
    flows.length > 0
      ? flows.flatMap((flow) => {
          const entityIndex = entities.findIndex((entity) => entity.id === flow.entityId);
          const entity = entities[entityIndex];
          if (!entity) {
            return [];
          }

          const entityId = `context_${cleanNode(entity.id || entity.name || `entity_${entityIndex}`)}_${entityIndex}`;
          const label = escapeLabel(flow.label || "flow");
          if (flow.direction === "outbound") {
            return [`    ${featureNode} -->|"${label}"| ${entityId}`];
          }
          if (flow.direction === "bidirectional") {
            return [
              `    ${entityId} -->|"${label}"| ${featureNode}`,
              `    ${featureNode} -->|"${label}"| ${entityId}`,
            ];
          }

          return [`    ${entityId} -->|"${label}"| ${featureNode}`];
        })
      : entities.map((entity, index) => {
          const entityId = `context_${cleanNode(entity.id || entity.name || `entity_${index}`)}_${index}`;
          return `    ${entityId} -. boundary flow .-> ${featureNode}`;
        });

  return `flowchart LR
    classDef featureBoundary fill:#f4e7cf,stroke:#123a35,stroke-width:4px,color:#081521,font-weight:bold;
    classDef contextEntity fill:#eef4f7,stroke:#365166,stroke-width:2px,color:#081521;
    classDef contextEntitySelected fill:#fff2d7,stroke:#b85f2c,stroke-width:4px,color:#081521,font-weight:bold;
    ${wrapFlowchartNode(featureNode, workspace.title || "Feature Workspace", "subroutine")}
    class ${featureNode} featureBoundary
${entityLines.join("\n")}
${flowLines.join("\n")}`;
};

const generateArchitectureFlowchart = (workspace: FeatureWorkspace): string => {
  if (workspace.discovery.interactions.length === 0) {
    return `flowchart LR
    ${wrapFlowchartNode("Requirement", workspace.title, "subroutine")} --> ${wrapFlowchartNode("Discovery", "Component discovery", "rounded")}
    Discovery --> ${wrapFlowchartNode("Detail", "Component refinement", "rounded")}`;
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
    return `    ${wrapFlowchartNode(cleanNode(fromName), fromName, "subroutine")} -->|"${escapeLabel(
      interactionLabel(interaction.mechanism, interaction.data),
    )}"| ${wrapFlowchartNode(cleanNode(toName), toName, "subroutine")}`;
  });

  return `flowchart LR
${lines.join("\n")}`;
};

const generateBehavioralArchitectureDiagram = (
  workspace: FeatureWorkspace,
  selectedComponentId?: string,
): string => {
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
    ${wrapFlowchartNode("Requirement", workspace.title, "subroutine")} --> ${wrapFlowchartNode("Discovery", "Component discovery", "rounded")}
    Discovery --> ${wrapFlowchartNode("Refinement", "Component refinement", "rounded")}
    Refinement --> ${wrapFlowchartNode("Behavior", "Behavioral architecture view", "rounded")}`;
  }

  const subgraphs = components.flatMap((component, index) => {
    const componentId = componentAnchorId(component.id || component.name || "component", index);
    const groupId = `${componentId}_group`;
    const stateGroupId = `${componentId}_states`;
    const roleNode = `${componentId}_role`;
    const summary = component.summary.trim() || "No responsibility summary yet";
    const selected = selectedComponentId === component.id;

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
              `        ${wrapFlowchartNode(currentStateId, labelParts.join("<br/>"), "rounded")}`,
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
                    `        ${wrapFlowchartNode(targetId, transition.targetState || "Unknown target", "rounded")}`,
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
            `        ${wrapFlowchartNode(`${componentId}_state_placeholder`, "No states yet", "rounded")}`,
            `        class ${componentId}_state_placeholder componentStateGhost`,
            `        ${componentId} -.-> ${componentId}_state_placeholder`,
          ];

    return [
      `    subgraph ${groupId}["${escapeLabel(component.name || `Component ${index + 1}`)}"]`,
      "        direction TB",
      `        ${wrapFlowchartNode(componentId, component.name || `Component ${index + 1}`, "subroutine")}`,
      `        subgraph ${stateGroupId}[" "]`,
      "            direction TB",
      ...stateNodes.map((line) => `    ${line}`),
      "        end",
      `        ${wrapFlowchartNode(roleNode, `Role<br/>${summary}`, "rectangle")}`,
      "    end",
      `    class ${componentId} componentCore`,
      `    class ${roleNode} componentMeta`,
      `    style ${groupId} fill:${selected ? "#fff2d7" : "#fff8ef"},stroke:${selected ? "#0f766e" : "#b85f2c"},stroke-width:${selected ? "5px" : "3px"},color:#081521`,
      `    style ${stateGroupId} fill:transparent,stroke:transparent`,
      ...(selected
        ? [
            `    style ${componentId} fill:#f5ecd8,stroke:#0f766e,stroke-width:3px,color:#081521,font-weight:bold`,
            `    style ${roleNode} fill:#fff7eb,stroke:#0f766e,stroke-width:2px,color:#081521`,
            ...Array.from(stateIds.values()).map(
              (stateId) =>
                `    style ${stateId} fill:#fffbeb,stroke:#0f766e,stroke-width:2.5px,color:#081521`,
            ),
          ]
        : []),
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

  const actorEdges = workspace.discovery.contextEntities
    .map((entity) => entity.name.trim())
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
        `    ${wrapFlowchartNode(actorId, actor, "rectangle")}`,
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
          `    ${wrapFlowchartNode(sourceNode, `${event.source || "Outside World"}<br/>${event.name || "incoming event"}`, "rectangle")}`,
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
          `    ${wrapFlowchartNode(sinkNode, `${signal.name || "outgoing signal"}<br/>${signal.trigger || "Outside World"}`, "rectangle")}`,
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

const sequenceArrowForType = (
  type: FeatureWorkspace["discovery"]["sequenceScenarios"][number]["steps"][number]["type"],
): string => {
  switch (type) {
    case "async":
      return "->>";
    case "return":
      return "-->>";
    default:
      return "->>";
  }
};

const sequenceParticipantDeclaration = (
  participant: FeatureWorkspace["discovery"]["sequenceScenarios"][number]["participants"][number],
  alias: string,
): string => {
  const label = wrapText(participant.name.trim() || "Unnamed participant", 18);
  switch (participant.kind) {
    case "actor":
      return `    actor ${alias} as ${escapeLabel(label)}`;
    case "device":
      return `    participant ${alias} as ${escapeLabel(label)}`;
    case "service":
      return `    participant ${alias} as ${escapeLabel(label)}`;
    case "system":
      return `    participant ${alias} as ${escapeLabel(label)}`;
    default:
      return `    participant ${alias} as ${escapeLabel(label)}`;
  }
};

const generateSequenceDiagram = (
  workspace: FeatureWorkspace,
  selectedScenarioId?: string,
): string => {
  const scenario =
    workspace.discovery.sequenceScenarios.find((item) => item.id === selectedScenarioId) ??
    workspace.discovery.sequenceScenarios[0];

  if (!scenario) {
    return `sequenceDiagram
    autonumber
    participant Feature as ${escapeLabel(workspace.title || "Feature Workspace")}
    Note over Feature: Add a scenario to model step-by-step runtime behavior.`;
  }

  const participantAliases = new Map(
    scenario.participants.map((participant, index) => [
      participant.id,
      `P${index + 1}`,
    ]),
  );
  const firstAlias = participantAliases.values().next().value || "Feature";

  const participantLines =
    scenario.participants.length > 0
      ? scenario.participants.map((participant) =>
          sequenceParticipantDeclaration(
            participant,
            participantAliases.get(participant.id) || cleanNode(participant.name || "P"),
          ),
        )
      : [`    participant Feature as ${escapeLabel(workspace.title || "Feature Workspace")}`];

  const introNotes = [
    scenario.goal ? `Goal: ${scenario.goal}` : "",
    scenario.trigger ? `Trigger: ${scenario.trigger}` : "",
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => `    Note left of ${firstAlias}: ${wrapText(value, 36)}`);

  const stepLines =
    scenario.steps.length > 0
      ? scenario.steps.flatMap((step) => {
          const fromAlias =
            participantAliases.get(step.fromParticipantId) ||
            firstAlias;
          const toAlias =
            participantAliases.get(step.toParticipantId) ||
            firstAlias;
          const message = wrapText(step.message || "message", 28);
          const lines = [
            `    ${fromAlias}${sequenceArrowForType(step.type)}${toAlias}: ${message}`,
          ];
          if (step.note?.trim()) {
            lines.push(
              `    Note over ${fromAlias},${toAlias}: ${wrapText(step.note.trim(), 42)}`,
            );
          }
          return lines;
        })
      : [`    Note over ${firstAlias}: Add steps to render the runtime flow.`];

  const closingNotes = [scenario.outcome.trim(), scenario.failurePath?.trim() || ""]
    .filter(Boolean)
    .map((value) => `    Note left of ${firstAlias}: ${wrapText(value, 36)}`);

  return `sequenceDiagram
    autonumber
    %% ${escapeLabel(scenario.name || "Sequence Scenario")}
${participantLines.join("\n")}
${introNotes.length > 0 ? `${introNotes.join("\n")}\n` : ""}${stepLines.join("\n")}
${closingNotes.join("\n")}`;
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
      label: "Missing implementation task proposal",
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
  selectedContextEntityId?: string,
  selectedScenarioId?: string,
): WorkspaceOutputs => ({
  markdown: generateMarkdown(workspace),
  contextDiagram: generateContextDiagram(workspace, selectedContextEntityId),
  architectureFlowchart: generateArchitectureFlowchart(workspace),
  behavioralArchitectureDiagram: generateBehavioralArchitectureDiagram(
    workspace,
    selectedComponentId,
  ),
  componentStateDiagram: generateComponentStateDiagram(workspace, selectedComponentId),
  sequenceDiagram: generateSequenceDiagram(workspace, selectedScenarioId),
  taskTable: generateTaskTable(workspace),
  riskReview: generateRiskReview(workspace),
});
