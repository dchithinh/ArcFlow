import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Field,
  SelectWithOther,
  TextArea,
  TextInput,
} from "../../components/form/FormControls";
import {
  EventListEditor,
  ObjectListEditor,
  StateListEditor,
  StringListEditor,
} from "../../components/form/ListEditors";
import { MermaidPreview } from "../../components/preview/MermaidPreview";
import {
  createEmptyCandidateComponent,
  createEmptyCandidateTask,
  createEmptyComponent,
  createEmptyContextEntity,
  createEmptyContextFlow,
  createEmptyRuntimeLink,
  createEmptyRuntimeNode,
  createEmptySequenceParticipant,
  createEmptySequenceScenario,
  createEmptySequenceStep,
} from "../../features/workspaces/schema/defaults";
import {
  canGenerateDiscoveryDraft,
  canGenerateImplementationPlanWithAi,
  canRefineComponentWithAi,
  mergeAiComponentIntoWorkspace,
  mergeAiDiscoveryIntoWorkspace,
  mergeAiImplementationIntoWorkspace,
  type AiComponentDraft,
  type AiDiscoveryDraft,
  type AiImplementationDraft,
} from "../../features/workspaces/ai/draft";
import {
  WORKSPACE_SECTIONS,
  type CandidateTask,
  type ComponentCandidate,
  type ContextEntity,
  type ContextFlow,
  type ComponentInteraction,
  type FailureModeDefinition,
  type FeatureComponent,
  type FeatureWorkspace,
  type OwnershipDefinition,
  type RuntimeLink,
  type RuntimeNode,
  type SequenceParticipant,
  type SequenceStep,
  type WorkspaceSectionId,
} from "../../features/workspaces/schema/workspace";
import { generateWorkspaceOutputs } from "../../features/workspaces/generators";
import { isWorkspaceSectionStarted } from "../../features/workspaces/state/progress";

const SectionInputLabel = ({ children }: { children: string }) => (
  <span className="block text-[9px] font-medium uppercase tracking-[0.06em] text-slate/70">
    {children}
  </span>
);

const INTERACTION_MECHANISM_OPTIONS = [
  "queue",
  "event",
  "notification",
  "callback",
  "shared_memory",
  "direct_call",
  "other",
] as const;

const RUNTIME_NODE_TYPE_OPTIONS = [
  "mcu",
  "core",
  "task",
  "thread",
  "isr",
  "timer",
  "queue",
  "mutex",
  "peripheral",
  "device",
  "service",
  "store",
  "other",
] as const;

const RUNTIME_BOUNDARY_HOST_OPTIONS = [
  "mcu",
  "core",
  "device",
  "peripheral",
  "service",
  "other",
] as const;

const RUNTIME_LINK_TYPE_OPTIONS = [
  "interrupt",
  "queue",
  "notification",
  "call",
  "shared_memory",
  "driver",
  "timer",
  "mutex",
  "data",
  "other",
] as const;

const CONTEXT_ENTITY_TYPE_OPTIONS = [
  "user",
  "device",
  "system",
  "service",
  "timer",
  "sensor",
  "actuator",
  "other",
] as const;

const StaticContextBlock = ({
  label,
  value,
  emptyText,
}: {
  label: string;
  value: string;
  emptyText: string;
}) => (
  <div className="space-y-1.5">
    <SectionInputLabel>{label}</SectionInputLabel>
    <div className="text-sm text-ink">{value.trim() || <span className="text-slate">{emptyText}</span>}</div>
  </div>
);

const requirementsToText = (requirements: string[]): string =>
  requirements
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");

const stripRequirementPrefix = (value: string): string =>
  value.replace(/^REQ-\d+\s*:\s*/i, "").trim();

const appendUniqueOption = (
  options: string[],
  value: string,
  reservedOptions: readonly string[] = [],
): string[] => {
  const nextValue = value.trim();
  if (!nextValue) {
    return options;
  }

  const normalized = nextValue.toLowerCase();
  if (reservedOptions.some((option) => option.trim().toLowerCase() === normalized)) {
    return options;
  }
  if (options.some((option) => option.trim().toLowerCase() === normalized)) {
    return options;
  }

  return [...options, nextValue];
};

const removeOptionValue = (options: string[], value: string): string[] =>
  options.filter((option) => option.trim().toLowerCase() !== value.trim().toLowerCase());

const headingAliases = {
  summary: new Set(["summary", "feature summary"]),
  requirement: new Set([
    "requirement",
    "requirements",
    "feature requirement",
    "feature requirements",
    "overview",
    "description",
  ]),
  constraints: new Set(["constraints", "constraint"]),
  responsibilities: new Set([
    "responsibilities",
    "responsibility",
    "feature responsibilities",
    "feature responsibility",
  ]),
  goals: new Set(["goals", "goal"]),
  assumptions: new Set(["assumptions", "assumption"]),
  openQuestions: new Set(["open questions", "questions", "question"]),
};

