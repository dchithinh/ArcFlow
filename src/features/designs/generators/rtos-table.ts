import type { FirmwareDesign } from "../schema/firmware-design";

export const generateRtosTaskTable = (design: FirmwareDesign): string => {
  const header = `| Task | Responsibility | Priority | Type | Trigger | May Block |
|---|---|---|---|---|---|`;

  if (design.rtos.tasks.length === 0) {
    return `${header}
| No task yet | - | - | - | - | - |`;
  }

  const rows = design.rtos.tasks.map(
    (task) =>
      `| ${task.name || "-"} | ${task.responsibility || "-"} | ${task.priority} | ${task.type} | ${task.trigger || "-"} | ${task.mayBlock ? "Yes" : "No"} |`,
  );

  return [header, ...rows].join("\n");
};
