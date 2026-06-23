import type {
  ComponentObject,
  FeatureComponent,
  FeatureWorkspace,
} from "../schema/workspace";

export type WorkspaceOutputs = {
  markdown: string;
  contextDiagram: string;
  architectureFlowchart: string;
  dataFlowDiagram: string;
  behavioralArchitectureDiagram: string;
  componentObjectDiagram: string;
  componentStateDiagram: string;
  sequenceDiagram: string;
  deploymentRuntimeDiagram: string;
  taskTable: string;
  riskReview: string[];
};

const listBlock = (items: string[]): string =>
  items.filter((item) => item.trim()).length > 0
    ? items.filter((item) => item.trim()).map((item) => `- ${item}`).join("\n")
    : "- None documented yet";

const normalizeComparableText = (value: string): string =>
  value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim().toLowerCase();

const getComponentById = (
  workspace: FeatureWorkspace,
  componentId?: string,
): FeatureComponent | null =>
  workspace.components.find((component) => component.id === componentId) ??
  workspace.components[0] ??
  null;

const getSelectedObject = (
  component: FeatureComponent | null,
  selectedObjectId?: string,
): ComponentObject | null =>
  component?.objects.find((object) => object.id === selectedObjectId) ??
  component?.objects[0] ??
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
const wrapMultilineText = (value: string, maxCharsPerLine: number): string => {
  const paragraphs = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return "";
  }

  return paragraphs
    .map((line) => {
      const bulletPrefix = /^[-*]\s+/.test(line) ? `${line.slice(0, 2)}` : "";
      const content = bulletPrefix ? line.slice(2).trim() : line;
      const wrapped = wrapText(content, Math.max(8, maxCharsPerLine - bulletPrefix.length));
      return bulletPrefix ? `${escapeLabel(bulletPrefix)}${wrapped}` : wrapped;
    })
    .join("<br/>");
};
const formatBehavioralComponentLabel = (
  title: string,
  summary: string,
): string =>
  [
    `<div style="font-weight:700;text-align:center;line-height:1.25;">${escapeLabel(title)}</div>`,
    `<div style="font-size:10px;line-height:1.2;text-align:left;color:#365166;margin-top:4px;">${wrapMultilineText(summary, 34)}</div>`,
  ].join("");
const componentAnchorId = (componentId: string, index: number): string =>
  cleanNode(`${componentId || "component"}_${index}`);
export const getBehavioralComponentNodeId = (componentId: string, index: number): string =>
  componentAnchorId(componentId || "component", index);
const shorten = (value: string, maxLength = 52): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
type FlowchartShape =
  | "rectangle"
  | "rounded"
  | "stadium"
  | "subroutine"
  | "database"
  | "circle"
  | "hexagon";

