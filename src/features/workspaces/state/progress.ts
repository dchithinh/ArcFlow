import type { FeatureWorkspace, WorkspaceSectionId } from "../schema/workspace";

const hasText = (value: string | undefined): boolean => Boolean(value && value.trim().length > 0);
const hasList = (value: string[]): boolean => value.some(hasText);

export const isWorkspaceSectionStarted = (
  workspace: FeatureWorkspace,
  sectionId: WorkspaceSectionId,
): boolean => {
  switch (sectionId) {
    case "featureDefinition":
      return (
        hasText(workspace.featureSummary.summary) ||
        hasText(workspace.featureSummary.problem) ||
        hasList(workspace.featureSummary.goals) ||
        hasList(workspace.featureSummary.constraints) ||
        hasList(workspace.featureSummary.assumptions) ||
        hasList(workspace.featureSummary.openQuestions) ||
        hasList(workspace.discovery.responsibilities)
      );
    case "featureDesign":
      return workspace.components.some(
        (component) =>
          hasText(component.summary) ||
          hasList(component.inputs) ||
          hasList(component.outputs) ||
          component.incomingEvents.length > 0 ||
          component.internalSignals.length > 0 ||
          component.outgoingSignals.length > 0 ||
          component.states.length > 0 ||
          component.ownership.length > 0 ||
          component.failureModes.length > 0,
      ) ||
      workspace.discovery.contextEntities.some(
        (entity) => hasText(entity.name) || hasText(entity.description),
      ) ||
      workspace.discovery.contextFlows.some(
        (flow) => hasText(flow.label) || hasText(flow.description),
      ) ||
      workspace.discovery.candidateComponents.some(
        (component) => hasText(component.name) || hasText(component.responsibility),
      ) ||
      workspace.discovery.interactions.some(
        (interaction) => hasText(interaction.data) || hasText(interaction.notes),
      ) ||
      workspace.discovery.dataFlowNodes.some(
        (node) => hasText(node.name) || hasText(node.description),
      ) ||
      workspace.discovery.dataFlows.some(
        (flow) => hasText(flow.label) || hasText(flow.notes),
      ) ||
      workspace.discovery.runtimeNodes.some(
        (node) =>
          hasText(node.name) ||
          hasText(node.responsibility) ||
          hasText(node.notes),
      ) ||
      workspace.discovery.runtimeLinks.some(
        (link) => hasText(link.label) || hasText(link.notes),
      ) ||
      workspace.discovery.sequenceScenarios.some(
        (scenario) =>
          hasText(scenario.name) ||
          hasText(scenario.goal) ||
          hasText(scenario.trigger) ||
          hasText(scenario.outcome) ||
          hasText(scenario.failurePath) ||
          scenario.participants.some(
            (participant) =>
              hasText(participant.name) || hasText(participant.description),
          ) ||
          scenario.steps.some(
            (step) => hasText(step.message) || hasText(step.note),
          ),
      );
    case "implementationPlan":
      return (
        workspace.discovery.candidateTasks.some(
          (task) => hasText(task.name) || hasText(task.responsibility),
        ) ||
        hasList(workspace.implementationPlan.milestones) ||
        hasList(workspace.implementationPlan.apis) ||
        hasList(workspace.implementationPlan.tests)
      );
    default:
      return false;
  }
};
