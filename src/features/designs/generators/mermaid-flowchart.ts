import type { FirmwareDesign } from "../schema/firmware-design";

const cleanNode = (value: string): string => value.replace(/[^a-zA-Z0-9_]/g, "_") || "Node";

export const generateMermaidFlowchart = (design: FirmwareDesign): string => {
  const interactions = design.interactions.filter((item) => item.from.trim() || item.to.trim());

  if (interactions.length === 0) {
    return `flowchart LR
    Requirement["${design.title}"] --> Checklist["Checklist-driven design"]
    Checklist --> Outputs["Generated outputs"]`;
  }

  const lines = interactions.map((item) => {
    const fromId = cleanNode(item.from || "Unknown_From");
    const toId = cleanNode(item.to || "Unknown_To");
    const label = [item.mechanism, item.data].filter(Boolean).join(": ");
    return `    ${fromId}["${item.from || "Unknown"}"] -->|${label || "interaction"}| ${toId}["${item.to || "Unknown"}"]`;
  });

  return `flowchart LR
${lines.join("\n")}`;
};
