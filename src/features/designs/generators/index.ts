import type { FirmwareDesign } from "../schema/firmware-design";
import { generateMarkdown } from "./markdown";
import { generateMermaidFlowchart } from "./mermaid-flowchart";
import { generateMermaidStateDiagram } from "./mermaid-state";
import { generateRiskReview } from "./risk-review";
import { generateRtosTaskTable } from "./rtos-table";

export type GeneratedOutputs = {
  markdown: string;
  flowchart: string;
  stateDiagram: string;
  rtosTable: string;
  riskReview: string[];
};

export const generateOutputs = (design: FirmwareDesign): GeneratedOutputs => ({
  markdown: generateMarkdown(design),
  flowchart: generateMermaidFlowchart(design),
  stateDiagram: generateMermaidStateDiagram(design),
  rtosTable: generateRtosTaskTable(design),
  riskReview: generateRiskReview(design),
});
