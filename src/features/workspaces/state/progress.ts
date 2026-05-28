import type { FeatureWorkspace, WorkspaceSectionId } from "../schema/workspace";

const hasText = (value: string | undefined): boolean => Boolean(value && value.trim().length > 0);
const hasList = (value: string[]): boolean => value.some(hasText);

export const isWorkspaceSectionStarted = (
  workspace: FeatureWorkspace,
  sectionId: WorkspaceSectionId,
): boolean => {
  switch (sectionId) {
    case "featureSummary":
      return hasText(workspace.featureSummary.summary) || hasText(workspace.featureSummary.problem);
    case "scope":
      return (
        hasList(workspace.featureSummary.goals) ||
        hasList(workspace.featureSummary.constraints) ||
        hasList(workspace.featureSummary.assumptions) ||
        hasList(workspace.featureSummary.openQuestions)
      );
    case "responsibilities":
      return hasList(workspace.discovery.responsibilities);
    case "candidateComponents":
      return workspace.discovery.candidateComponents.some(
        (component) => hasText(component.name) || hasText(component.responsibility),
      );
    case "interactions":
      return workspace.discovery.interactions.some(
        (interaction) => hasText(interaction.data) || hasText(interaction.notes),
      );
    case "candidateTasks":
      return workspace.discovery.candidateTasks.some(
        (task) => hasText(task.name) || hasText(task.responsibility),
      );
    case "systemRisks":
      return hasList(workspace.discovery.systemRisks);
    case "componentDetail":
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
      );
    case "implementationPlan":
      return (
        hasList(workspace.implementationPlan.milestones) ||
        hasList(workspace.implementationPlan.apis) ||
        hasList(workspace.implementationPlan.tests)
      );
    default:
      return false;
  }
};
