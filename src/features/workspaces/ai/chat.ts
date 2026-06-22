import type {
  ComponentInteraction,
  DataFlow,
  DataFlowNode,
  FeatureComponent,
  FeatureWorkspace,
  RuntimeLink,
  RuntimeNode,
  SequenceScenario,
} from "../schema/workspace";

export type WorkspaceChatScope =
  | {
      type: "workspace";
      label: string;
    }
  | {
      type: "component";
      label: string;
      componentId: string;
    };

export type WorkspaceChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type WorkspaceChatHistoryEntry = Pick<WorkspaceChatMessage, "role" | "text">;

export type WorkspaceChatPayload = {
  question: string;
  scope: WorkspaceChatScope;
  history: WorkspaceChatHistoryEntry[];
  context: {
    feature: {
      title: string;
      summary: string;
      requirements: string[];
      responsibilities: string[];
      constraints: string[];
      assumptions: string[];
      openQuestions: string[];
    };
    design: {
      components: string[];
      interactions: string[];
      dataFlowNodes: string[];
      dataFlows: string[];
      runtimeNodes: string[];
      runtimeLinks: string[];
      scenarios: string[];
    };
    selected?: {
      component: {
        name: string;
        summary: string;
        inputs: string[];
        outputs: string[];
        incomingEvents: string[];
        internalSignals: string[];
        outgoingSignals: string[];
        objects: string[];
        objectInteractions: string[];
        ownership: string[];
        failureModes: string[];
        relatedInteractions: string[];
        relatedDataFlows: string[];
        relatedRuntimeNodes: string[];
        relatedScenarios: string[];
      };
    };
  };
};

export type WorkspaceChatSuccessResponse = {
  answer: string;
  durationMs: number;
  model: string;
  provider: string;
  scope: WorkspaceChatScope["type"];
};

const compactList = (items: string[], limit = 8): string[] =>
  items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);

const summarizeInteraction = (
  workspace: FeatureWorkspace,
  interaction: ComponentInteraction,
): string => {
  const fromName =
    workspace.discovery.candidateComponents.find(
      (candidate) => candidate.id === interaction.fromComponentId,
    )?.name || "Unknown source";
  const toName =
    workspace.discovery.candidateComponents.find(
      (candidate) => candidate.id === interaction.toComponentId,
    )?.name || "Unknown target";
  const details = [interaction.mechanism, interaction.data, interaction.notes]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" | ");

  return details ? `${fromName} -> ${toName}: ${details}` : `${fromName} -> ${toName}`;
};

const summarizeDataFlowNode = (node: DataFlowNode): string =>
  [node.name, node.kind, node.description].map((item) => String(item || "").trim()).filter(Boolean).join(" | ");

const summarizeDataFlow = (
  workspace: FeatureWorkspace,
  flow: DataFlow,
): string => {
  const fromName =
    workspace.discovery.dataFlowNodes.find((node) => node.id === flow.fromNodeId)?.name ||
    "Unknown source";
  const toName =
    workspace.discovery.dataFlowNodes.find((node) => node.id === flow.toNodeId)?.name ||
    "Unknown target";
  const details = [flow.label, flow.notes].map((item) => String(item || "").trim()).filter(Boolean).join(" | ");

  return details ? `${fromName} -> ${toName}: ${details}` : `${fromName} -> ${toName}`;
};

const summarizeRuntimeNode = (node: RuntimeNode): string =>
  [node.name, node.kind, node.responsibility, node.notes]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" | ");

const summarizeRuntimeLink = (
  workspace: FeatureWorkspace,
  link: RuntimeLink,
): string => {
  const fromName =
    workspace.discovery.runtimeNodes.find((node) => node.id === link.fromNodeId)?.name ||
    "Unknown source";
  const toName =
    workspace.discovery.runtimeNodes.find((node) => node.id === link.toNodeId)?.name ||
    "Unknown target";
  const details = [link.kind, link.label, link.notes]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" | ");

  return details ? `${fromName} -> ${toName}: ${details}` : `${fromName} -> ${toName}`;
};

const summarizeScenario = (scenario: SequenceScenario): string =>
  [scenario.name, scenario.goal, scenario.trigger, scenario.outcome]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" | ");

const summarizeComponent = (component: FeatureComponent): string =>
  [component.name, component.summary].map((item) => String(item || "").trim()).filter(Boolean).join(": ");

const includesInsensitive = (source: string, value: string): boolean =>
  source.toLowerCase().includes(value.toLowerCase());

const buildWorkspaceDesignSummary = (workspace: FeatureWorkspace) => ({
  components: compactList(workspace.components.map(summarizeComponent), 10),
  interactions: compactList(
    workspace.discovery.interactions.map((interaction) => summarizeInteraction(workspace, interaction)),
    10,
  ),
  dataFlowNodes: compactList(
    workspace.discovery.dataFlowNodes.map(summarizeDataFlowNode),
    10,
  ),
  dataFlows: compactList(
    workspace.discovery.dataFlows.map((flow) => summarizeDataFlow(workspace, flow)),
    10,
  ),
  runtimeNodes: compactList(
    workspace.discovery.runtimeNodes.map(summarizeRuntimeNode),
    12,
  ),
  runtimeLinks: compactList(
    workspace.discovery.runtimeLinks.map((link) => summarizeRuntimeLink(workspace, link)),
    12,
  ),
  scenarios: compactList(
    workspace.discovery.sequenceScenarios.map(summarizeScenario),
    6,
  ),
});