const wrapFlowchartNode = (id: string, label: string, shape: FlowchartShape): string => {
  const escaped =
    /<\/?[a-z][\s\S]*>/i.test(label) ? label : escapeLabel(label);
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

const dataFlowNodeShape = (
  kind: FeatureWorkspace["discovery"]["dataFlowNodes"][number]["kind"],
): FlowchartShape => {
  switch (kind) {
    case "process":
      return "rounded";
    case "data_store":
      return "database";
    case "external_entity":
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

const objectAnchorId = (
  componentId: string,
  objectId: string,
  objectName: string,
  objectIndex: number,
): string =>
  `${componentId}_object_${cleanNode(objectId || objectName || `object_${objectIndex}`)}_${objectIndex}`;

const generateMarkdown = (workspace: FeatureWorkspace): string => {
  const requirementListText = workspace.featureSummary.goals
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
  const showRequirementParagraph =
    normalizeComparableText(workspace.requirement) !==
    normalizeComparableText(requirementListText);

  return `# ${workspace.title}

## Feature Summary
${workspace.featureSummary.summary || "Not documented yet."}

${showRequirementParagraph ? `## Feature Requirement
${workspace.requirement || "Not documented yet."}

` : ""}## Feature Requirements
${listBlock(workspace.featureSummary.goals)}

## Feature Responsibilities
${listBlock(workspace.discovery.responsibilities)}

## Constraints
${listBlock(workspace.featureSummary.constraints)}

## Assumptions
${listBlock(workspace.featureSummary.assumptions)}

## Open Questions
${listBlock(workspace.featureSummary.openQuestions)}
`;
};

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

  const nodes = new Map<string, string>();
  const lines = workspace.discovery.interactions.map((interaction) => {
    const fromName =
      workspace.discovery.candidateComponents.find(
        (item) => item.id === interaction.fromComponentId,
      )?.name || "Unknown";
    const toName =
      workspace.discovery.candidateComponents.find(
        (item) => item.id === interaction.toComponentId,
      )?.name || "Unknown";

    if (!nodes.has(fromName)) {
      nodes.set(fromName, cleanNode(fromName));
    }
    if (!nodes.has(toName)) {
      nodes.set(toName, cleanNode(toName));
    }

    return `    ${nodes.get(fromName)} -->|"${escapeLabel(
      interactionLabel(interaction.mechanism, interaction.data),
    )}"| ${nodes.get(toName)}`;
  });

  const nodeLines = Array.from(nodes.entries()).map(([name, id]) =>
    `    ${wrapFlowchartNode(id, name, "subroutine")}`,
  );

  const useVerticalLayout =
    nodes.size >= 4 || workspace.discovery.interactions.length >= 4;
  const direction = useVerticalLayout ? "TB" : "LR";

  return `flowchart ${direction}
    classDef architectureNode fill:#eef4f7,stroke:#365166,stroke-width:2px,color:#081521;
${nodeLines.join("\n")}
${Array.from(nodes.values())
  .map((id) => `    class ${id} architectureNode`)
  .join("\n")}
${lines.join("\n")}`;
};

const generateDataFlowDiagram = (
  workspace: FeatureWorkspace,
  selectedDataFlowNodeId?: string,
  selectedDataFlowId?: string,
): string => {
  const nodes = workspace.discovery.dataFlowNodes;
  const flows = workspace.discovery.dataFlows;

  if (nodes.length === 0) {
    return `flowchart LR
    ${wrapFlowchartNode("DataFlowStart", "Data flow not modeled yet", "subroutine")}
    DataFlowStart --> ${wrapFlowchartNode("DataFlowNext", "Add data flow nodes and flows", "rounded")}`;
  }

  const selectedFlow = flows.find((flow) => flow.id === selectedDataFlowId) ?? null;
  const selectedNodeIds = new Set<string>();
  if (selectedDataFlowNodeId) {
    selectedNodeIds.add(selectedDataFlowNodeId);
  }
  if (selectedFlow) {
    selectedNodeIds.add(selectedFlow.fromNodeId);
    selectedNodeIds.add(selectedFlow.toNodeId);
  }

  const nodeIdMap = new Map(
    nodes.map((node, index) => [
      node.id,
      `dfd_${cleanNode(node.id || node.name || `node_${index}`)}_${index}`,
    ]),
  );

  const nodeLines = nodes.flatMap((node, index) => {
    const nodeId =
      nodeIdMap.get(node.id) ??
      `dfd_${cleanNode(node.id || node.name || `node_${index}`)}_${index}`;
    const labelParts = [node.name || `Data Flow Node ${index + 1}`];
    if (node.description?.trim()) {
      labelParts.push(wrapText(node.description.trim(), 26));
    }
    const shape = dataFlowNodeShape(node.kind);
    const className = selectedNodeIds.has(node.id)
      ? "dataFlowNodeSelected"
      : node.kind === "data_store"
        ? "dataFlowStore"
        : node.kind === "external_entity"
          ? "dataFlowExternal"
          : "dataFlowProcess";

    return [
      `    ${wrapFlowchartNode(nodeId, labelParts.join("<br/>"), shape)}`,
      `    class ${nodeId} ${className}`,
    ];
  });

  const flowLines = flows.flatMap((flow) => {
    const fromId = nodeIdMap.get(flow.fromNodeId);
    const toId = nodeIdMap.get(flow.toNodeId);
    if (!fromId || !toId) {
      return [];
    }

    return [
      {
        line: `    ${fromId} -->|"${escapeLabel(flow.label || "data flow")}"| ${toId}`,
        selected: flow.id === selectedDataFlowId,
      },
    ];
  });

  const linkLines = flowLines.map((item) => item.line);
  const linkStyleLines = flowLines.flatMap((item, index) =>
    item.selected
      ? [`    linkStyle ${index} stroke:#b5651d,stroke-width:3px,color:#081521`]
      : [],
  );

  return `flowchart LR
    classDef dataFlowProcess fill:#eef4f7,stroke:#365166,stroke-width:2px,color:#081521;
    classDef dataFlowStore fill:#f2efe6,stroke:#6b5c3e,stroke-width:2px,color:#081521;
    classDef dataFlowExternal fill:#fff7e4,stroke:#8e6b3f,stroke-width:2px,color:#081521;
    classDef dataFlowNodeSelected fill:#f7e3bf,stroke:#b5651d,stroke-width:3px,color:#081521,font-weight:bold;
${nodeLines.join("\n")}
${linkLines.join("\n")}
${linkStyleLines.join("\n")}`;
};

const generateBehavioralArchitectureDiagram = (
  workspace: FeatureWorkspace,
  selectedComponentId?: string,
  expandedComponentIds: string[] = [],
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
          objects: [],
          objectInteractions: [],
          ownership: [],
          failureModes: [],
          debugging: {
            logs: [],
            traces: [],
            observability: [],
          },
        }));
  const expandedIds = new Set(expandedComponentIds);

  if (components.length === 0) {
    return `flowchart LR
    ${wrapFlowchartNode("Requirement", workspace.title, "subroutine")} --> ${wrapFlowchartNode("Discovery", "Component discovery", "rounded")}
    Discovery --> ${wrapFlowchartNode("Refinement", "Component refinement", "rounded")}
    Refinement --> ${wrapFlowchartNode("Behavior", "Component interaction view", "rounded")}`;
  }

  const componentNodes = components.flatMap((component, index) => {
    const componentId = componentAnchorId(component.id || component.name || "component", index);
    const componentGroupId = `${componentId}_group`;
    const summary = component.summary.trim() || "No responsibility summary yet";
    const selected = selectedComponentId === component.id;
    const expanded = expandedIds.has(component.id);
    const objectNodes =
      expanded && component.objects.length > 0
        ? component.objects.flatMap((object, objectIndex) => {
            const objectId = objectAnchorId(componentId, object.id, object.name, objectIndex);
            const objectLabel = [
              object.name || `Object ${objectIndex + 1}`,
              object.objectType === "active" ? "Active object" : "Passive object",
              object.needsState
                ? `${object.states.length} state${object.states.length === 1 ? "" : "s"}`
                : "No state modeled",
            ].join("<br/>");

            return [
              `      ${wrapFlowchartNode(objectId, objectLabel, "rounded")}`,
              `      class ${objectId} ${
                object.objectType === "active"
                  ? "behaviorObjectActive"
                  : "behaviorObjectPassive"
              }`,
            ];
          })
        : expanded
          ? [
              `      ${wrapFlowchartNode(`${componentId}_empty`, "No internal objects yet", "rounded")}`,
              `      class ${componentId}_empty behaviorObjectGhost`,
            ]
          : [];
    const objectEdges =
      expanded && component.objectInteractions.length > 0
        ? component.objectInteractions.flatMap((interaction) => {
            const fromIndex = component.objects.findIndex(
              (object) => object.id === interaction.fromObjectId,
            );
            const toIndex = component.objects.findIndex(
              (object) => object.id === interaction.toObjectId,
            );
            if (fromIndex < 0 || toIndex < 0) {
              return [];
            }

            const fromId = objectAnchorId(
              componentId,
              component.objects[fromIndex].id,
              component.objects[fromIndex].name,
              fromIndex,
            );
            const toId = objectAnchorId(
              componentId,
              component.objects[toIndex].id,
              component.objects[toIndex].name,
              toIndex,
            );

            return [
              `      ${fromId} -->|"${escapeLabel(
                [interaction.relationship, interaction.notes]
                  .filter(Boolean)
                  .join(": ") || "interaction",
              )}"| ${toId}`,
            ];
          })
        : [];

    return [
      `    subgraph ${componentGroupId}[" "]`,
      `      direction TB`,
      `      ${wrapFlowchartNode(
        componentId,
        formatBehavioralComponentLabel(
          `${expanded ? "[-]" : "[+]"} ${component.name || `Component ${index + 1}`}`,
          summary,
        ),
        "subroutine",
      )}`,
      ...objectNodes,
      ...objectEdges,
      `    end`,
      `    style ${componentGroupId} fill:${selected ? "#fff6e6" : "#fffdf8"},stroke:${selected ? "#b5651d" : "#365166"},stroke-width:${selected ? "3px" : "2px"},color:#081521`,
      `    class ${componentId} componentCore`,
      ...(selected
        ? [`    style ${componentId} fill:#f5ecd8,stroke:#0f766e,stroke-width:3px,color:#081521,font-weight:bold`]
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
          const label =
            [interaction.mechanism, interaction.data].filter(Boolean).join(": ") ||
            "interaction";
          return `    ${fromId} -->|"${escapeLabel(label)}"| ${toId}`;
        })
      : components.slice(0, -1).map((component, index) => {
          const nextComponent = components[index + 1];
          const fromId = componentAnchorId(component.id, index);
          const toId = componentAnchorId(nextComponent.id, index + 1);
          return `    ${fromId} -->|"discovery relation"| ${toId}`;
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

  return `flowchart LR
    classDef componentCore fill:#f4e7cf,stroke:#123a35,stroke-width:3px,color:#081521,font-weight:bold;
    classDef behaviorObjectActive fill:#fffdf8,stroke:#365166,stroke-width:2px,color:#081521;
    classDef behaviorObjectPassive fill:#f4f7fb,stroke:#7a8fa3,stroke-width:2px,color:#081521;
    classDef behaviorObjectGhost fill:#f8f1e4,stroke:#8a9aa8,stroke-dasharray: 4 4,color:#4b6477;
    classDef actorNode fill:#eef4f7,stroke:#365166,stroke-width:2px,color:#081521;
${componentNodes.join("\n")}
${actorEdges.join("\n")}
${edges.join("\n")}`;
};

const generateComponentObjectDiagram = (
  workspace: FeatureWorkspace,
  selectedComponentId?: string,
  selectedObjectId?: string,
): string => {
  const component = getComponentById(workspace, selectedComponentId);
  if (!component) {
    return `flowchart TB
    ${wrapFlowchartNode("NoComponent", "Select a component to model internal objects", "rounded")}`;
  }

  const componentId = componentAnchorId(component.id || component.name || "component", 0);
  const objectGroupId = `${componentId}_objects`;

  const objectNodes =
    component.objects.length > 0
      ? component.objects.flatMap((object, index) => {
          const objectId = objectAnchorId(componentId, object.id, object.name, index);
          const selected = selectedObjectId === object.id;
          const label = [
            object.name || `Object ${index + 1}`,
            object.objectType === "active" ? "Active object" : "Passive object",
            object.responsibility ? shorten(object.responsibility, 52) : "",
            object.needsState ? `${object.states.length} state(s)` : "No state modeled",
          ]
            .filter(Boolean)
            .join("<br/>");

          return [
            `    ${wrapFlowchartNode(objectId, label, "rounded")}`,
            `    class ${objectId} ${selected ? "selectedObjectNode" : object.objectType === "active" ? "componentObjectActive" : "componentObjectPassive"}`,
          ];
        })
      : [
          `    ${wrapFlowchartNode("NoObjectsYet", "No internal objects yet", "rounded")}`,
          `    class NoObjectsYet componentStateGhost`,
        ];

  const objectEdges = component.objectInteractions.flatMap((interaction) => {
    const fromIndex = component.objects.findIndex((object) => object.id === interaction.fromObjectId);
    const toIndex = component.objects.findIndex((object) => object.id === interaction.toObjectId);
    if (fromIndex < 0 || toIndex < 0) {
      return [];
    }

    const fromId = objectAnchorId(
      componentId,
      component.objects[fromIndex].id,
      component.objects[fromIndex].name,
      fromIndex,
    );
    const toId = objectAnchorId(
      componentId,
      component.objects[toIndex].id,
      component.objects[toIndex].name,
      toIndex,
    );

    return [
      `    ${fromId} -->|"${escapeLabel(
        [interaction.relationship, interaction.notes].filter(Boolean).join(": ") || "interaction",
      )}"| ${toId}`,
    ];
  });

  return `flowchart TB
    classDef componentCore fill:#f4e7cf,stroke:#123a35,stroke-width:3px,color:#081521,font-weight:bold;
    classDef componentObjectActive fill:#fffdf8,stroke:#365166,stroke-width:2px,color:#081521;
    classDef componentObjectPassive fill:#f4f7fb,stroke:#7a8fa3,stroke-width:2px,color:#081521;
    classDef selectedObjectNode fill:#fffbeb,stroke:#0f766e,stroke-width:3px,color:#081521,font-weight:bold;
    classDef componentStateGhost fill:#f8f1e4,stroke:#8a9aa8,stroke-dasharray: 4 4,color:#4b6477;
    subgraph ${componentId}["${escapeLabel(component.name || "Selected Component")}"]
      direction TB
      subgraph ${objectGroupId}[" "]
        direction TB
${objectNodes.join("\n")}
${objectEdges.join("\n")}
      end
    end
    style ${componentId} fill:#fff8ef,stroke:#b85f2c,stroke-width:3px,color:#081521`;
};

const generateComponentStateDiagram = (
  workspace: FeatureWorkspace,
  selectedComponentId?: string,
  selectedObjectId?: string,
): string => {
  const component = getComponentById(workspace, selectedComponentId);
  const object = getSelectedObject(component, selectedObjectId);
  if (!component || !object || object.states.length === 0) {
    return `stateDiagram-v2
    [*] --> DISCOVERY
    DISCOVERY --> OBJECTS
    OBJECTS --> STATES`;
  }

  const stateAlias = (stateName: string, stateIndex: number): string =>
    `${cleanNode(object.id || "object")}_${cleanNode(stateName || `STATE_${stateIndex}`)}_${stateIndex}`;

  const firstState = stateAlias(object.states[0].name || "INITIAL", 0);
  const lines: string[] = ["stateDiagram-v2"];

  object.states.forEach((state, stateIndex) => {
    lines.push(
      `    state "${escapeLabel(state.name || `State ${stateIndex + 1}`)}" as ${stateAlias(
        state.name,
        stateIndex,
      )}`,
    );
  });

  lines.push(`    [*] --> ${firstState}`);

  for (const [stateIndex, state] of object.states.entries()) {
    const source = stateAlias(state.name || "STATE", stateIndex);

    if (state.transitions.length === 0) {
      if (state.description.trim()) {
        lines.push(`    note right of ${source}: ${escapeLabel(state.description.trim())}`);
      }
      continue;
    }

    for (const transition of state.transitions) {
      const targetIndex = object.states.findIndex(
        (candidate) => candidate.name.trim() === transition.targetState.trim(),
      );
      const target =
        targetIndex >= 0
          ? stateAlias(object.states[targetIndex].name, targetIndex)
          : cleanNode(transition.targetState || "UNKNOWN");
      lines.push(
        `    ${source} --> ${target}: ${formatTransitionEventLabel(transition.event, transition.triggerKind)}`,
      );
    }

    if (state.description.trim()) {
      lines.push(`    note right of ${source}: ${escapeLabel(state.description.trim())}`);
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

const runtimeNodeShape = (
  kind: FeatureWorkspace["discovery"]["runtimeNodes"][number]["kind"],
): FlowchartShape => {
  switch (kind) {
    case "mcu":
    case "device":
      return "subroutine";
    case "core":
    case "task":
    case "thread":
    case "service":
      return "rounded";
    case "isr":
    case "timer":
      return "circle";
    case "queue":
    case "store":
      return "database";
    case "mutex":
      return "hexagon";
    case "peripheral":
      return "stadium";
    default:
      return "rectangle";
  }
};

const runtimeCanHostChildren = (
  kind: FeatureWorkspace["discovery"]["runtimeNodes"][number]["kind"],
): boolean =>
  ["mcu", "core", "device", "peripheral", "service", "other"].includes(kind);

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

const generateDeploymentRuntimeDiagram = (
  workspace: FeatureWorkspace,
  selectedRuntimeNodeId?: string,
  selectedRuntimeLinkId?: string,
): string => {
  const nodes = workspace.discovery.runtimeNodes;
  const links = workspace.discovery.runtimeLinks;

  if (nodes.length === 0) {
    return `flowchart LR
    ${wrapFlowchartNode("Runtime", "Runtime topology not modeled yet", "subroutine")}
    Runtime --> ${wrapFlowchartNode("Tasks", "Add runtime nodes and links", "rounded")}`;
  }

  const selectedRuntimeLink = links.find((link) => link.id === selectedRuntimeLinkId) ?? null;
  const childrenByParent = new Map<string, FeatureWorkspace["discovery"]["runtimeNodes"]>();
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const rootNodes: FeatureWorkspace["discovery"]["runtimeNodes"] = [];

  nodes.forEach((node) => {
    const host = node.hostNodeId ? nodesById.get(node.hostNodeId) : null;
    if (host && host.id !== node.id) {
      const current = childrenByParent.get(host.id) ?? [];
      childrenByParent.set(host.id, [...current, node]);
      return;
    }

    rootNodes.push(node);
  });

  const selectedNodeIds = new Set<string>();
  if (selectedRuntimeNodeId) {
    selectedNodeIds.add(selectedRuntimeNodeId);
  }
  if (selectedRuntimeLink !== null) {
    selectedNodeIds.add(selectedRuntimeLink.fromNodeId);
    selectedNodeIds.add(selectedRuntimeLink.toNodeId);
  }

  const nodeIdMap = new Map(
    nodes.map((node, index) => [
      node.id,
      `runtime_${cleanNode(node.id || node.name || `node_${index}`)}_${index}`,
    ]),
  );
  const boundaryIdMap = new Map(
    nodes.map((node, index) => [node.id, `runtime_boundary_${cleanNode(node.id || `node_${index}`)}_${index}`]),
  );

  const renderNodeTree = (
    node: FeatureWorkspace["discovery"]["runtimeNodes"][number],
    depth = 1,
    ancestry = new Set<string>(),
  ): string[] => {
    const indent = "  ".repeat(depth);
    const nodeId = nodeIdMap.get(node.id) ?? cleanNode(node.id);
    const boundaryId = boundaryIdMap.get(node.id) ?? `${nodeId}_boundary`;
    const children = (childrenByParent.get(node.id) ?? []).filter(
      (child) => !ancestry.has(child.id),
    );
    const selected = selectedNodeIds.has(node.id);
    const shouldRenderAsBoundary = runtimeCanHostChildren(node.kind) || children.length > 0;
    const label = node.responsibility.trim()
      ? wrapText(node.responsibility.trim(), 28)
      : escapeLabel(node.kind);

    if (!shouldRenderAsBoundary) {
      return [
        `${indent}${wrapFlowchartNode(nodeId, `${node.name || "Unnamed node"}<br/>${label}`, runtimeNodeShape(node.kind))}`,
        `${indent}class ${nodeId} ${selected ? "runtimeNodeSelected" : "runtimeNode"}`,
      ];
    }

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(node.id);

    const lines = [
      `${indent}subgraph ${boundaryId}["${escapeLabel(node.name || "Unnamed runtime boundary")}"]`,
      `${indent}  direction TB`,
      `${indent}  ${wrapFlowchartNode(nodeId, `${escapeLabel(node.kind)}<br/>${label}`, "rounded")}`,
      `${indent}  class ${nodeId} ${selected ? "runtimeNodeSelected" : "runtimeBoundaryAnchor"}`,
    ];

    children.forEach((child) => {
      lines.push(...renderNodeTree(child, depth + 1, nextAncestry));
    });

    lines.push(`${indent}end`);
    lines.push(
      `${indent}style ${boundaryId} fill:${selected ? "#f7e3bf" : "#f8f4ea"},stroke:${selected ? "#b5651d" : "#8e6b3f"},stroke-width:${selected ? "3px" : "2px"}`,
    );
    return lines;
  };

  const nodeLines = rootNodes.flatMap((node) => renderNodeTree(node));

  const renderedLinks = links.flatMap((link) => {
    const fromIndex = nodes.findIndex((node) => node.id === link.fromNodeId);
    const toIndex = nodes.findIndex((node) => node.id === link.toNodeId);
    if (fromIndex < 0 || toIndex < 0) {
      return [];
    }

    const fromNode = nodes[fromIndex];
    const toNode = nodes[toIndex];
    const fromId =
      nodeIdMap.get(fromNode.id) ??
      `runtime_${cleanNode(fromNode.id || fromNode.name || `node_${fromIndex}`)}_${fromIndex}`;
    const toId =
      nodeIdMap.get(toNode.id) ??
      `runtime_${cleanNode(toNode.id || toNode.name || `node_${toIndex}`)}_${toIndex}`;
    return [
      {
        line: `    ${fromId} -->|"${escapeLabel(
          interactionLabel(link.kind, link.label),
        )}"| ${toId}`,
        selected: selectedRuntimeLinkId === link.id,
      },
    ];
  });

  const linkLines = renderedLinks.map((item) => item.line);
  const linkStyleLines = renderedLinks.flatMap((item, index) =>
    item.selected
      ? [
          `    linkStyle ${index} stroke:#b5651d,stroke-width:3px,color:#081521`,
        ]
      : [],
  );

  return `flowchart LR
    classDef runtimeNode fill:#eef4f7,stroke:#365166,stroke-width:2px,color:#081521;
    classDef runtimeBoundaryAnchor fill:#fff7e4,stroke:#8e6b3f,stroke-width:2px,color:#081521;
    classDef runtimeNodeSelected fill:#f7e3bf,stroke:#b5651d,stroke-width:3px,color:#081521;
${nodeLines.join("\n")}
${linkLines.join("\n")}
${linkStyleLines.join("\n")}`;
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
  selectedObjectId?: string,
  expandedBehavioralComponentIds: string[] = [],
  selectedContextEntityId?: string,
  selectedScenarioId?: string,
  selectedDataFlowNodeId?: string,
  selectedDataFlowId?: string,
  selectedRuntimeNodeId?: string,
  selectedRuntimeLinkId?: string,
): WorkspaceOutputs => ({
  markdown: generateMarkdown(workspace),
  contextDiagram: generateContextDiagram(workspace, selectedContextEntityId),
  architectureFlowchart: generateArchitectureFlowchart(workspace),
  dataFlowDiagram: generateDataFlowDiagram(
    workspace,
    selectedDataFlowNodeId,
    selectedDataFlowId,
  ),
  behavioralArchitectureDiagram: generateBehavioralArchitectureDiagram(
    workspace,
    selectedComponentId,
    expandedBehavioralComponentIds,
  ),
  componentObjectDiagram: generateComponentObjectDiagram(
    workspace,
    selectedComponentId,
    selectedObjectId,
  ),
  componentStateDiagram: generateComponentStateDiagram(
    workspace,
    selectedComponentId,
    selectedObjectId,
  ),
  sequenceDiagram: generateSequenceDiagram(workspace, selectedScenarioId),
  deploymentRuntimeDiagram: generateDeploymentRuntimeDiagram(
    workspace,
    selectedRuntimeNodeId,
    selectedRuntimeLinkId,
  ),
  taskTable: generateTaskTable(workspace),
  riskReview: generateRiskReview(workspace),
});
