import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button, Field, TextArea, TextInput } from "../../components/form/FormControls";
import {
  EventListEditor,
  ObjectListEditor,
  StateListEditor,
  StringListEditor,
} from "../../components/form/ListEditors";
import { MermaidPreview } from "../../components/preview/MermaidPreview";
import { createEmptyCandidateComponent, createEmptyCandidateTask, createEmptyComponent } from "../../features/workspaces/schema/defaults";
import {
  WORKSPACE_SECTIONS,
  type CandidateTask,
  type ComponentCandidate,
  type ComponentInteraction,
  type FailureModeDefinition,
  type FeatureComponent,
  type FeatureWorkspace,
  type OwnershipDefinition,
  type WorkspaceSectionId,
} from "../../features/workspaces/schema/workspace";
import { generateWorkspaceOutputs } from "../../features/workspaces/generators";
import { isWorkspaceSectionStarted } from "../../features/workspaces/state/progress";

const SectionInputLabel = ({ children }: { children: string }) => (
  <span className="block text-[9px] font-medium uppercase tracking-[0.06em] text-slate/70">
    {children}
  </span>
);

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

type FeatureWorkspacePageProps = {
  workspace: FeatureWorkspace;
  onBack: () => void;
  onChange: (updater: (current: FeatureWorkspace) => FeatureWorkspace) => void;
  onExport: (markdown: string, fileName: string) => void;
};

export const FeatureWorkspacePage = ({
  workspace,
  onBack,
  onChange,
  onExport,
}: FeatureWorkspacePageProps) => {
  const [activeSection, setActiveSection] = useState<WorkspaceSectionId>("featureSummary");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    workspace.components[0]?.id ?? null,
  );
  const outputs = useMemo(
    () => generateWorkspaceOutputs(workspace, selectedComponentId ?? undefined),
    [selectedComponentId, workspace],
  );

  const startedSections = WORKSPACE_SECTIONS.filter((section) =>
    isWorkspaceSectionStarted(workspace, section.id),
  ).length;
  const selectedComponent =
    workspace.components.find((component) => component.id === selectedComponentId) ??
    workspace.components[0] ??
    null;

  const updateTimestamp = (next: FeatureWorkspace): FeatureWorkspace => ({
    ...next,
    updatedAt: new Date().toISOString(),
  });

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
          <Button onClick={() => onExport(outputs.markdown, workspace.title)}>Export Markdown</Button>
        </div>

        <div className="mt-6 space-y-4">
          {activeSection === "featureSummary" ? (
            <>
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

              <Field label="Feature Requirement" hint="Paste the rough feature request before deciding the architecture.">
                <TextArea
                  value={workspace.requirement}
                  onChange={(value) =>
                    onChange((current) =>
                      updateTimestamp({
                        ...current,
                        requirement: value,
                      }),
                    )
                  }
                  rows={5}
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
              <StaticContextBlock
                label="Feature Requirement"
                value={workspace.requirement}
                emptyText="No feature requirement written yet."
              />
            </div>
          )}

          <WorkspaceSectionForm
            activeSection={activeSection}
            workspace={workspace}
            selectedComponent={selectedComponent}
            selectedComponentId={selectedComponentId}
            setSelectedComponentId={setSelectedComponentId}
            onChange={(updater) => onChange((current) => updateTimestamp(updater(current)))}
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
        <p className="text-xs uppercase tracking-[0.25em] text-copper">Generated Outputs</p>
        <h2 className="mt-2 text-2xl font-semibold">Live Preview</h2>
        <div className="mt-2 rounded-2xl bg-mist px-4 py-3 text-sm text-slate">
          {selectedComponent
            ? `Component state preview is currently focused on "${selectedComponent.name || "Selected Component"}".`
            : "No component selected yet. Add candidate components to refine the design."}
        </div>
        <div className="mt-5 space-y-5">
          <PreviewCard title="Feature Workspace Markdown">
            <pre className="max-h-[420px] overflow-auto rounded-2xl bg-ink p-4 text-xs text-white">
              {outputs.markdown}
            </pre>
          </PreviewCard>
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
          <PreviewCard title="Candidate RTOS Task Table">
            <pre className="overflow-auto rounded-2xl bg-mist p-4 text-xs text-ink">{outputs.taskTable}</pre>
          </PreviewCard>
          <PreviewCard title="Risk Review">
            <ul className="space-y-2 text-sm text-ink">
              {outputs.riskReview.map((risk) => (
                <li key={risk} className="rounded-xl bg-mist px-3 py-2">
                  {risk}
                </li>
              ))}
            </ul>
          </PreviewCard>
        </div>
      </section>

    </div>
  );
};

const PreviewCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <article className="space-y-3 rounded-2xl border border-slate/10 bg-white/75 p-4">
    <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate">{title}</h3>
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
          <div className="mx-auto flex h-full max-w-[1500px] flex-col rounded-[28px] border border-white/20 bg-white p-5 shadow-panel">
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

const syncComponentFromCandidate = (
  candidate: ComponentCandidate,
  components: FeatureComponent[],
): FeatureComponent[] => {
  const existing = components.find((component) => component.id === candidate.id);
  if (!existing) {
    return [...components, createEmptyComponent(candidate)];
  }

  return components.map((component) =>
    component.id === candidate.id
      ? {
          ...component,
          name: candidate.name || component.name,
          summary: component.summary || candidate.responsibility,
        }
      : component,
  );
};

const WorkspaceSectionForm = ({
  activeSection,
  workspace,
  selectedComponent,
  selectedComponentId,
  setSelectedComponentId,
  onChange,
}: {
  activeSection: WorkspaceSectionId;
  workspace: FeatureWorkspace;
  selectedComponent: FeatureComponent | null;
  selectedComponentId: string | null;
  setSelectedComponentId: (componentId: string | null) => void;
  onChange: (updater: (current: FeatureWorkspace) => FeatureWorkspace) => void;
}) => {
  switch (activeSection) {
    case "featureSummary":
      return (
        <div className="grid gap-4">
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
          <Field label="What Problem Does This Feature Solve?">
            <TextArea
              value={workspace.featureSummary.problem}
              onChange={(value) =>
                onChange((current) => ({
                  ...current,
                  featureSummary: { ...current.featureSummary, problem: value },
                }))
              }
            />
          </Field>
        </div>
      );
    case "scope":
      return (
        <div className="grid gap-4">
          <StringListEditor
            label="Goals"
            items={workspace.featureSummary.goals}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                featureSummary: { ...current.featureSummary, goals: items },
              }))
            }
            placeholder="Feature goal"
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
          <StringListEditor
            label="External Actors / Interfaces"
            items={workspace.discovery.externalActors}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                discovery: { ...current.discovery, externalActors: items },
              }))
            }
            placeholder="Actor or interface"
          />
        </div>
      );
    case "responsibilities":
      return (
        <StringListEditor
          label="Feature Responsibilities"
          hint="List the responsibilities before deciding the actual component boundaries."
          items={workspace.discovery.responsibilities}
          onChange={(items) =>
            onChange((current) => ({
              ...current,
              discovery: { ...current.discovery, responsibilities: items },
            }))
          }
          placeholder="Responsibility"
        />
      );
    case "candidateComponents":
      return (
        <Field
          label="Candidate Components"
          hint="These are the subsystems you believe this feature needs before detailed design."
        >
          <div className="space-y-4">
            {workspace.discovery.candidateComponents.map((candidate, index) => (
              <div key={candidate.id} className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4">
                <div className="space-y-1.5">
                  <SectionInputLabel>Component Name</SectionInputLabel>
                  <TextInput
                    value={candidate.name}
                    onChange={(value) =>
                      onChange((current) => {
                        const nextCandidates = [...current.discovery.candidateComponents];
                        const updated = { ...nextCandidates[index], name: value };
                        nextCandidates[index] = updated;
                        return {
                          ...current,
                          discovery: { ...current.discovery, candidateComponents: nextCandidates },
                          components: syncComponentFromCandidate(updated, current.components),
                        };
                      })
                    }
                    placeholder="Component name"
                  />
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Component Responsibility</SectionInputLabel>
                  <TextArea
                    value={candidate.responsibility}
                    onChange={(value) =>
                      onChange((current) => {
                        const nextCandidates = [...current.discovery.candidateComponents];
                        const updated = { ...nextCandidates[index], responsibility: value };
                        nextCandidates[index] = updated;
                        return {
                          ...current,
                          discovery: { ...current.discovery, candidateComponents: nextCandidates },
                          components: syncComponentFromCandidate(updated, current.components),
                        };
                      })
                    }
                    placeholder="What is this component responsible for?"
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <SectionInputLabel>Rationale</SectionInputLabel>
                  <TextArea
                    value={candidate.rationale ?? ""}
                    onChange={(value) =>
                      onChange((current) => {
                        const nextCandidates = [...current.discovery.candidateComponents];
                        nextCandidates[index] = { ...nextCandidates[index], rationale: value };
                        return {
                          ...current,
                          discovery: { ...current.discovery, candidateComponents: nextCandidates },
                        };
                      })
                    }
                    placeholder="Why does this component exist?"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
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
                    tone="ghost"
                  >
                    Remove Component
                  </Button>
                  <Button onClick={() => setSelectedComponentId(candidate.id)} tone="secondary">
                    Focus Detail Editor
                  </Button>
                </div>
              </div>
            ))}
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
              }}
            >
              Add Candidate Component
            </Button>
          </div>
        </Field>
      );
    case "interactions":
      return (
        <Field
          label="Component Interactions"
          hint="Describe how the candidate components interact before refining their internal state."
        >
          <div className="space-y-4">
            {workspace.discovery.interactions.map((interaction, index) => (
              <div key={`${interaction.fromComponentId}-${interaction.toComponentId}-${index}`} className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4">
                <div className="space-y-1.5">
                  <SectionInputLabel>From Component</SectionInputLabel>
                  <select
                    className="w-full rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20"
                    value={interaction.fromComponentId}
                    onChange={(event) =>
                      onChange((current) => {
                        const next = [...current.discovery.interactions];
                        next[index] = { ...next[index], fromComponentId: event.target.value };
                        return { ...current, discovery: { ...current.discovery, interactions: next } };
                      })
                    }
                  >
                    {workspace.discovery.candidateComponents.map((component) => (
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
                      onChange((current) => {
                        const next = [...current.discovery.interactions];
                        next[index] = { ...next[index], toComponentId: event.target.value };
                        return { ...current, discovery: { ...current.discovery, interactions: next } };
                      })
                    }
                  >
                    {workspace.discovery.candidateComponents.map((component) => (
                      <option key={component.id} value={component.id}>
                        {component.name || "Unnamed component"}
                      </option>
                    ))}
                  </select>
                </div>
                <ObjectListEditor<ComponentInteraction>
                  label="Interaction"
                  items={[interaction]}
                  onChange={(items) =>
                    onChange((current) => {
                      const next = [...current.discovery.interactions];
                      next[index] = items[0];
                      return { ...current, discovery: { ...current.discovery, interactions: next } };
                    })
                  }
                  template={{
                    fromComponentId: interaction.fromComponentId,
                    toComponentId: interaction.toComponentId,
                    mechanism: "queue",
                    data: "",
                    notes: "",
                  }}
                  fields={[
                    {
                      key: "mechanism",
                      label: "Mechanism",
                      type: "select",
                      options: ["queue", "event", "notification", "callback", "shared_memory", "direct_call", "other"],
                    },
                    { key: "data", label: "Data" },
                    { key: "notes", label: "Notes", type: "textarea" },
                  ]}
                />
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
                  tone="ghost"
                >
                  Remove Interaction
                </Button>
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
              }}
            >
              Add Interaction
            </Button>
          </div>
        </Field>
      );
    case "candidateTasks":
      return (
        <Field
          label="Candidate RTOS Tasks"
          hint="Propose the concurrency split at feature level before locking each component’s internal design."
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
                  tone="ghost"
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
              Add Candidate Task
            </Button>
          </div>
        </Field>
      );
    case "systemRisks":
      return (
        <StringListEditor
          label="System Risks"
          hint="Capture cross-component risks before drilling into component internals."
          items={workspace.discovery.systemRisks}
          onChange={(items) =>
            onChange((current) => ({
              ...current,
              discovery: { ...current.discovery, systemRisks: items },
            }))
          }
          placeholder="System risk"
        />
      );
    case "componentDetail":
      return (
        <div className="space-y-4">
          <Field
            label="Component Selection"
            hint="Each feature workspace can hold multiple components. Refine one component at a time."
          >
            <div className="space-y-3">
              {workspace.components.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/60 p-6 text-sm text-slate">
                  No components yet. Add candidate components first, then come back here for detailed design.
                </div>
              ) : (
                workspace.components.map((component) => {
                  const active = component.id === selectedComponent?.id;
                  return (
                    <button
                      key={component.id}
                      type="button"
                      onClick={() => setSelectedComponentId(component.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left ${
                        active ? "border-copper bg-sand" : "border-slate/10 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{component.name || "Unnamed component"}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-copper">refine</span>
                      </div>
                      <p className="mt-1 text-sm text-slate">
                        {component.summary || "No component summary yet."}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </Field>
          {selectedComponent ? (
            <ComponentDetailEditor
              component={selectedComponent}
              onChange={(nextComponent) =>
                onChange((current) => ({
                  ...current,
                  components: current.components.map((component) =>
                    component.id === nextComponent.id ? nextComponent : component,
                  ),
                }))
              }
            />
          ) : null}
        </div>
      );
    case "implementationPlan":
      return (
        <div className="grid gap-4">
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

const ComponentDetailEditor = ({
  component,
  onChange,
}: {
  component: FeatureComponent;
  onChange: (component: FeatureComponent) => void;
}) => (
  <div className="space-y-4">
    <Field label="Component Summary">
      <TextArea
        value={component.summary}
        onChange={(value) =>
          onChange({
            ...component,
            summary: value,
          })
        }
        rows={3}
      />
    </Field>
    <StringListEditor
      label="Inputs"
      items={component.inputs}
      onChange={(items) => onChange({ ...component, inputs: items })}
      placeholder="Input"
    />
    <StringListEditor
      label="Outputs"
      items={component.outputs}
      onChange={(items) => onChange({ ...component, outputs: items })}
      placeholder="Output"
    />
    <EventListEditor
      title="Incoming Events"
      hint="Events coming from outside the component that this component reacts to."
      items={component.incomingEvents}
      onChange={(items) => onChange({ ...component, incomingEvents: items })}
    />
    <EventListEditor
      title="Internal Signals"
      hint="Signals generated by the component itself and used by its internal behavior."
      items={component.internalSignals}
      onChange={(items) => onChange({ ...component, internalSignals: items })}
    />
    <EventListEditor
      title="Outgoing Signals"
      hint="Signals or events this component emits for other components to handle."
      items={component.outgoingSignals}
      onChange={(items) => onChange({ ...component, outgoingSignals: items })}
    />
    <StateListEditor items={component.states} onChange={(items) => onChange({ ...component, states: items })} />
    <ObjectListEditor<OwnershipDefinition>
      label="Resource Ownership"
      items={component.ownership}
      onChange={(items) => onChange({ ...component, ownership: items })}
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
      onChange={(items) => onChange({ ...component, failureModes: items })}
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
        onChange({
          ...component,
          debugging: { ...component.debugging, logs: items },
        })
      }
      placeholder="Log signal"
    />
    <StringListEditor
      label="Trace Points"
      items={component.debugging.traces}
      onChange={(items) =>
        onChange({
          ...component,
          debugging: { ...component.debugging, traces: items },
        })
      }
      placeholder="Trace point"
    />
    <StringListEditor
      label="Observability Points"
      items={component.debugging.observability}
      onChange={(items) =>
        onChange({
          ...component,
          debugging: { ...component.debugging, observability: items },
        })
      }
      placeholder="Observability point"
    />
  </div>
);