const buildComponentSelectionContext = (
  workspace: FeatureWorkspace,
  component: FeatureComponent,
) => {
  const componentName = component.name.trim();
  const relatedInteractions = workspace.discovery.interactions
    .filter(
      (interaction) =>
        interaction.fromComponentId === component.id || interaction.toComponentId === component.id,
    )
    .map((interaction) => summarizeInteraction(workspace, interaction));

  const relatedDataFlows = workspace.discovery.dataFlows
    .filter((flow) => {
      const fromName =
        workspace.discovery.dataFlowNodes.find((node) => node.id === flow.fromNodeId)?.name || "";
      const toName =
        workspace.discovery.dataFlowNodes.find((node) => node.id === flow.toNodeId)?.name || "";
      const label = `${fromName} ${flow.label} ${toName} ${flow.notes || ""}`;
      return includesInsensitive(label, componentName);
    })
    .map((flow) => summarizeDataFlow(workspace, flow));

  const relatedRuntimeNodes = workspace.discovery.runtimeNodes
    .filter((node) => {
      const text = [node.name, node.responsibility, node.notes].join(" ");
      return includesInsensitive(text, componentName);
    })
    .map(summarizeRuntimeNode);

  const relatedScenarios = workspace.discovery.sequenceScenarios
    .filter((scenario) =>
      scenario.participants.some((participant) => includesInsensitive(participant.name, componentName)),
    )
    .map(summarizeScenario);

  return {
    component: {
      name: component.name,
      summary: component.summary,
      inputs: compactList(component.inputs, 8),
      outputs: compactList(component.outputs, 8),
      incomingEvents: compactList(
        component.incomingEvents.map((event) =>
          [event.name, event.source, event.trigger].map((item) => String(item || "").trim()).filter(Boolean).join(" | "),
        ),
        10,
      ),
      internalSignals: compactList(
        component.internalSignals.map((event) =>
          [event.name, event.trigger].map((item) => String(item || "").trim()).filter(Boolean).join(" | "),
        ),
        10,
      ),
      outgoingSignals: compactList(
        component.outgoingSignals.map((event) =>
          [event.name, event.source, event.trigger].map((item) => String(item || "").trim()).filter(Boolean).join(" | "),
        ),
        10,
      ),
      objects: compactList(
        component.objects.map((object) => {
          const stateSummary = object.states
            .map((state) => {
              const transitions = state.transitions
                .map((transition) =>
                  [transition.event, transition.targetState, transition.action]
                    .map((item) => String(item || "").trim())
                    .filter(Boolean)
                    .join(" -> "),
                )
                .filter(Boolean)
                .join("; ");
              return [state.name, state.description, transitions].filter(Boolean).join(" | ");
            })
            .filter(Boolean)
            .join(" || ");
          return [
            object.name,
            object.objectType,
            object.responsibility,
            object.needsState ? "needs state" : "no state",
            stateSummary,
          ]
            .filter(Boolean)
            .join(" | ");
        }),
        10,
      ),
      objectInteractions: compactList(
        component.objectInteractions.map((interaction) => {
          const fromName =
            component.objects.find((object) => object.id === interaction.fromObjectId)?.name ||
            "Unknown object";
          const toName =
            component.objects.find((object) => object.id === interaction.toObjectId)?.name ||
            "Unknown object";
          return [fromName, "->", toName, interaction.relationship, interaction.notes || ""]
            .filter(Boolean)
            .join(" ");
        }),
        10,
      ),
      ownership: compactList(
        component.ownership.map((item) =>
          [item.resource, item.owner, item.accessRules].filter(Boolean).join(" | "),
        ),
        8,
      ),
      failureModes: compactList(
        component.failureModes.map((item) =>
          [item.scenario, item.impact, item.recovery].filter(Boolean).join(" | "),
        ),
        8,
      ),
      relatedInteractions: compactList(relatedInteractions, 8),
      relatedDataFlows: compactList(relatedDataFlows, 8),
      relatedRuntimeNodes: compactList(relatedRuntimeNodes, 8),
      relatedScenarios: compactList(relatedScenarios, 6),
    },
  };
};

const trimHistory = (history: WorkspaceChatMessage[]): WorkspaceChatHistoryEntry[] =>
  history.slice(-6).map(({ role, text }) => ({ role, text: text.trim() })).filter((item) => item.text);

export const getWorkspaceChatScopeKey = (scope: WorkspaceChatScope): string =>
  scope.type === "workspace" ? "workspace" : `component:${scope.componentId}`;

export const buildWorkspaceChatPayload = ({
  workspace,
  scope,
  question,
  history,
}: {
  workspace: FeatureWorkspace;
  scope: WorkspaceChatScope;
  question: string;
  history: WorkspaceChatMessage[];
}): WorkspaceChatPayload => {
  const baseContext: WorkspaceChatPayload["context"] = {
    feature: {
      title: workspace.title,
      summary: workspace.featureSummary.summary,
      requirements: compactList(workspace.featureSummary.goals, 10),
      responsibilities: compactList(workspace.discovery.responsibilities, 10),
      constraints: compactList(workspace.featureSummary.constraints, 8),
      assumptions: compactList(workspace.featureSummary.assumptions, 8),
      openQuestions: compactList(workspace.featureSummary.openQuestions, 8),
    },
    design: buildWorkspaceDesignSummary(workspace),
  };

  if (scope.type === "component") {
    const component = workspace.components.find((item) => item.id === scope.componentId);
    if (component) {
      baseContext.selected = buildComponentSelectionContext(workspace, component);
    }
  }

  return {
    question: question.trim(),
    scope,
    history: trimHistory(history),
    context: baseContext,
  };
};
