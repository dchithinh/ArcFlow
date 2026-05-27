import type { FirmwareDesign } from "../schema/firmware-design";

export const generateRiskReview = (design: FirmwareDesign): string[] => {
  const risks = [
    {
      label: "Race condition risk",
      active: design.rtos.synchronization.length === 0 && design.ownership.length > 0,
    },
    {
      label: "Queue overflow risk",
      active:
        design.interactions.some((item) => item.mechanism === "queue") &&
        !design.rtos.timingRisks.some((risk) => risk.toLowerCase().includes("queue")),
    },
    {
      label: "Priority inversion risk",
      active:
        design.rtos.tasks.some((task) => task.priority === "high" && task.mayBlock) ||
        design.rtos.timingRisks.some((risk) => risk.toLowerCase().includes("priority inversion")),
    },
    {
      label: "Shared ownership risk",
      active: design.ownership.some((item) => !item.accessRules.trim()),
    },
    {
      label: "Missing failure recovery",
      active: design.failureModes.some((item) => !item.recovery.trim()) || design.failureModes.length === 0,
    },
  ];

  return risks.map((risk) => `${risk.active ? "[ ]" : "[x]"} ${risk.label}`);
};