const normalizeHeading = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[*_`:#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseMarkdownSections = (markdown: string): {
  title: string;
  sections: Map<string, string[]>;
} => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections = new Map<string, string[]>();
  let title = "";
  let currentHeading = "requirement";

  for (const line of lines) {
    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading = normalizeHeading(headingMatch[2]);
      if (level === 1 && !title && heading) {
        title = headingMatch[2].trim();
      }

      currentHeading = heading || currentHeading;
      if (!sections.has(currentHeading)) {
        sections.set(currentHeading, []);
      }
      continue;
    }

    const bucket = sections.get(currentHeading) ?? [];
    bucket.push(line);
    sections.set(currentHeading, bucket);
  }

  return { title, sections };
};

const resolveSectionBlock = (
  sections: Map<string, string[]>,
  aliases: Set<string>,
): string[] => {
  for (const [heading, lines] of sections.entries()) {
    if (aliases.has(heading)) {
      return lines;
    }
  }

  return [];
};

const toBulletList = (lines: string[]): string[] => {
  const bullets = lines
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^([-*+]|\d+\.)\s+/, "").trim())
    .filter(Boolean);

  if (bullets.length > 0) {
    return bullets;
  }

  return lines
    .join("\n")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const toParagraph = (lines: string[]): string =>
  lines
    .join("\n")
    .trim()
    .replace(/\n{3,}/g, "\n\n");

const inferTitleFromFileName = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

type FeatureWorkspacePageProps = {
  workspace: FeatureWorkspace;
  onBack: () => void;
  onChange: (updater: (current: FeatureWorkspace) => FeatureWorkspace) => void;
  onExport: (markdown: string, fileName: string) => void;
};

type AiStage = "discovery" | "component" | "implementation";

type AiStageSuccessResponse = {
  draft: AiDiscoveryDraft | AiComponentDraft | AiImplementationDraft;
  model: string;
  provider: string;
  stage: AiStage;
  durationMs: number;
};

type ComponentDetailMode = "container" | "state";

export const FeatureWorkspacePage = ({
  workspace,
  onBack,
  onChange,
  onExport,
}: FeatureWorkspacePageProps) => {
  const [activeSection, setActiveSection] = useState<WorkspaceSectionId>("featureDefinition");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    workspace.components[0]?.id ?? null,
  );
  const [selectedContextEntityId, setSelectedContextEntityId] = useState<string | null>(
    workspace.discovery.contextEntities[0]?.id ?? null,
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    workspace.discovery.sequenceScenarios[0]?.id ?? null,
  );
  const [selectedInteractionIndex, setSelectedInteractionIndex] = useState<number | null>(
    workspace.discovery.interactions.length > 0 ? 0 : null,
  );
  const [selectedRuntimeNodeId, setSelectedRuntimeNodeId] = useState<string | null>(
    workspace.discovery.runtimeNodes[0]?.id ?? null,
  );
  const [selectedRuntimeLinkId, setSelectedRuntimeLinkId] = useState<string | null>(
    workspace.discovery.runtimeLinks[0]?.id ?? null,
  );
  const [componentDetailOpen, setComponentDetailOpen] = useState(false);
  const [componentDetailMode, setComponentDetailMode] = useState<ComponentDetailMode>("container");
  const [contextDetailOpen, setContextDetailOpen] = useState(false);
  const [scenarioDetailOpen, setScenarioDetailOpen] = useState(false);
  const [interactionDetailOpen, setInteractionDetailOpen] = useState(false);
  const [runtimeNodeDetailOpen, setRuntimeNodeDetailOpen] = useState(false);
  const [runtimeLinkDetailOpen, setRuntimeLinkDetailOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [aiMessage, setAiMessage] = useState("");
  const [aiStage, setAiStage] = useState<AiStage>("discovery");
  const [aiElapsedSeconds, setAiElapsedSeconds] = useState(0);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const outputs = useMemo(
    () =>
      generateWorkspaceOutputs(
        workspace,
        selectedComponentId ?? undefined,
        selectedContextEntityId ?? undefined,
        selectedScenarioId ?? undefined,
        selectedRuntimeNodeId ?? undefined,
        selectedRuntimeLinkId ?? undefined,
      ),
    [
      selectedComponentId,
      selectedContextEntityId,
      selectedRuntimeLinkId,
      selectedRuntimeNodeId,
      selectedScenarioId,
      workspace,
    ],
  );

  const startedSections = WORKSPACE_SECTIONS.filter((section) =>
    isWorkspaceSectionStarted(workspace, section.id),
  ).length;
  const selectedComponent =
    workspace.components.find((component) => component.id === selectedComponentId) ??
    workspace.components[0] ??
    null;
  const selectedCandidateComponent =
    workspace.discovery.candidateComponents.find(
      (component) => component.id === selectedComponentId,
    ) ?? null;
  const selectedScenario =
    workspace.discovery.sequenceScenarios.find((scenario) => scenario.id === selectedScenarioId) ??
    workspace.discovery.sequenceScenarios[0] ??
    null;
  const selectedContextEntity =
    workspace.discovery.contextEntities.find((entity) => entity.id === selectedContextEntityId) ??
    workspace.discovery.contextEntities[0] ??
    null;
  const selectedInteraction =
    selectedInteractionIndex !== null
      ? workspace.discovery.interactions[selectedInteractionIndex] ?? null
      : workspace.discovery.interactions[0] ?? null;
  const selectedRuntimeNode =
    workspace.discovery.runtimeNodes.find((node) => node.id === selectedRuntimeNodeId) ??
    workspace.discovery.runtimeNodes[0] ??
    null;
  const selectedRuntimeLink =
    workspace.discovery.runtimeLinks.find((link) => link.id === selectedRuntimeLinkId) ??
    workspace.discovery.runtimeLinks[0] ??
    null;

  const updateTimestamp = (next: FeatureWorkspace): FeatureWorkspace => ({
    ...next,
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    if (
      selectedComponentId &&
      workspace.components.some((component) => component.id === selectedComponentId)
    ) {
      return;
    }

    setSelectedComponentId(workspace.components[0]?.id ?? null);
  }, [selectedComponentId, workspace.components]);

  useEffect(() => {
    if (
      selectedContextEntityId &&
      workspace.discovery.contextEntities.some((entity) => entity.id === selectedContextEntityId)
    ) {
      return;
    }

    setSelectedContextEntityId(workspace.discovery.contextEntities[0]?.id ?? null);
  }, [selectedContextEntityId, workspace.discovery.contextEntities]);

  useEffect(() => {
    if (
      selectedScenarioId &&
      workspace.discovery.sequenceScenarios.some((scenario) => scenario.id === selectedScenarioId)
    ) {
      return;
    }

    setSelectedScenarioId(workspace.discovery.sequenceScenarios[0]?.id ?? null);
  }, [selectedScenarioId, workspace.discovery.sequenceScenarios]);

  useEffect(() => {
    if (
      selectedInteractionIndex !== null &&
      workspace.discovery.interactions[selectedInteractionIndex]
    ) {
      return;
    }

    setSelectedInteractionIndex(
      workspace.discovery.interactions.length > 0 ? 0 : null,
    );
  }, [selectedInteractionIndex, workspace.discovery.interactions]);

  useEffect(() => {
    if (
      selectedRuntimeNodeId &&
      workspace.discovery.runtimeNodes.some((node) => node.id === selectedRuntimeNodeId)
    ) {
      return;
    }

    setSelectedRuntimeNodeId(workspace.discovery.runtimeNodes[0]?.id ?? null);
  }, [selectedRuntimeNodeId, workspace.discovery.runtimeNodes]);

  useEffect(() => {
    if (
      selectedRuntimeLinkId &&
      workspace.discovery.runtimeLinks.some((link) => link.id === selectedRuntimeLinkId)
    ) {
      return;
    }

    setSelectedRuntimeLinkId(workspace.discovery.runtimeLinks[0]?.id ?? null);
  }, [selectedRuntimeLinkId, workspace.discovery.runtimeLinks]);

  useEffect(() => {
    if (aiStatus !== "loading") {
      setAiElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const handle = window.setInterval(() => {
      setAiElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(handle);
  }, [aiStatus]);

  useEffect(() => {
    if (!selectedComponent && componentDetailOpen) {
      setComponentDetailOpen(false);
    }
  }, [componentDetailOpen, selectedComponent]);

  useEffect(() => {
    if (!selectedContextEntity && contextDetailOpen) {
      setContextDetailOpen(false);
    }
  }, [contextDetailOpen, selectedContextEntity]);

  useEffect(() => {
    if (!selectedScenario && scenarioDetailOpen) {
      setScenarioDetailOpen(false);
    }
  }, [scenarioDetailOpen, selectedScenario]);

  useEffect(() => {
    if (!selectedInteraction && interactionDetailOpen) {
      setInteractionDetailOpen(false);
    }
  }, [interactionDetailOpen, selectedInteraction]);

  useEffect(() => {
    if (!selectedRuntimeNode && runtimeNodeDetailOpen) {
      setRuntimeNodeDetailOpen(false);
    }
  }, [runtimeNodeDetailOpen, selectedRuntimeNode]);

  useEffect(() => {
    if (!selectedRuntimeLink && runtimeLinkDetailOpen) {
      setRuntimeLinkDetailOpen(false);
    }
  }, [runtimeLinkDetailOpen, selectedRuntimeLink]);

  const canGenerateAiDraft = canGenerateDiscoveryDraft(workspace);

  const namedInteractions = workspace.discovery.interactions.map((interaction) => ({
    fromComponentName:
      workspace.discovery.candidateComponents.find(
        (candidate) => candidate.id === interaction.fromComponentId,
      )?.name || "",
    toComponentName:
      workspace.discovery.candidateComponents.find(
        (candidate) => candidate.id === interaction.toComponentId,
      )?.name || "",
    mechanism: interaction.mechanism,
    data: interaction.data,
    notes: interaction.notes ?? "",
  }));

  const requestAiStage = async (
    stage: AiStage,
    payload: Record<string, unknown>,
  ): Promise<AiStageSuccessResponse> => {
    const response = await fetch("/api/ai/workspace-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as AiStageSuccessResponse | { error?: string };
    if (!response.ok || !("draft" in data)) {
      const errorMessage =
        "error" in data && typeof data.error === "string"
          ? data.error
          : `AI ${stage} draft generation failed.`;
      throw new Error(errorMessage);
    }

    return data;
  };

  const startAiRequest = (stage: AiStage, message: string) => {
    setAiStage(stage);
    setAiStatus("loading");
    setAiMessage(message);
  };

  const completeAiRequest = (
    message: string,
  ) => {
    setAiStatus("success");
    setAiMessage(message);
  };

  const importRequirementFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const { title, sections } = parseMarkdownSections(content);
      const summaryBlock = resolveSectionBlock(sections, headingAliases.summary);
      const requirementBlock = resolveSectionBlock(sections, headingAliases.requirement);
      const constraintsBlock = resolveSectionBlock(sections, headingAliases.constraints);
      const responsibilitiesBlock = resolveSectionBlock(
        sections,
        headingAliases.responsibilities,
      );
      const goalsBlock = resolveSectionBlock(sections, headingAliases.goals);
      const assumptionsBlock = resolveSectionBlock(sections, headingAliases.assumptions);
      const openQuestionsBlock = resolveSectionBlock(
        sections,
        headingAliases.openQuestions,
      );

      const nextTitle = title || inferTitleFromFileName(file.name) || workspace.title;
      const nextSummary = toParagraph(summaryBlock);
      const nextRequirements = toBulletList(requirementBlock);
      const nextRequirement =
        (nextRequirements.length > 0
          ? requirementsToText(nextRequirements.map(stripRequirementPrefix))
          : "") ||
        toParagraph(requirementBlock) ||
        (sections.size === 1 ? content.trim() : workspace.requirement);
      const nextConstraints = toBulletList(constraintsBlock);
      const nextResponsibilities = toBulletList(responsibilitiesBlock);
      const nextGoals = toBulletList(goalsBlock);
      const nextAssumptions = toBulletList(assumptionsBlock);
      const nextOpenQuestions = toBulletList(openQuestionsBlock);

      onChange((current) =>
        updateTimestamp({
          ...current,
          title: nextTitle,
          requirement: nextRequirement,
          featureSummary: {
            ...current.featureSummary,
            summary: nextSummary || current.featureSummary.summary,
            goals:
              nextRequirements.length > 0
                ? nextRequirements.map(stripRequirementPrefix)
                : nextGoals.length > 0
                  ? nextGoals
                  : current.featureSummary.goals,
            constraints:
              nextConstraints.length > 0 ? nextConstraints : current.featureSummary.constraints,
            assumptions:
              nextAssumptions.length > 0 ? nextAssumptions : current.featureSummary.assumptions,
            openQuestions:
              nextOpenQuestions.length > 0
                ? nextOpenQuestions
                : current.featureSummary.openQuestions,
          },
          discovery: {
            ...current.discovery,
            responsibilities:
              nextResponsibilities.length > 0
                ? nextResponsibilities
                : current.discovery.responsibilities,
          },
        }),
      );

      setActiveSection("featureDefinition");
      setImportStatus("success");
      setImportMessage(
        `Imported ${file.name}. Review the parsed title, requirement, constraints, and responsibilities before generating the AI draft.`,
      );
    } catch (error) {
      setImportStatus("error");
      setImportMessage(
        error instanceof Error ? error.message : "Could not import the markdown file.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const generateAiDraft = async () => {
    if (!canGenerateAiDraft || aiStatus === "loading") {
      return;
    }

    startAiRequest(
      "discovery",
      "Generating discovery draft from the current feature inputs...",
    );

    try {
      const data = await requestAiStage("discovery", {
        stage: "discovery",
        title: workspace.title,
        requirement: workspace.requirement,
        constraints: workspace.featureSummary.constraints,
        responsibilities: workspace.discovery.responsibilities,
      });

      const previousSelectedName = selectedComponent?.name.trim().toLowerCase() || "";
      const merged = updateTimestamp(
        mergeAiDiscoveryIntoWorkspace(workspace, data.draft as AiDiscoveryDraft),
      );
      const nextSelectedComponent =
        merged.components.find(
          (component) => component.name.trim().toLowerCase() === previousSelectedName,
        ) ?? merged.components[0] ?? null;

      onChange(() => merged);
      setSelectedComponentId(nextSelectedComponent?.id ?? null);
      completeAiRequest(
        `Discovery draft generated with ${data.provider}/${data.model} in ${Math.max(1, Math.round(data.durationMs / 1000))}s. Review the proposed architecture, then refine components individually.`,
      );
      if (merged.components.length > 0) {
        setActiveSection("featureDesign");
      }
    } catch (error) {
      setAiStatus("error");
      setAiMessage(
        error instanceof Error ? error.message : "AI discovery draft generation failed.",
      );
    }
  };

  const refineComponentWithAi = async (
    componentToRefine: FeatureComponent | null,
  ) => {
    if (!componentToRefine || !canRefineComponentWithAi(workspace, componentToRefine.id)) {
      return;
    }

    startAiRequest(
      "component",
      `Refining ${componentToRefine.name || "selected component"} with AI...`,
    );

    try {
      const selectedCandidate =
        workspace.discovery.candidateComponents.find(
          (candidate) => candidate.id === componentToRefine.id,
        ) ?? null;
      const data = await requestAiStage("component", {
        stage: "component",
        title: workspace.title,
        requirement: workspace.requirement,
        constraints: workspace.featureSummary.constraints,
        responsibilities: workspace.discovery.responsibilities,
        selectedComponentName: componentToRefine.name,
        selectedComponentResponsibility:
          selectedCandidate?.responsibility || componentToRefine.summary,
        candidateComponents: workspace.discovery.candidateComponents,
        interactions: namedInteractions,
        systemRisks: workspace.discovery.systemRisks,
      });

      const merged = updateTimestamp(
        mergeAiComponentIntoWorkspace(
          workspace,
          componentToRefine.id,
          data.draft as AiComponentDraft,
        ),
      );
      onChange(() => merged);
      completeAiRequest(
        `Component draft for ${componentToRefine.name || "selected component"} generated with ${data.provider}/${data.model} in ${Math.max(1, Math.round(data.durationMs / 1000))}s.`,
      );
    } catch (error) {
      setAiStatus("error");
      setAiMessage(
        error instanceof Error ? error.message : "AI component refinement failed.",
      );
    }
  };

  const generateImplementationPlanWithAi = async () => {
    if (!canGenerateImplementationPlanWithAi(workspace)) {
      return;
    }

    startAiRequest("implementation", "Generating implementation milestones, APIs, and tests...");

    try {
      const data = await requestAiStage("implementation", {
        stage: "implementation",
        title: workspace.title,
        requirement: workspace.requirement,
        constraints: workspace.featureSummary.constraints,
        responsibilities: workspace.discovery.responsibilities,
        candidateComponents: workspace.discovery.candidateComponents,
        interactions: namedInteractions,
        candidateTasks: workspace.discovery.candidateTasks,
        components: workspace.components.map((component) => ({
          name: component.name,
          summary: component.summary,
        })),
      });

      const merged = updateTimestamp(
        mergeAiImplementationIntoWorkspace(
          workspace,
          data.draft as AiImplementationDraft,
        ),
      );
      onChange(() => merged);
      completeAiRequest(
        `Implementation plan generated with ${data.provider}/${data.model} in ${Math.max(1, Math.round(data.durationMs / 1000))}s.`,
      );
      setActiveSection("implementationPlan");
    } catch (error) {
      setAiStatus("error");
      setAiMessage(
        error instanceof Error ? error.message : "AI implementation plan generation failed.",
      );
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <aside className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.25em] text-copper">Workspace Flow</p>
          <Button onClick={onBack} tone="ghost">
            Back
          </Button>
        </div>
        <div className="mt-4 rounded-2xl bg-ink p-4 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-sand/80">Progress</p>
          <p className="mt-2 text-3xl font-semibold">
            {Math.round((startedSections / WORKSPACE_SECTIONS.length) * 100)}%
          </p>
          <p className="mt-1 text-sm text-white/70">
            {startedSections} of {WORKSPACE_SECTIONS.length} workflow blocks started
          </p>
        </div>
        <nav className="mt-4 space-y-2">
          {WORKSPACE_SECTIONS.map((section) => {
            const active = section.id === activeSection;
            const started = isWorkspaceSectionStarted(workspace, section.id);

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-copper bg-sand"
                    : started
                      ? "border-pine/20 bg-mist/80"
                      : "border-transparent bg-transparent hover:bg-mist/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{section.label}</span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${started ? "bg-pine" : "bg-slate/30"}`}
                  />
                </div>
                <p className="mt-1 text-xs text-slate">{section.description}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-copper/80">
                  {section.stage}
                </p>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-copper">Feature Workspace</p>
            <h2 className="mt-2 text-2xl font-semibold">{workspace.title}</h2>
            <p className="mt-1 text-sm text-slate">
              Start by discovering what components the feature needs, then refine one component at a time.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {activeSection === "featureDefinition" ? (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="hidden"
                onChange={importRequirementFile}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => importInputRef.current?.click()} tone="secondary">
                  Import Requirement File
                </Button>
              </div>
              <Field label="Feature Name">
                <TextInput
                  value={workspace.title}
                  onChange={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        title: value,
                      }),
                    )
                  }
                />
              </Field>

              <Field label="Feature Summary">
                <TextArea
                  value={workspace.featureSummary.summary}
                  onChange={(value) =>
                    onChange((current) => ({
                      ...current,
                      featureSummary: { ...current.featureSummary, summary: value },
                    }))
                  }
                />
              </Field>
            </>
          ) : (
            <div className="space-y-3 rounded-2xl border border-slate/10 bg-mist/40 px-4 py-3">
              <StaticContextBlock
                label="Feature Name"
                value={workspace.title}
                emptyText="No feature name yet."
              />
            </div>
          )}

          <WorkspaceSectionForm
            activeSection={activeSection}
            workspace={workspace}
            selectedComponent={selectedComponent}
            selectedComponentId={selectedComponentId}
            setSelectedComponentId={setSelectedComponentId}
            selectedContextEntityId={selectedContextEntityId}
            selectedScenario={selectedScenario}
            setSelectedScenarioId={setSelectedScenarioId}
            selectedInteractionIndex={selectedInteractionIndex}
            selectedRuntimeNodeId={selectedRuntimeNodeId}
            selectedRuntimeLinkId={selectedRuntimeLinkId}
            onOpenComponentDetail={(componentId, mode = "container") => {
              setSelectedComponentId(componentId);
              setComponentDetailMode(mode);
              setComponentDetailOpen(true);
            }}
            onOpenContextDetail={(entityId) => {
              setSelectedContextEntityId(entityId);
              setContextDetailOpen(true);
            }}
            onOpenScenarioDetail={(scenarioId) => {
              setSelectedScenarioId(scenarioId);
              setScenarioDetailOpen(true);
            }}
            onOpenInteractionDetail={(interactionIndex) => {
              setSelectedInteractionIndex(interactionIndex);
              setInteractionDetailOpen(true);
            }}
            onOpenRuntimeNodeDetail={(nodeId) => {
              setSelectedRuntimeNodeId(nodeId);
              setRuntimeNodeDetailOpen(true);
            }}
            onOpenRuntimeLinkDetail={(linkId) => {
              setSelectedRuntimeLinkId(linkId);
              setRuntimeLinkDetailOpen(true);
            }}
            canGenerateAiDraft={canGenerateAiDraft}
            aiStatus={aiStatus}
            aiStage={aiStage}
            aiMessage={aiMessage}
            aiElapsedSeconds={aiElapsedSeconds}
            importStatus={importStatus}
            importMessage={importMessage}
            onGenerateAiDraft={generateAiDraft}
            onRefineComponentWithAi={refineComponentWithAi}
            onGenerateImplementationPlanWithAi={generateImplementationPlanWithAi}
            onChange={(updater) => onChange((current) => updateTimestamp(updater(current)))}
          />
        </div>
      </section>

      {componentDetailOpen && selectedComponent ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Component Detail</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedComponent.name || "Unnamed component"}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this component in a focused page with more room for its states, events, ownership, failures, and debugging design.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={async () => {
                    await refineComponentWithAi(selectedComponent);
                  }}
                  tone="primary"
                  disabled={
                    !canRefineComponentWithAi(workspace, selectedComponent.id) ||
                    (aiStatus === "loading" && aiStage === "component")
                  }
                >
                  {aiStatus === "loading" && aiStage === "component"
                    ? "Refining Component..."
                    : "Refine With AI"}
                </Button>
                <Button onClick={() => setComponentDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                {componentDetailMode === "container" ? (
                  <PreviewCard
                    title="Behavioral Architecture Context"
                    action={
                      <ComponentOverlayDiagramButton
                        title="Behavioral Architecture Context"
                        chart={outputs.behavioralArchitectureDiagram}
                      />
                    }
                  >
                    <MermaidPreview
                      title={`${selectedComponent.name || "Component"} Behavioral Context`}
                      chart={outputs.behavioralArchitectureDiagram}
                      svgMode="natural"
                      className="min-h-[420px]"
                    />
                  </PreviewCard>
                ) : null}
                {componentDetailMode === "state" ? (
                  <PreviewCard
                    title="Selected Component State Diagram"
                    action={
                      <ComponentOverlayDiagramButton
                        title="Selected Component State Diagram"
                        chart={outputs.componentStateDiagram}
                      />
                    }
                  >
                    <MermaidPreview
                      title={`${selectedComponent.name || "Component"} State Diagram`}
                      chart={outputs.componentStateDiagram}
                      svgMode="natural"
                      className="min-h-[420px]"
                    />
                  </PreviewCard>
                ) : null}
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                {componentDetailMode === "state" ? (
                  <ComponentStateEditor
                    component={selectedComponent}
                    onChange={(nextComponent) =>
                      onChange((current) =>
                        updateTimestamp({
                          ...current,
                          components: current.components.map((component) =>
                            component.id === nextComponent.id ? nextComponent : component,
                          ),
                        }),
                      )
                    }
                  />
                ) : (
                  <ComponentContainerEditor
                    component={selectedComponent}
                    candidate={selectedCandidateComponent}
                    onChange={(nextComponent, nextCandidate) =>
                      onChange((current) =>
                        updateTimestamp({
                          ...current,
                          discovery: {
                            ...current.discovery,
                            candidateComponents: nextCandidate
                              ? current.discovery.candidateComponents.map((candidate) =>
                                  candidate.id === nextCandidate.id ? nextCandidate : candidate,
                                )
                              : current.discovery.candidateComponents,
                          },
                          components: current.components.map((component) =>
                            component.id === nextComponent.id ? nextComponent : component,
                          ),
                        }),
                      )
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {contextDetailOpen && selectedContextEntity ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1100px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Context Detail</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedContextEntity.name || "Unnamed context entity"}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this external entity and the boundary flows that connect it to the feature.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setContextDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Context Diagram"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Context Diagram"
                      chart={outputs.contextDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${selectedContextEntity.name || "Context"} Diagram`}
                    chart={outputs.contextDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <ContextEntityDetailEditor
                  entity={selectedContextEntity}
                  flows={workspace.discovery.contextFlows.filter(
                    (flow) => flow.entityId === selectedContextEntity.id,
                  )}
                  customKinds={workspace.discovery.customOptions.contextEntityKinds}
                  onAddCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          customOptions: {
                            ...current.discovery.customOptions,
                            contextEntityKinds: appendUniqueOption(
                              current.discovery.customOptions.contextEntityKinds,
                              value,
                              CONTEXT_ENTITY_TYPE_OPTIONS,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onRemoveCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          contextEntities: current.discovery.contextEntities.map((entity) =>
                            entity.kind === value ? { ...entity, kind: "other" } : entity,
                          ),
                          customOptions: {
                            ...current.discovery.customOptions,
                            contextEntityKinds: removeOptionValue(
                              current.discovery.customOptions.contextEntityKinds,
                              value,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onChange={(nextEntity, nextFlows) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          contextEntities: current.discovery.contextEntities.map((entity) =>
                            entity.id === nextEntity.id ? nextEntity : entity,
                          ),
                          contextFlows: [
                            ...current.discovery.contextFlows.filter(
                              (flow) => flow.entityId !== nextEntity.id,
                            ),
                            ...nextFlows,
                          ],
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {scenarioDetailOpen && selectedScenario ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Runtime Scenario</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedScenario.name || "Unnamed scenario"}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this runtime scenario in a focused page with more room for participants, ordered steps, and the generated sequence view.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setScenarioDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Selected Sequence Diagram"
                  action={
                    <ComponentOverlayDiagramButton
                      title={selectedScenario.name || "Selected Sequence Diagram"}
                      chart={outputs.sequenceDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${selectedScenario.name || "Scenario"} Sequence Diagram`}
                    chart={outputs.sequenceDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <SequenceScenarioDetailEditor
                  scenario={selectedScenario}
                  onChange={(nextScenario) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          sequenceScenarios: current.discovery.sequenceScenarios.map((scenario) =>
                            scenario.id === nextScenario.id ? nextScenario : scenario,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {interactionDetailOpen && selectedInteraction ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Interaction Detail</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {formatInteractionName(workspace, selectedInteraction)}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this interaction in a focused page with more room for its direction, mechanism, data, and notes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setInteractionDetailOpen(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Interaction / Data Flow Context"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Feature Architecture Flowchart"
                      chart={outputs.architectureFlowchart}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${formatInteractionName(workspace, selectedInteraction)} Context`}
                    chart={outputs.architectureFlowchart}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <InteractionDetailEditor
                  interaction={selectedInteraction}
                  components={workspace.discovery.candidateComponents}
                  customMechanisms={workspace.discovery.customOptions.interactionMechanisms}
                  onAddCustomMechanism={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          customOptions: {
                            ...current.discovery.customOptions,
                            interactionMechanisms: appendUniqueOption(
                              current.discovery.customOptions.interactionMechanisms,
                              value,
                              INTERACTION_MECHANISM_OPTIONS,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onRemoveCustomMechanism={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          interactions: current.discovery.interactions.map((interaction) =>
                            interaction.mechanism === value
                              ? { ...interaction, mechanism: "other" }
                              : interaction,
                          ),
                          customOptions: {
                            ...current.discovery.customOptions,
                            interactionMechanisms: removeOptionValue(
                              current.discovery.customOptions.interactionMechanisms,
                              value,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onChange={(nextInteraction) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          interactions: current.discovery.interactions.map((interaction, index) =>
                            index === selectedInteractionIndex ? nextInteraction : interaction,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {runtimeNodeDetailOpen && selectedRuntimeNode ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Runtime Node</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {selectedRuntimeNode.name || "Unnamed runtime node"}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this runtime node in a focused page with more room for execution placement and ownership notes.
                </p>
              </div>
              <Button onClick={() => setRuntimeNodeDetailOpen(false)} tone="ghost">
                Close
              </Button>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Deployment / Runtime Context"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Deployment / Runtime Diagram"
                      chart={outputs.deploymentRuntimeDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${selectedRuntimeNode.name || "Runtime Node"} Context`}
                    chart={outputs.deploymentRuntimeDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <RuntimeNodeDetailEditor
                  node={selectedRuntimeNode}
                  nodes={workspace.discovery.runtimeNodes}
                  customKinds={workspace.discovery.customOptions.runtimeNodeKinds}
                  onAddCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          customOptions: {
                            ...current.discovery.customOptions,
                            runtimeNodeKinds: appendUniqueOption(
                              current.discovery.customOptions.runtimeNodeKinds,
                              value,
                              RUNTIME_NODE_TYPE_OPTIONS,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onRemoveCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          runtimeNodes: current.discovery.runtimeNodes.map((node) =>
                            node.kind === value ? { ...node, kind: "other" } : node,
                          ),
                          customOptions: {
                            ...current.discovery.customOptions,
                            runtimeNodeKinds: removeOptionValue(
                              current.discovery.customOptions.runtimeNodeKinds,
                              value,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onChange={(nextNode) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          runtimeNodes: current.discovery.runtimeNodes.map((node) =>
                            node.id === nextNode.id ? nextNode : node,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {runtimeLinkDetailOpen && selectedRuntimeLink ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[1200px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Runtime Link</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {formatRuntimeLinkName(workspace, selectedRuntimeLink)}
                </h3>
                <p className="mt-1 text-sm text-slate">
                  Refine this runtime connection in a focused page with more room for link type, label, and scheduling notes.
                </p>
              </div>
              <Button onClick={() => setRuntimeLinkDetailOpen(false)} tone="ghost">
                Close
              </Button>
            </div>
            <div className="mt-4 grid flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-4 overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <PreviewCard
                  title="Deployment / Runtime Context"
                  action={
                    <ComponentOverlayDiagramButton
                      title="Deployment / Runtime Diagram"
                      chart={outputs.deploymentRuntimeDiagram}
                    />
                  }
                >
                  <MermaidPreview
                    title={`${formatRuntimeLinkName(workspace, selectedRuntimeLink)} Context`}
                    chart={outputs.deploymentRuntimeDiagram}
                    svgMode="natural"
                    className="min-h-[420px]"
                  />
                </PreviewCard>
              </div>
              <div className="overflow-y-auto rounded-2xl bg-mist/60 p-4">
                <RuntimeLinkDetailEditor
                  link={selectedRuntimeLink}
                  nodes={workspace.discovery.runtimeNodes}
                  customKinds={workspace.discovery.customOptions.runtimeLinkKinds}
                  onAddCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          customOptions: {
                            ...current.discovery.customOptions,
                            runtimeLinkKinds: appendUniqueOption(
                              current.discovery.customOptions.runtimeLinkKinds,
                              value,
                              RUNTIME_LINK_TYPE_OPTIONS,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onRemoveCustomKind={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          runtimeLinks: current.discovery.runtimeLinks.map((link) =>
                            link.kind === value ? { ...link, kind: "other" } : link,
                          ),
                          customOptions: {
                            ...current.discovery.customOptions,
                            runtimeLinkKinds: removeOptionValue(
                              current.discovery.customOptions.runtimeLinkKinds,
                              value,
                            ),
                          },
                        },
                      }),
                    )
                  }
                  onChange={(nextLink) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          runtimeLinks: current.discovery.runtimeLinks.map((link) =>
                            link.id === nextLink.id ? nextLink : link,
                          ),
                        },
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === "featureDefinition" ? (
        <section className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.25em] text-copper">Generated Outputs</p>
          <h2 className="mt-2 text-2xl font-semibold">Feature Workspace Markdown</h2>
          <div className="mt-5">
            <PreviewCard
              title="Feature Workspace Markdown"
              action={
                <Button onClick={() => onExport(outputs.markdown, workspace.title)}>
                  Export Markdown
                </Button>
              }
            >
              <pre className="max-h-[420px] overflow-auto rounded-2xl bg-ink p-4 text-xs text-white">
                {outputs.markdown}
              </pre>
            </PreviewCard>
          </div>
        </section>
      ) : null}

      {activeSection === "featureDesign" ? (
        <section className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.25em] text-copper">Generated Outputs</p>
          <h2 className="mt-2 text-2xl font-semibold">Live Diagrams</h2>
          <div className="mt-2 rounded-2xl bg-mist px-4 py-3 text-sm text-slate">
            {selectedComponent
              ? `Component state preview is currently focused on "${selectedComponent.name || "Selected Component"}".`
              : "No component selected yet. Add candidate components to refine the design."}
          </div>
          <div className="mt-5 space-y-5">
            <DiagramPreviewCard
              title="Context Diagram"
              chart={outputs.contextDiagram}
              previewTitle="Context Diagram"
              expandedTitle="Context Diagram"
              previewMinHeight="min-h-[360px]"
              previewMinWidth="min-w-[860px]"
              expandedMinWidth="min-w-[1300px]"
            />
            <DiagramPreviewCard
              title="Feature Architecture Flowchart"
              chart={outputs.architectureFlowchart}
              previewTitle="Architecture Flowchart"
              expandedTitle="Feature Architecture Flowchart"
              previewMinHeight="min-h-[420px]"
              previewMinWidth="min-w-[980px]"
              expandedMinWidth="min-w-[1400px]"
            />
            <DiagramPreviewCard
              title="Behavioral Architecture Diagram"
              chart={outputs.behavioralArchitectureDiagram}
              previewTitle="Behavioral Architecture Diagram"
              expandedTitle="Behavioral Architecture Diagram"
              previewMinHeight="min-h-[460px]"
              previewMinWidth="min-w-[1100px]"
              expandedMinWidth="min-w-[1600px]"
            />
            <DiagramPreviewCard
              title="Selected Component State Diagram"
              chart={outputs.componentStateDiagram}
              previewTitle="Component State Diagram"
              expandedTitle="Selected Component State Diagram"
              previewMinHeight="min-h-[360px]"
              previewMinWidth="min-w-[820px]"
              expandedMinWidth="min-w-[1200px]"
            />
            <DiagramPreviewCard
              title={selectedScenario ? `Sequence Diagram: ${selectedScenario.name || "Selected Scenario"}` : "Sequence Diagram"}
              chart={outputs.sequenceDiagram}
              previewTitle="Sequence Diagram"
              expandedTitle={selectedScenario ? `Sequence Diagram: ${selectedScenario.name || "Selected Scenario"}` : "Sequence Diagram"}
              previewMinHeight="min-h-[360px]"
              previewMinWidth="min-w-[980px]"
              expandedMinWidth="min-w-[1400px]"
            />
            <DiagramPreviewCard
              title="Deployment / Runtime Diagram"
              chart={outputs.deploymentRuntimeDiagram}
              previewTitle="Deployment / Runtime Diagram"
              expandedTitle="Deployment / Runtime Diagram"
              previewMinHeight="min-h-[380px]"
              previewMinWidth="min-w-[980px]"
              expandedMinWidth="min-w-[1400px]"
            />
          </div>
        </section>
      ) : null}

    </div>
  );
};

const ComponentOverlayDiagramButton = ({
  title,
  chart,
}: {
  title: string;
  chart: string;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Button onClick={() => setExpanded(true)} tone="secondary">
        Open Large View
      </Button>
      {expanded ? (
        <div className="fixed inset-0 z-[60] bg-ink/75 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[96vw] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Expanded Diagram</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">{title}</h3>
              </div>
              <Button onClick={() => setExpanded(false)} tone="ghost">
                Close
              </Button>
            </div>
            <div className="mt-4 flex-1 overflow-auto rounded-2xl bg-mist/60 p-3">
              <MermaidPreview
                title={`${title} Expanded`}
                chart={chart}
                svgMode="natural"
                className="min-h-full min-w-[1800px]"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const PreviewCard = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <article className="space-y-3 rounded-2xl border border-slate/10 bg-white/75 p-4">
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate">{title}</h3>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    {children}
  </article>
);

const DiagramPreviewCard = ({
  title,
  chart,
  previewTitle,
  expandedTitle,
  previewMinHeight,
  previewMinWidth,
  expandedMinWidth,
}: {
  title: string;
  chart: string;
  previewTitle: string;
  expandedTitle: string;
  previewMinHeight: string;
  previewMinWidth: string;
  expandedMinWidth: string;
}) => {
  const [viewMode, setViewMode] = useState<"fit" | "scroll">("fit");
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <PreviewCard title={title}>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setViewMode("fit")}
            tone={viewMode === "fit" ? "primary" : "secondary"}
          >
            Fit View
          </Button>
          <Button
            onClick={() => setViewMode("scroll")}
            tone={viewMode === "scroll" ? "primary" : "secondary"}
          >
            Scroll View
          </Button>
          <Button onClick={() => setExpanded(true)} tone="secondary">
            Open Large View
          </Button>
        </div>
        <div
          className={`rounded-2xl bg-white ${
            viewMode === "fit" ? "overflow-hidden" : "overflow-x-auto"
          }`}
        >
          <MermaidPreview
            title={previewTitle}
            chart={chart}
            svgMode={viewMode === "fit" ? "fit" : "natural"}
            className={
              viewMode === "fit"
                ? previewMinHeight
                : `${previewMinHeight} ${previewMinWidth}`
            }
          />
        </div>
      </PreviewCard>

      {expanded ? (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-[96vw] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-copper">Expanded Diagram</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">{expandedTitle}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setViewMode("fit")}
                  tone={viewMode === "fit" ? "primary" : "secondary"}
                >
                  Fit View
                </Button>
                <Button
                  onClick={() => setViewMode("scroll")}
                  tone={viewMode === "scroll" ? "primary" : "secondary"}
                >
                  Scroll View
                </Button>
                <Button onClick={() => setExpanded(false)} tone="ghost">
                  Close
                </Button>
              </div>
            </div>
            <div
              className={`mt-4 flex-1 rounded-2xl bg-mist/60 p-3 ${
                viewMode === "fit" ? "overflow-auto" : "overflow-x-auto overflow-y-auto"
              }`}
            >
              <MermaidPreview
                title={`${expandedTitle} Expanded`}
                chart={chart}
                svgMode={viewMode === "fit" ? "fit" : "natural"}
                className={viewMode === "fit" ? "min-h-full" : `min-h-full ${expandedMinWidth}`}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const ArchitectureViewPanel = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <section className="space-y-4 rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-sm">
    <div>
      <h3 className="text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-3xl text-sm text-slate">{description}</p>
    </div>
    {children}
  </section>
);

const getComponentNameById = (
  components: ComponentCandidate[],
  componentId: string,
): string =>
  components.find((component) => component.id === componentId)?.name || "Unnamed component";

const formatInteractionName = (
  workspace: FeatureWorkspace,
  interaction: ComponentInteraction,
): string =>
  `${getComponentNameById(workspace.discovery.candidateComponents, interaction.fromComponentId)} -> ${getComponentNameById(
    workspace.discovery.candidateComponents,
    interaction.toComponentId,
  )}`;

const getRuntimeNodeNameById = (
  nodes: RuntimeNode[],
  nodeId: string,
): string => nodes.find((node) => node.id === nodeId)?.name || "Unnamed runtime node";

const formatRuntimeLinkName = (
  workspace: FeatureWorkspace,
  link: RuntimeLink,
): string =>
  `${getRuntimeNodeNameById(workspace.discovery.runtimeNodes, link.fromNodeId)} -> ${getRuntimeNodeNameById(
    workspace.discovery.runtimeNodes,
    link.toNodeId,
  )}`;

const InteractionDetailEditor = ({
  interaction,
  components,
  customMechanisms,
  onAddCustomMechanism,
  onRemoveCustomMechanism,
  onChange,
}: {
  interaction: ComponentInteraction;
  components: ComponentCandidate[];
  customMechanisms: string[];
  onAddCustomMechanism: (value: string) => void;
  onRemoveCustomMechanism: (value: string) => void;
  onChange: (nextInteraction: ComponentInteraction) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Interaction Details"
      hint="Describe the direction, mechanism, payload, and notes for this interaction."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Interaction Name</SectionInputLabel>
          <div className="rounded-2xl bg-white px-3 py-2 text-sm text-ink">
            {`${getComponentNameById(components, interaction.fromComponentId)} -> ${getComponentNameById(
              components,
              interaction.toComponentId,
            )}`}
          </div>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>From Component</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={interaction.fromComponentId}
            onChange={(event) =>
              onChange({ ...interaction, fromComponentId: event.target.value })
            }
          >
            {components.map((component) => (
              <option key={component.id} value={component.id}>
                {component.name || "Unnamed component"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>To Component</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={interaction.toComponentId}
            onChange={(event) =>
              onChange({ ...interaction, toComponentId: event.target.value })
            }
          >
            {components.map((component) => (
              <option key={component.id} value={component.id}>
                {component.name || "Unnamed component"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Mechanism</SectionInputLabel>
          <SelectWithOther
            value={interaction.mechanism}
            onChange={(value) =>
              onChange({
                ...interaction,
                mechanism: value as ComponentInteraction["mechanism"],
              })
            }
            options={[...INTERACTION_MECHANISM_OPTIONS]}
            customOptions={customMechanisms}
            onAddCustomOption={onAddCustomMechanism}
            onRemoveCustomOption={onRemoveCustomMechanism}
            customPlaceholder="Enter custom mechanism"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Data / Signal</SectionInputLabel>
          <TextArea
            value={interaction.data}
            onChange={(value) => onChange({ ...interaction, data: value })}
            placeholder="What data, event, or signal crosses this interaction?"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Notes</SectionInputLabel>
          <TextArea
            value={interaction.notes ?? ""}
            onChange={(value) => onChange({ ...interaction, notes: value })}
            placeholder="Any delivery rules, timing, buffering, or ownership notes."
          />
        </div>
      </div>
    </Field>
  </div>
);

const RuntimeNodeDetailEditor = ({
  node,
  nodes,
  customKinds,
  onAddCustomKind,
  onRemoveCustomKind,
  onChange,
}: {
  node: RuntimeNode;
  nodes: RuntimeNode[];
  customKinds: string[];
  onAddCustomKind: (value: string) => void;
  onRemoveCustomKind: (value: string) => void;
  onChange: (nextNode: RuntimeNode) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Runtime Node Details"
      hint="Describe what this runtime node is and what it owns in execution."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Node Name</SectionInputLabel>
          <TextInput
            value={node.name}
            onChange={(value) => onChange({ ...node, name: value })}
            placeholder="Node name"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Node Type</SectionInputLabel>
          <SelectWithOther
            value={node.kind}
            onChange={(value) => onChange({ ...node, kind: value as RuntimeNode["kind"] })}
            options={[...RUNTIME_NODE_TYPE_OPTIONS]}
            customOptions={customKinds}
            onAddCustomOption={onAddCustomKind}
            onRemoveCustomOption={onRemoveCustomKind}
            customPlaceholder="Enter custom runtime node type"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Host Runtime Boundary</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={node.hostNodeId ?? ""}
            onChange={(event) => onChange({ ...node, hostNodeId: event.target.value })}
          >
            <option value="">Top-level runtime boundary</option>
            {nodes
              .filter(
                (candidate) =>
                  candidate.id !== node.id &&
                  RUNTIME_BOUNDARY_HOST_OPTIONS.includes(candidate.kind as (typeof RUNTIME_BOUNDARY_HOST_OPTIONS)[number]),
              )
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name || "Unnamed runtime boundary"}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Responsibility</SectionInputLabel>
          <TextArea
            value={node.responsibility}
            onChange={(value) => onChange({ ...node, responsibility: value })}
            placeholder="What does this runtime node do?"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Notes</SectionInputLabel>
          <TextArea
            value={node.notes ?? ""}
            onChange={(value) => onChange({ ...node, notes: value })}
            placeholder="Any execution, priority, latency, or ownership notes."
          />
        </div>
      </div>
    </Field>
  </div>
);

const RuntimeLinkDetailEditor = ({
  link,
  nodes,
  customKinds,
  onAddCustomKind,
  onRemoveCustomKind,
  onChange,
}: {
  link: RuntimeLink;
  nodes: RuntimeNode[];
  customKinds: string[];
  onAddCustomKind: (value: string) => void;
  onRemoveCustomKind: (value: string) => void;
  onChange: (nextLink: RuntimeLink) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Runtime Link Details"
      hint="Describe how these runtime nodes are connected during execution."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Link Name</SectionInputLabel>
          <div className="rounded-2xl bg-white px-3 py-2 text-sm text-ink">
            {`${getRuntimeNodeNameById(nodes, link.fromNodeId)} -> ${getRuntimeNodeNameById(
              nodes,
              link.toNodeId,
            )}`}
          </div>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>From Node</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={link.fromNodeId}
            onChange={(event) => onChange({ ...link, fromNodeId: event.target.value })}
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name || "Unnamed node"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>To Node</SectionInputLabel>
          <select
            className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
            value={link.toNodeId}
            onChange={(event) => onChange({ ...link, toNodeId: event.target.value })}
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name || "Unnamed node"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Link Type</SectionInputLabel>
          <SelectWithOther
            value={link.kind}
            onChange={(value) => onChange({ ...link, kind: value as RuntimeLink["kind"] })}
            options={[...RUNTIME_LINK_TYPE_OPTIONS]}
            customOptions={customKinds}
            onAddCustomOption={onAddCustomKind}
            onRemoveCustomOption={onRemoveCustomKind}
            customPlaceholder="Enter custom runtime link type"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Label</SectionInputLabel>
          <TextInput
            value={link.label}
            onChange={(value) => onChange({ ...link, label: value })}
            placeholder="What crosses this runtime boundary?"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Notes</SectionInputLabel>
          <TextArea
            value={link.notes ?? ""}
            onChange={(value) => onChange({ ...link, notes: value })}
            placeholder="Optional delivery, scheduling, or ownership notes."
          />
        </div>
      </div>
    </Field>
  </div>
);

const ContextEntityDetailEditor = ({
  entity,
  flows,
  customKinds,
  onAddCustomKind,
  onRemoveCustomKind,
  onChange,
}: {
  entity: ContextEntity;
  flows: ContextFlow[];
  customKinds: string[];
  onAddCustomKind: (value: string) => void;
  onRemoveCustomKind: (value: string) => void;
  onChange: (nextEntity: ContextEntity, nextFlows: ContextFlow[]) => void;
}) => {
  const updateFlow = (flowId: string, updates: Partial<ContextFlow>) => {
    onChange(
      entity,
      flows.map((flow) => (flow.id === flowId ? { ...flow, ...updates } : flow)),
    );
  };

  return (
    <div className="space-y-4">
      <Field
        label="Context Entity"
        hint="Define the outside actor, device, system, or service and the boundary flows it exchanges with this feature."
      >
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <SectionInputLabel>Entity Name</SectionInputLabel>
            <TextInput
              value={entity.name}
              onChange={(value) => onChange({ ...entity, name: value }, flows)}
              placeholder="Entity name"
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Entity Type</SectionInputLabel>
            <SelectWithOther
              value={entity.kind}
              onChange={(value) => onChange({ ...entity, kind: value as ContextEntity["kind"] }, flows)}
              options={[...CONTEXT_ENTITY_TYPE_OPTIONS]}
              customOptions={customKinds}
              onAddCustomOption={onAddCustomKind}
              onRemoveCustomOption={onRemoveCustomKind}
              customPlaceholder="Enter custom entity type"
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Description</SectionInputLabel>
            <TextArea
              value={entity.description ?? ""}
              onChange={(value) => onChange({ ...entity, description: value }, flows)}
              placeholder="How does this entity relate to the feature?"
              rows={3}
            />
          </div>
        </div>
      </Field>

      <Field
        label="Boundary Flows"
        hint="Capture each input or output that crosses the feature boundary for this entity."
      >
        <div className="space-y-4">
          {flows.length === 0 ? (
            <p className="text-sm text-slate">No boundary flows yet.</p>
          ) : (
            flows.map((flow) => (
              <div
                key={flow.id}
                className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4"
              >
                <div className="space-y-1.5">
                  <SectionInputLabel>Direction</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={flow.direction}
                    onChange={(event) =>
                      updateFlow(flow.id, {
                        direction: event.target.value as ContextFlow["direction"],
                      })
                    }
                  >
                    {["inbound", "outbound", "bidirectional"].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Flow Label</SectionInputLabel>
                  <TextInput
                    value={flow.label}
                    onChange={(value) => updateFlow(flow.id, { label: value })}
                    placeholder="What crosses the boundary?"
                  />
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Description</SectionInputLabel>
                  <TextArea
                    value={flow.description ?? ""}
                    onChange={(value) => updateFlow(flow.id, { description: value })}
                    placeholder="Optional context for this boundary flow"
                    rows={3}
                  />
                </div>
                <Button
                  onClick={() =>
                    onChange(
                      entity,
                      flows.filter((item) => item.id !== flow.id),
                    )
                  }
                  tone="danger"
                  size="compact"
                >
                  Remove Boundary Flow
                </Button>
              </div>
            ))
          )}
          <Button
            onClick={() =>
              onChange(
                entity,
                [...flows, createEmptyContextFlow(entity.id)],
              )
            }
          >
            Add Boundary Flow
          </Button>
        </div>
      </Field>
    </div>
  );
};

const SequenceScenarioDetailEditor = ({
  scenario,
  onChange,
}: {
  scenario: FeatureWorkspace["discovery"]["sequenceScenarios"][number];
  onChange: (nextScenario: FeatureWorkspace["discovery"]["sequenceScenarios"][number]) => void;
}) => {
  const updateParticipant = (
    participantId: string,
    patch: Partial<SequenceParticipant>,
  ) => {
    onChange({
      ...scenario,
      participants: scenario.participants.map((participant) =>
        participant.id === participantId ? { ...participant, ...patch } : participant,
      ),
    });
  };

  const updateStep = (stepId: string, patch: Partial<SequenceStep>) => {
    onChange({
      ...scenario,
      steps: scenario.steps.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <Field
        label="Scenario Metadata"
        hint="Define the scenario purpose, what starts it, and the expected result."
      >
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <SectionInputLabel>Scenario Name</SectionInputLabel>
            <TextInput
              value={scenario.name}
              onChange={(value) => onChange({ ...scenario, name: value })}
              placeholder="Handle a valid command packet"
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Scenario Goal</SectionInputLabel>
            <TextArea
              value={scenario.goal}
              onChange={(value) => onChange({ ...scenario, goal: value })}
              placeholder="What success looks like for this runtime flow."
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Trigger</SectionInputLabel>
            <TextArea
              value={scenario.trigger}
              onChange={(value) => onChange({ ...scenario, trigger: value })}
              placeholder="What starts this scenario?"
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Outcome</SectionInputLabel>
            <TextArea
              value={scenario.outcome}
              onChange={(value) => onChange({ ...scenario, outcome: value })}
              placeholder="What should be true when the flow completes?"
            />
          </div>
          <div className="space-y-1.5">
            <SectionInputLabel>Failure Path</SectionInputLabel>
            <TextArea
              value={scenario.failurePath ?? ""}
              onChange={(value) => onChange({ ...scenario, failurePath: value })}
              placeholder="Optional alternate or failure outcome."
            />
          </div>
        </div>
      </Field>

      <Field
        label="Participants"
        hint="List the actors, components, devices, or systems that appear in this scenario."
      >
        <div className="space-y-4">
          {scenario.participants.length === 0 ? (
            <p className="text-sm text-slate">No participants yet.</p>
          ) : (
            scenario.participants.map((participant) => (
              <div
                key={participant.id}
                className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4"
              >
                <div className="space-y-1.5">
                  <SectionInputLabel>Participant Name</SectionInputLabel>
                  <TextInput
                    value={participant.name}
                    onChange={(value) => updateParticipant(participant.id, { name: value })}
                    placeholder="Participant name"
                  />
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Participant Type</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={participant.kind}
                    onChange={(event) =>
                      updateParticipant(participant.id, {
                        kind: event.target.value as SequenceParticipant["kind"],
                      })
                    }
                  >
                    {["actor", "component", "system", "device", "service"].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Description</SectionInputLabel>
                  <TextArea
                    value={participant.description ?? ""}
                    onChange={(value) =>
                      updateParticipant(participant.id, { description: value })
                    }
                    placeholder="What role this participant plays in the scenario."
                  />
                </div>
                <Button
                  onClick={() =>
                    onChange({
                      ...scenario,
                      participants: scenario.participants.filter(
                        (item) => item.id !== participant.id,
                      ),
                      steps: scenario.steps.map((step) => ({
                        ...step,
                        fromParticipantId:
                          step.fromParticipantId === participant.id ? "" : step.fromParticipantId,
                        toParticipantId:
                          step.toParticipantId === participant.id ? "" : step.toParticipantId,
                      })),
                    })
                  }
                  tone="danger"
                  size="compact"
                >
                  Remove Participant
                </Button>
              </div>
            ))
          )}
          <Button
            onClick={() =>
              onChange({
                ...scenario,
                participants: [...scenario.participants, createEmptySequenceParticipant()],
              })
            }
          >
            Add Participant
          </Button>
        </div>
      </Field>

      <Field
        label="Ordered Steps"
        hint="Describe the step-by-step messages or events between participants."
      >
        <div className="space-y-4">
          {scenario.steps.length === 0 ? (
            <p className="text-sm text-slate">No steps yet.</p>
          ) : (
            scenario.steps.map((step) => (
              <div
                key={step.id}
                className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4"
              >
                <div className="space-y-1.5">
                  <SectionInputLabel>From</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={step.fromParticipantId}
                    onChange={(event) =>
                      updateStep(step.id, { fromParticipantId: event.target.value })
                    }
                  >
                    <option value="">Select sender</option>
                    {scenario.participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.name || "Unnamed participant"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>To</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={step.toParticipantId}
                    onChange={(event) =>
                      updateStep(step.id, { toParticipantId: event.target.value })
                    }
                  >
                    <option value="">Select receiver</option>
                    {scenario.participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.name || "Unnamed participant"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Step Type</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={step.type}
                    onChange={(event) =>
                      updateStep(step.id, {
                        type: event.target.value as SequenceStep["type"],
                      })
                    }
                  >
                    {["call", "async", "return", "event"].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Message</SectionInputLabel>
                  <TextArea
                    value={step.message}
                    onChange={(value) => updateStep(step.id, { message: value })}
                    placeholder="What is sent or performed at this step?"
                  />
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Note</SectionInputLabel>
                  <TextArea
                    value={step.note ?? ""}
                    onChange={(value) => updateStep(step.id, { note: value })}
                    placeholder="Optional note or constraint for this step."
                  />
                </div>
                <Button
                  onClick={() =>
                    onChange({
                      ...scenario,
                      steps: scenario.steps.filter((item) => item.id !== step.id),
                    })
                  }
                  tone="danger"
                  size="compact"
                >
                  Remove Step
                </Button>
              </div>
            ))
          )}
          <Button
            onClick={() => {
              const firstParticipantId = scenario.participants[0]?.id ?? "";
              const secondParticipantId =
                scenario.participants[1]?.id ?? firstParticipantId;
              onChange({
                ...scenario,
                steps: [
                  ...scenario.steps,
                  createEmptySequenceStep(firstParticipantId, secondParticipantId),
                ],
              });
            }}
            disabled={scenario.participants.length === 0}
          >
            Add Step
          </Button>
        </div>
      </Field>
    </div>
  );
};

const WorkspaceSectionForm = ({
  activeSection,
  workspace,
  selectedComponent,
  selectedComponentId,
  setSelectedComponentId,
  selectedContextEntityId,
  selectedScenario,
  setSelectedScenarioId,
  selectedInteractionIndex,
  selectedRuntimeNodeId,
  selectedRuntimeLinkId,
  onOpenComponentDetail,
  onOpenContextDetail,
  onOpenScenarioDetail,
  onOpenInteractionDetail,
  onOpenRuntimeNodeDetail,
  onOpenRuntimeLinkDetail,
  canGenerateAiDraft,
  aiStatus,
  aiStage,
  aiMessage,
  aiElapsedSeconds,
  importStatus,
  importMessage,
  onGenerateAiDraft,
  onRefineComponentWithAi,
  onGenerateImplementationPlanWithAi,
  onChange,
}: {
  activeSection: WorkspaceSectionId;
  workspace: FeatureWorkspace;
  selectedComponent: FeatureComponent | null;
  selectedComponentId: string | null;
  setSelectedComponentId: (componentId: string | null) => void;
  selectedContextEntityId: string | null;
  selectedScenario: FeatureWorkspace["discovery"]["sequenceScenarios"][number] | null;
  setSelectedScenarioId: (scenarioId: string | null) => void;
  selectedInteractionIndex: number | null;
  selectedRuntimeNodeId: string | null;
  selectedRuntimeLinkId: string | null;
  onOpenComponentDetail: (componentId: string, mode?: ComponentDetailMode) => void;
  onOpenContextDetail: (entityId: string) => void;
  onOpenScenarioDetail: (scenarioId: string) => void;
  onOpenInteractionDetail: (interactionIndex: number) => void;
  onOpenRuntimeNodeDetail: (nodeId: string) => void;
  onOpenRuntimeLinkDetail: (linkId: string) => void;
  canGenerateAiDraft: boolean;
  aiStatus: "idle" | "loading" | "success" | "error";
  aiStage: AiStage;
  aiMessage: string;
  aiElapsedSeconds: number;
  importStatus: "idle" | "success" | "error";
  importMessage: string;
  onGenerateAiDraft: () => void;
  onRefineComponentWithAi: (component: FeatureComponent | null) => Promise<void>;
  onGenerateImplementationPlanWithAi: () => void;
  onChange: (updater: (current: FeatureWorkspace) => FeatureWorkspace) => void;
}) => {
  const updateTimestamp = (next: FeatureWorkspace): FeatureWorkspace => ({
    ...next,
    updatedAt: new Date().toISOString(),
  });

  switch (activeSection) {
    case "featureDefinition":
      return (
        <div className="grid gap-4">
          <StringListEditor
            label="Feature Requirements"
            hint="List the individual feature requirements as numbered requirement statements, for example REQ-1, REQ-2, and REQ-3."
            items={workspace.featureSummary.goals}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                requirement: requirementsToText(items),
                featureSummary: { ...current.featureSummary, goals: items },
              }))
            }
            placeholder="REQ-1: Requirement statement"
            getItemLabel={(index) => `REQ-${index + 1}`}
          />
          <StringListEditor
            label="Feature Responsibilities"
            hint="Responsibilities are the jobs the system must do to achieve each REQ-x. They help you discover component boundaries."
            items={workspace.discovery.responsibilities}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                discovery: { ...current.discovery, responsibilities: items },
              }))
            }
            placeholder="Responsibility"
          />
          <StringListEditor
            label="Constraints"
            items={workspace.featureSummary.constraints}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                featureSummary: { ...current.featureSummary, constraints: items },
              }))
            }
            placeholder="Constraint"
          />
          <StringListEditor
            label="Assumptions"
            items={workspace.featureSummary.assumptions}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                featureSummary: { ...current.featureSummary, assumptions: items },
              }))
            }
            placeholder="Assumption"
          />
          <StringListEditor
            label="Open Questions"
            items={workspace.featureSummary.openQuestions}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                featureSummary: { ...current.featureSummary, openQuestions: items },
              }))
            }
            placeholder="Question"
          />
          <div className="space-y-3 rounded-2xl border border-slate/10 bg-mist/50 px-4 py-4 text-sm text-slate">
            <p className="font-medium text-ink">Generate Discovery Draft</p>
            <p>
              This creates a first-pass architecture draft from the current feature definition. It will propose candidate components, component interactions, and implementation task ideas for you to review and edit.
            </p>
            {importMessage ? (
              <p
                className={`text-xs ${
                  importStatus === "error" ? "text-red-700" : "text-pine"
                }`}
              >
                {importMessage}
              </p>
            ) : null}
            <p
              className={`text-xs ${
                aiStatus === "error"
                  ? "text-red-700"
                  : aiStatus === "success"
                    ? "text-pine"
                    : "text-slate"
              }`}
            >
              {aiMessage ||
                (canGenerateAiDraft
                  ? "Ready to generate the discovery draft from the current inputs."
                  : "Add the required inputs to enable AI drafting.")}
              {aiStatus === "loading" ? ` ${aiElapsedSeconds}s elapsed.` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={onGenerateAiDraft}
                tone="primary"
                disabled={!canGenerateAiDraft || aiStatus === "loading"}
              >
                {aiStatus === "loading" && aiStage === "discovery"
                  ? "Generating Discovery Draft..."
                  : "Generate Discovery Draft"}
              </Button>
            </div>
          </div>
        </div>
      );
    case "featureDesign":
      return (
        <div className="space-y-5">
          <ArchitectureViewPanel
            title="Functional / Feature Breakdown"
            description="Explains what the feature must do through its summary, requirements, and responsibilities."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Field
                label="Feature Requirements"
                hint="These come from the Feature Definition tab and define what the feature must achieve."
              >
                <div className="rounded-2xl bg-mist/60 p-4 text-sm text-ink">
                  {workspace.featureSummary.goals.length > 0 ? (
                    <ul className="space-y-2">
                      {workspace.featureSummary.goals.map((goal, index) => (
                        <li key={`${goal}-${index}`}>
                          <span className="font-medium text-copper">REQ-{index + 1}</span>
                          <span className="ml-2">{goal}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate">No feature requirements documented yet.</p>
                  )}
                </div>
              </Field>
              <Field
                label="Feature Responsibilities"
                hint="Responsibilities define the jobs the feature must own and usually drive component boundaries."
              >
                <div className="rounded-2xl bg-mist/60 p-4 text-sm text-ink">
                  {workspace.discovery.responsibilities.length > 0 ? (
                    <ul className="space-y-2">
                      {workspace.discovery.responsibilities.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate">No responsibilities documented yet.</p>
                  )}
                </div>
              </Field>
            </div>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Context Diagram"
            description="Shows the system boundary, external actors, and what crosses into or out of the feature."
          >
            <Field
              label="Context Entities"
              hint="This view shows the external entities around the feature. Click one to open its detail popup and edit its boundary flows there."
            >
              <div className="space-y-4">
                {workspace.discovery.contextEntities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                    No context entities yet. Add one to define something outside the feature boundary, then click it to refine its details.
                  </div>
                ) : (
                  workspace.discovery.contextEntities.map((entity, index) => {
                    const flowCount = workspace.discovery.contextFlows.filter(
                      (flow) => flow.entityId === entity.id,
                    ).length;
                    return (
                      <div
                        key={entity.id}
                        className={`rounded-2xl border px-4 py-3 ${
                          selectedContextEntityId === entity.id ? "border-copper bg-sand" : "border-slate/10 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenContextDetail(entity.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block font-semibold">
                              {entity.name || "Unnamed entity"}
                            </span>
                            <p className="mt-1 text-sm text-slate">
                              {entity.kind}
                              {entity.description ? ` | ${entity.description}` : ""}
                            </p>
                            <p className="mt-2 text-xs text-slate/80">
                              {flowCount} boundary flow{flowCount === 1 ? "" : "s"}
                            </p>
                          </button>
                          <Button
                            onClick={() =>
                              onChange((current) => ({
                                ...current,
                                discovery: {
                                  ...current.discovery,
                                  contextEntities: current.discovery.contextEntities.filter(
                                    (_, currentIndex) => currentIndex !== index,
                                  ),
                                  contextFlows: current.discovery.contextFlows.filter(
                                    (flow) => flow.entityId !== entity.id,
                                  ),
                                },
                              }))
                            }
                            tone="danger"
                            size="compact"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
                <Button
                  onClick={() => {
                    const entity = createEmptyContextEntity();
                    onChange((current) => ({
                      ...current,
                      discovery: {
                        ...current.discovery,
                        contextEntities: [...current.discovery.contextEntities, entity],
                      },
                    }));
                    onOpenContextDetail(entity.id);
                  }}
                >
                  Add Context Entity
                </Button>
              </div>
            </Field>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Component / Container Diagram"
            description="Identifies the major internal building blocks and the responsibility of each one."
          >
            <Field
              label="Candidate Components"
              hint="This view shows the main component boxes for the feature. Click a component to open its detail popup and refine it there."
            >
              <div className="space-y-4">
                {workspace.discovery.candidateComponents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                    No components yet. Add one to define a feature building block, then click it to refine the detail view.
                  </div>
                ) : (
                  workspace.discovery.candidateComponents.map((candidate, index) => (
                    <div
                      key={candidate.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        selectedComponentId === candidate.id ? "border-copper bg-sand" : "border-slate/10 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenComponentDetail(candidate.id, "container")}
                            className="min-w-0 flex-1 text-left"
                          >
                          <span className="block font-semibold">
                            {candidate.name || "Unnamed component"}
                          </span>
                          <p className="mt-1 text-sm text-slate">
                            {candidate.responsibility || "No responsibility documented yet."}
                          </p>
                          {candidate.rationale ? (
                            <p className="mt-2 text-xs text-slate/80">{candidate.rationale}</p>
                          ) : null}
                        </button>
                        <Button
                          onClick={() => {
                            const fallbackId =
                              workspace.discovery.candidateComponents[index + 1]?.id ??
                              workspace.discovery.candidateComponents[index - 1]?.id ??
                              null;
                            setSelectedComponentId(
                              selectedComponentId === candidate.id ? fallbackId : selectedComponentId,
                            );
                            onChange((current) => ({
                              ...current,
                              discovery: {
                                ...current.discovery,
                                candidateComponents: current.discovery.candidateComponents.filter(
                                  (item) => item.id !== candidate.id,
                                ),
                                interactions: current.discovery.interactions.filter(
                                  (interaction) =>
                                    interaction.fromComponentId !== candidate.id &&
                                    interaction.toComponentId !== candidate.id,
                                ),
                              },
                              components: current.components.filter((component) => component.id !== candidate.id),
                            }));
                          }}
                          tone="danger"
                          size="compact"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <Button
                  onClick={() => {
                    const candidate = createEmptyCandidateComponent();
                    setSelectedComponentId(candidate.id);
                    onChange((current) => ({
                      ...current,
                      discovery: {
                        ...current.discovery,
                        candidateComponents: [...current.discovery.candidateComponents, candidate],
                      },
                      components: [...current.components, createEmptyComponent(candidate)],
                    }));
                    onOpenComponentDetail(candidate.id);
                  }}
                >
                  Add Candidate Component
                </Button>
              </div>
            </Field>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Interaction / Data Flow Diagram"
            description="Shows how components communicate and what data, events, or signals move between them."
          >
            <Field
              label="Component Interactions"
              hint="Describe how the candidate components interact before refining their internal state."
            >
              <div className="space-y-4">
                {workspace.discovery.interactions.map((interaction, index) => (
                  <div
                    key={`${interaction.fromComponentId}-${interaction.toComponentId}-${index}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      selectedInteractionIndex === index ? "border-copper bg-sand" : "border-slate/10 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenInteractionDetail(index)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block font-semibold">
                          {formatInteractionName(workspace, interaction)}
                        </span>
                        <p className="mt-1 text-sm text-slate">
                          {interaction.mechanism}
                          {interaction.data ? ` | ${interaction.data}` : ""}
                        </p>
                      </button>
                      <Button
                        onClick={() =>
                          onChange((current) => ({
                            ...current,
                            discovery: {
                              ...current.discovery,
                              interactions: current.discovery.interactions.filter(
                                (_, currentIndex) => currentIndex !== index,
                              ),
                            },
                          }))
                        }
                        tone="danger"
                        size="compact"
                      >
                        Remove Interaction
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  onClick={() => {
                    if (workspace.discovery.candidateComponents.length < 2) {
                      return;
                    }
                    const first = workspace.discovery.candidateComponents[0];
                    const second = workspace.discovery.candidateComponents[1];
                    onChange((current) => ({
                      ...current,
                      discovery: {
                        ...current.discovery,
                        interactions: [
                          ...current.discovery.interactions,
                          {
                            fromComponentId: first.id,
                            toComponentId: second.id,
                            mechanism: "queue",
                            data: "",
                            notes: "",
                          },
                        ],
                      },
                    }));
                    onOpenInteractionDetail(workspace.discovery.interactions.length);
                  }}
                >
                  Add Interaction
                </Button>
              </div>
            </Field>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="State Diagram"
            description="Captures the behavior of important components over time, including their internal states and transitions."
          >
            <Field
              label="Component Details"
              hint="Each feature workspace can hold multiple components. Refine one component at a time."
            >
              <div className="space-y-3">
                {workspace.components.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                    No components yet. Add candidate components first, then refine one here.
                  </div>
                ) : (
                  workspace.components.map((component) => {
                    const active = component.id === selectedComponent?.id;
                    return (
                      <div
                        key={component.id}
                        className={`rounded-2xl border px-4 py-3 ${
                          active ? "border-copper bg-sand" : "border-slate/10 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => onOpenComponentDetail(component.id, "state")}
                              className="min-w-0 flex-1 text-left"
                            >
                            <span className="block font-semibold">
                              {component.name || "Unnamed component"}
                            </span>
                            <p className="mt-1 text-sm text-slate">
                              {component.summary || "No component summary yet."}
                            </p>
                          </button>
                          <div className="group relative shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                setSelectedComponentId(component.id);
                                await onRefineComponentWithAi(component);
                              }}
                              disabled={
                                !canRefineComponentWithAi(workspace, component.id) ||
                                (aiStatus === "loading" && aiStage === "component")
                              }
                              className="rounded-xl border border-copper/30 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-copper transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {aiStatus === "loading" &&
                              aiStage === "component" &&
                              selectedComponentId === component.id
                                ? "refining"
                                : "refine"}
                            </button>
                            <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden w-56 rounded-xl bg-ink px-3 py-2 text-[11px] leading-5 text-white shadow-lg group-hover:block">
                              Use AI to refine this component’s internal design, including inputs, outputs, events, states, failures, and debugging hooks.
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Field>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Sequence Diagram"
            description="Shows how one scenario unfolds step by step across components over time."
          >
            <Field
              label="Runtime Scenarios"
              hint="Capture one scenario at a time so the sequence diagram can show who participates and what order messages occur."
            >
              <div className="space-y-3">
                {workspace.discovery.sequenceScenarios.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                    No scenarios yet. Add one to describe a concrete runtime flow such as command handling, startup, or error recovery.
                  </div>
                ) : (
                  workspace.discovery.sequenceScenarios.map((scenario) => {
                    const active = scenario.id === selectedScenario?.id;
                    return (
                      <div
                        key={scenario.id}
                        className={`rounded-2xl border px-4 py-3 ${
                          active ? "border-copper bg-sand" : "border-slate/10 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenScenarioDetail(scenario.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block font-semibold">
                              {scenario.name || "Unnamed scenario"}
                            </span>
                            <p className="mt-1 text-sm text-slate">
                              {scenario.trigger || "No trigger documented yet."}
                            </p>
                          </button>
                          <Button
                            onClick={() =>
                              onChange((current) =>
                                updateTimestamp({
                                  ...current,
                                  discovery: {
                                    ...current.discovery,
                                    sequenceScenarios: current.discovery.sequenceScenarios.filter(
                                      (item) => item.id !== scenario.id,
                                    ),
                                  },
                                }),
                              )
                            }
                            tone="danger"
                            size="compact"
                          >
                            Remove Scenario
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
                <Button
                  onClick={() => {
                    const nextScenario = createEmptySequenceScenario();
                    setSelectedScenarioId(nextScenario.id);
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          sequenceScenarios: [
                            ...current.discovery.sequenceScenarios,
                            nextScenario,
                          ],
                        },
                      }),
                    );
                  }}
                >
                  Add Scenario
                </Button>
              </div>
            </Field>
          </ArchitectureViewPanel>

          <ArchitectureViewPanel
            title="Deployment / Runtime Diagram"
            description="Shows where execution runs: tasks, threads, cores, MCUs, devices, and other runtime boundaries."
          >
            <div className="space-y-4">
              <Field
                label="Runtime Nodes"
                hint="Model the execution and hardware/runtime nodes that participate in this feature."
              >
                <div className="space-y-3">
                  {workspace.discovery.runtimeNodes.map((node, index) => (
                    <div
                      key={node.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        selectedRuntimeNodeId === node.id
                          ? "border-copper bg-sand"
                          : "border-slate/10 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenRuntimeNodeDetail(node.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block font-semibold">
                            {node.name || "Unnamed runtime node"}
                          </span>
                          <p className="mt-1 text-sm text-slate">
                            {node.kind}
                            {node.responsibility ? ` | ${node.responsibility}` : ""}
                          </p>
                          {node.hostNodeId ? (
                            <p className="mt-1 text-sm text-slate/85">
                              Inside{" "}
                              {getRuntimeNodeNameById(
                                workspace.discovery.runtimeNodes,
                                node.hostNodeId,
                              )}
                            </p>
                          ) : null}
                        </button>
                        <Button
                          onClick={() =>
                            onChange((current) => ({
                              ...current,
                              discovery: {
                                ...current.discovery,
                                runtimeNodes: current.discovery.runtimeNodes
                                  .filter((_, currentIndex) => currentIndex !== index)
                                  .map((candidateNode) =>
                                    candidateNode.hostNodeId === node.id
                                      ? { ...candidateNode, hostNodeId: "" }
                                      : candidateNode,
                                  ),
                                runtimeLinks: current.discovery.runtimeLinks.filter(
                                  (link) =>
                                    link.fromNodeId !== node.id && link.toNodeId !== node.id,
                                ),
                              },
                            }))
                          }
                          tone="danger"
                          size="compact"
                        >
                          Remove Runtime Node
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={() => {
                      const defaultHostId =
                        workspace.discovery.runtimeNodes.find((candidate) =>
                          ["mcu", "core", "device", "peripheral", "service", "other"].includes(
                            candidate.kind,
                          ),
                        )?.id ?? "";
                      const nextNode = createEmptyRuntimeNode(defaultHostId);
                      onOpenRuntimeNodeDetail(nextNode.id);
                      onChange((current) => {
                        return {
                          ...current,
                          discovery: {
                            ...current.discovery,
                            runtimeNodes: [
                              ...current.discovery.runtimeNodes,
                              nextNode,
                            ],
                          },
                        };
                      });
                    }}
                  >
                    Add Runtime Node
                  </Button>
                </div>
              </Field>

              <Field
                label="Runtime Links"
                hint="Describe how runtime nodes are connected through queues, interrupts, driver calls, timers, or shared resources."
              >
                <div className="space-y-3">
                  {workspace.discovery.runtimeNodes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-4 text-sm text-slate">
                      Add at least one runtime node before defining runtime links.
                    </div>
                  ) : null}
                  {workspace.discovery.runtimeLinks.map((link, index) => (
                    <div
                      key={link.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        selectedRuntimeLinkId === link.id
                          ? "border-copper bg-sand"
                          : "border-slate/10 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenRuntimeLinkDetail(link.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block font-semibold">
                            {formatRuntimeLinkName(workspace, link)}
                          </span>
                          <p className="mt-1 text-sm text-slate">
                            {link.kind}
                            {link.label ? ` | ${link.label}` : ""}
                          </p>
                        </button>
                        <Button
                          onClick={() =>
                            onChange((current) => ({
                              ...current,
                              discovery: {
                                ...current.discovery,
                                runtimeLinks: current.discovery.runtimeLinks.filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              },
                            }))
                          }
                          tone="danger"
                          size="compact"
                        >
                          Remove Runtime Link
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={() => {
                      const nextLink = createEmptyRuntimeLink(
                        workspace.discovery.runtimeNodes[0]?.id ?? "",
                        workspace.discovery.runtimeNodes[1]?.id ??
                          workspace.discovery.runtimeNodes[0]?.id ??
                          "",
                      );
                      onOpenRuntimeLinkDetail(nextLink.id);
                      onChange((current) => {
                        const firstNodeId = current.discovery.runtimeNodes[0]?.id ?? "";
                        const secondNodeId =
                          current.discovery.runtimeNodes[1]?.id ?? firstNodeId;
                        return {
                          ...current,
                          discovery: {
                            ...current.discovery,
                            runtimeLinks: [
                              ...current.discovery.runtimeLinks,
                              {
                                ...nextLink,
                                fromNodeId: firstNodeId,
                                toNodeId: secondNodeId,
                              },
                            ],
                          },
                        };
                      });
                    }}
                    disabled={workspace.discovery.runtimeNodes.length === 0}
                  >
                    Add Runtime Link
                  </Button>
                </div>
              </Field>
            </div>
          </ArchitectureViewPanel>
        </div>
      );
    case "implementationPlan":
      return (
        <div className="grid gap-4">
          <div className="flex justify-start">
            <Button
              onClick={onGenerateImplementationPlanWithAi}
              tone="primary"
              disabled={
                !canGenerateImplementationPlanWithAi(workspace) ||
                (aiStatus === "loading" && aiStage === "implementation")
              }
            >
              {aiStatus === "loading" && aiStage === "implementation"
                ? "Generating Plan..."
                : "Generate Implementation Plan"}
            </Button>
          </div>
          <Field
            label="Implementation Tasks"
            hint="Capture the RTOS tasks or execution units that will carry this feature in implementation."
          >
            <div className="space-y-4">
              {workspace.discovery.candidateTasks.map((task, index) => (
                <div key={task.id} className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4">
                  <ObjectListEditor<CandidateTask>
                    label="Task"
                    items={[task]}
                    onChange={(items) =>
                      onChange((current) => {
                        const next = [...current.discovery.candidateTasks];
                        next[index] = items[0];
                        return { ...current, discovery: { ...current.discovery, candidateTasks: next } };
                      })
                    }
                    template={createEmptyCandidateTask()}
                    fields={[
                      { key: "name", label: "Task Name" },
                      { key: "responsibility", label: "Responsibility" },
                      { key: "priority", label: "Priority", type: "select", options: ["high", "medium", "low"] },
                      { key: "type", label: "Task Type", type: "select", options: ["periodic", "event-driven", "background", "worker"] },
                      { key: "trigger", label: "Trigger" },
                      { key: "mayBlock", label: "May Block", type: "toggle" },
                      { key: "notes", label: "Notes", type: "textarea" },
                    ]}
                  />
                  <Button
                    onClick={() =>
                      onChange((current) => ({
                        ...current,
                        discovery: {
                          ...current.discovery,
                          candidateTasks: current.discovery.candidateTasks.filter(
                            (_, currentIndex) => currentIndex !== index,
                          ),
                        },
                      }))
                    }
                    tone="danger"
                  >
                    Remove Task
                  </Button>
                </div>
              ))}
              <Button
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    discovery: {
                      ...current.discovery,
                      candidateTasks: [...current.discovery.candidateTasks, createEmptyCandidateTask()],
                    },
                  }))
                }
              >
                Add Implementation Task
              </Button>
            </div>
          </Field>
          <StringListEditor
            label="Milestones"
            items={workspace.implementationPlan.milestones}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                implementationPlan: { ...current.implementationPlan, milestones: items },
              }))
            }
            placeholder="Milestone"
          />
          <StringListEditor
            label="APIs"
            items={workspace.implementationPlan.apis}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                implementationPlan: { ...current.implementationPlan, apis: items },
              }))
            }
            placeholder="API"
          />
          <StringListEditor
            label="Tests"
            items={workspace.implementationPlan.tests}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                implementationPlan: { ...current.implementationPlan, tests: items },
              }))
            }
            placeholder="Test"
          />
        </div>
      );
    default:
      return null;
  }
};

const ComponentContainerEditor = ({
  component,
  candidate,
  onChange,
}: {
  component: FeatureComponent;
  candidate: ComponentCandidate | null;
  onChange: (component: FeatureComponent, candidate: ComponentCandidate | null) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Component Boundary"
      hint="Focus this view on what the component is responsible for, what crosses its boundary, and its non-state design ownership."
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <SectionInputLabel>Component Name</SectionInputLabel>
          <TextInput
            value={candidate?.name ?? component.name}
            onChange={(value) =>
              onChange(
                {
                  ...component,
                  name: value,
                },
                candidate
                  ? {
                      ...candidate,
                      name: value,
                    }
                  : null,
              )
            }
            placeholder="Component name"
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Component Responsibility</SectionInputLabel>
          <TextArea
            value={candidate?.responsibility ?? component.summary}
            onChange={(value) =>
              onChange(
                {
                  ...component,
                  summary: value,
                },
                candidate
                  ? {
                      ...candidate,
                      responsibility: value,
                    }
                  : null,
              )
            }
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <SectionInputLabel>Rationale</SectionInputLabel>
          <TextArea
            value={candidate?.rationale ?? ""}
            onChange={(value) =>
              onChange(
                component,
                candidate
                  ? {
                      ...candidate,
                      rationale: value,
                    }
                  : null,
              )
            }
            placeholder="Why does this component exist?"
            rows={2}
          />
        </div>
      </div>
    </Field>
    <StringListEditor
      label="Inputs"
      items={component.inputs}
      onChange={(items) => onChange({ ...component, inputs: items }, candidate)}
      placeholder="Input"
    />
    <StringListEditor
      label="Outputs"
      items={component.outputs}
      onChange={(items) => onChange({ ...component, outputs: items }, candidate)}
      placeholder="Output"
    />
    <EventListEditor
      title="Incoming Events"
      hint="Events coming from outside the component that this component reacts to."
      items={component.incomingEvents}
      onChange={(items) => onChange({ ...component, incomingEvents: items }, candidate)}
    />
    <EventListEditor
      title="Internal Signals"
      hint="Signals generated by the component itself and used by its internal behavior."
      items={component.internalSignals}
      onChange={(items) => onChange({ ...component, internalSignals: items }, candidate)}
    />
    <EventListEditor
      title="Outgoing Signals"
      hint="Signals or events this component emits for other components to handle."
      items={component.outgoingSignals}
      onChange={(items) => onChange({ ...component, outgoingSignals: items }, candidate)}
    />
    <ObjectListEditor<OwnershipDefinition>
      label="Resource Ownership"
      items={component.ownership}
      onChange={(items) => onChange({ ...component, ownership: items }, candidate)}
      template={{ resource: "", owner: "", accessRules: "" }}
      fields={[
        { key: "resource", label: "Resource" },
        { key: "owner", label: "Owner" },
        { key: "accessRules", label: "Access Rules", type: "textarea" },
      ]}
    />
    <ObjectListEditor<FailureModeDefinition>
      label="Failure Modes"
      items={component.failureModes}
      onChange={(items) => onChange({ ...component, failureModes: items }, candidate)}
      template={{ scenario: "", impact: "", recovery: "" }}
      fields={[
        { key: "scenario", label: "Failure Scenario" },
        { key: "impact", label: "Impact", type: "textarea" },
        { key: "recovery", label: "Recovery", type: "textarea" },
      ]}
    />
    <StringListEditor
      label="Logs"
      items={component.debugging.logs}
      onChange={(items) =>
        onChange(
          {
            ...component,
            debugging: { ...component.debugging, logs: items },
          },
          candidate,
        )
      }
      placeholder="Log signal"
    />
    <StringListEditor
      label="Trace Points"
      items={component.debugging.traces}
      onChange={(items) =>
        onChange(
          {
            ...component,
            debugging: { ...component.debugging, traces: items },
          },
          candidate,
        )
      }
      placeholder="Trace point"
    />
    <StringListEditor
      label="Observability Points"
      items={component.debugging.observability}
      onChange={(items) =>
        onChange(
          {
            ...component,
            debugging: { ...component.debugging, observability: items },
          },
          candidate,
        )
      }
      placeholder="Observability point"
    />
  </div>
);

const ComponentStateEditor = ({
  component,
  onChange,
}: {
  component: FeatureComponent;
  onChange: (component: FeatureComponent) => void;
}) => (
  <div className="space-y-4">
    <Field
      label="Component States"
      hint="Focus this view on the internal states and transitions for the selected component."
    >
      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate">
        <p className="font-semibold text-ink">{component.name || "Unnamed component"}</p>
        <p className="mt-1">
          {component.summary || "No component summary yet."}
        </p>
      </div>
    </Field>
    <StateListEditor
      items={component.states}
      onChange={(items) => onChange({ ...component, states: items })}
    />
  </div>
);
