import type { FirmwareDesign } from "../schema/firmware-design";

const cleanState = (value: string): string => value.replace(/[^a-zA-Z0-9_]/g, "_") || "STATE";

export const generateMermaidStateDiagram = (design: FirmwareDesign): string => {
  if (design.states.length === 0) {
    return `stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> REVIEW
    REVIEW --> IMPLEMENT`;
  }

  const firstState = cleanState(design.states[0].name || "INITIAL");
  const lines: string[] = ["stateDiagram-v2", `    [*] --> ${firstState}`];

  for (const state of design.states) {
    const source = cleanState(state.name || "STATE");

    if (state.transitions.length === 0) {
      lines.push(`    ${source}: ${state.description || "No description"}`);
      continue;
    }

    for (const transition of state.transitions) {
      const target = cleanState(transition.targetState || "UNKNOWN");
      lines.push(`    ${source} --> ${target}: ${transition.event || "event"}`);
    }
  }

  return lines.join("\n");
};
