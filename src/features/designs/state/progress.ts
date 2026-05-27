import type { FirmwareDesign, SectionId } from "../schema/firmware-design";

const hasText = (value: string | undefined): boolean => Boolean(value && value.trim().length > 0);
const hasList = (value: string[]): boolean => value.some(hasText);

export const isSectionStarted = (design: FirmwareDesign, sectionId: SectionId): boolean => {
  switch (sectionId) {
    case "featureSummary":
      return hasText(design.featureSummary.summary) || hasText(design.featureSummary.purpose) || hasList(design.featureSummary.constraints);
    case "systemPurpose":
      return (
        hasList(design.systemPurpose.shouldDo) ||
        hasList(design.systemPurpose.shouldNotDo) ||
        hasList(design.systemPurpose.successCriteria) ||
        hasList(design.systemPurpose.failureCriteria) ||
        hasList(design.systemPurpose.boundaries)
      );
    case "io":
      return hasList(design.io.inputs) || hasList(design.io.outputs);
    case "events":
      return design.events.some((event) => hasText(event.name) || hasText(event.source) || hasText(event.trigger));
    case "states":
      return design.states.some((state) => hasText(state.name) || hasText(state.description) || state.transitions.length > 0);
    case "responsibilities":
      return design.responsibilities.some((item) => hasText(item.responsibility) || hasText(item.module));
    case "interactions":
      return design.interactions.some((item) => hasText(item.from) || hasText(item.to) || hasText(item.data));
    case "rtos":
      return design.rtos.tasks.some((task) => hasText(task.name) || hasText(task.responsibility)) || hasList(design.rtos.synchronization) || hasList(design.rtos.timingRisks);
    case "ownership":
      return design.ownership.some((item) => hasText(item.resource) || hasText(item.owner) || hasText(item.accessRules));
    case "failureModes":
      return design.failureModes.some((item) => hasText(item.scenario) || hasText(item.impact) || hasText(item.recovery));
    case "layers":
      return hasList(design.layers.application) || hasList(design.layers.service) || hasList(design.layers.driver) || hasList(design.layers.halBsp);
    case "debugging":
      return hasList(design.debugging.logs) || hasList(design.debugging.traces) || hasList(design.debugging.observability);
    case "implementationPlan":
      return hasList(design.implementationPlan.milestones) || hasList(design.implementationPlan.apis) || hasList(design.implementationPlan.tests);
    default:
      return false;
  }
};
