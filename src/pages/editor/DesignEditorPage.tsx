import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button, Field, TextArea, TextInput } from "../../components/form/FormControls";
import { StringListEditor, EventListEditor, ObjectListEditor, StateListEditor } from "../../components/form/ListEditors";
import { MermaidPreview } from "../../components/preview/MermaidPreview";
import { generateOutputs } from "../../features/designs/generators";
import type {
  FirmwareDesign,
  InteractionDefinition,
  OwnershipDefinition,
  ResponsibilityDefinition,
  RtosTaskDefinition,
  FailureModeDefinition,
  SectionId,
} from "../../features/designs/schema/firmware-design";
import { SECTION_DEFINITIONS } from "../../features/designs/schema/firmware-design";
import { isSectionStarted } from "../../features/designs/state/progress";

type DesignEditorPageProps = {
  design: FirmwareDesign;
  onBack: () => void;
  onChange: (updater: (current: FirmwareDesign) => FirmwareDesign) => void;
  onExport: (markdown: string, fileName: string) => void;
};

export const DesignEditorPage = ({ design, onBack, onChange, onExport }: DesignEditorPageProps) => {
  const [activeSection, setActiveSection] = useState<SectionId>("featureSummary");
  const outputs = useMemo(() => generateOutputs(design), [design]);
  const completedSections = SECTION_DEFINITIONS.filter((section) => isSectionStarted(design, section.id)).length;

  const updateTimestamp = (next: FirmwareDesign): FirmwareDesign => ({
    ...next,
    updatedAt: new Date().toISOString(),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <aside className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.25em] text-copper">Checklist</p>
          <Button onClick={onBack} tone="ghost">
            Back
          </Button>
        </div>
        <div className="mt-4 rounded-2xl bg-ink p-4 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-sand/80">Progress</p>
          <p className="mt-2 text-3xl font-semibold">{Math.round((completedSections / SECTION_DEFINITIONS.length) * 100)}%</p>
          <p className="mt-1 text-sm text-white/70">{completedSections} of {SECTION_DEFINITIONS.length} sections started</p>
        </div>
        <nav className="mt-4 space-y-2">
          {SECTION_DEFINITIONS.map((section) => {
            const active = section.id === activeSection;
            const started = isSectionStarted(design, section.id);

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
                  <span className={`h-2.5 w-2.5 rounded-full ${started ? "bg-pine" : "bg-slate/30"}`} />
                </div>
                <p className="mt-1 text-xs text-slate">{section.description}</p>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-copper">Design Editor</p>
            <h2 className="mt-2 text-2xl font-semibold">{design.title}</h2>
            <p className="mt-1 text-sm text-slate">Edit one section at a time. Outputs refresh automatically as the design evolves.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onExport(outputs.markdown, design.title)}>Export Markdown</Button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Design Title">
            <TextInput
              value={design.title}
              onChange={(value) =>
                onChange((current) =>
                  updateTimestamp({
                    ...current,
                    title: value,
                  }),
                )
              }
              placeholder="Feature design title"
            />
          </Field>

          <Field label="Requirement" hint="Start with the rough requirement the firmware team received.">
            <TextArea
              value={design.requirement}
              onChange={(value) =>
                onChange((current) =>
                  updateTimestamp({
                    ...current,
                    requirement: value,
                  }),
                )
              }
              rows={5}
              placeholder="Describe the feature request in rough terms."
            />
          </Field>

          <SectionForm
            activeSection={activeSection}
            design={design}
            onChange={(updater) => onChange((current) => updateTimestamp(updater(current)))}
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-panel">
        <p className="text-xs uppercase tracking-[0.25em] text-copper">Generated Outputs</p>
        <h2 className="mt-2 text-2xl font-semibold">Live Preview</h2>
        <div className="mt-5 space-y-5">
          <PreviewCard title="Markdown Design Document">
            <pre className="max-h-[420px] overflow-auto rounded-2xl bg-ink p-4 text-xs text-white">{outputs.markdown}</pre>
          </PreviewCard>
          <PreviewCard title="Architecture Flowchart">
            <MermaidPreview title="Architecture Flowchart" chart={outputs.flowchart} />
          </PreviewCard>
          <PreviewCard title="State Diagram">
            <MermaidPreview title="State Diagram" chart={outputs.stateDiagram} />
          </PreviewCard>
          <PreviewCard title="RTOS Task Table">
            <pre className="overflow-auto rounded-2xl bg-mist p-4 text-xs text-ink">{outputs.rtosTable}</pre>
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

const SectionForm = ({
  activeSection,
  design,
  onChange,
}: {
  activeSection: SectionId;
  design: FirmwareDesign;
  onChange: (updater: (current: FirmwareDesign) => FirmwareDesign) => void;
}) => {
  switch (activeSection) {
    case "featureSummary":
      return (
        <div className="grid gap-4">
          <Field label="Feature Summary">
            <TextArea
              value={design.featureSummary.summary}
              onChange={(value) =>
                onChange((current) => ({
                  ...current,
                  featureSummary: { ...current.featureSummary, summary: value },
                }))
              }
            />
          </Field>
          <Field label="Why Does This Feature Exist?">
            <TextArea
              value={design.featureSummary.purpose}
              onChange={(value) =>
                onChange((current) => ({
                  ...current,
                  featureSummary: { ...current.featureSummary, purpose: value },
                }))
              }
            />
          </Field>
          <StringListEditor
            label="Constraints"
            hint="Document real-time, CPU, memory, power, or reliability constraints."
            items={design.featureSummary.constraints}
            onChange={(items) =>
              onChange((current) => ({
                ...current,
                featureSummary: { ...current.featureSummary, constraints: items },
              }))
            }
            placeholder="Constraint"
          />
        </div>
      );
    case "systemPurpose":
      return (
        <div className="grid gap-4">
          <StringListEditor label="What Should The System Do?" items={design.systemPurpose.shouldDo} onChange={(items) => onChange((current) => ({ ...current, systemPurpose: { ...current.systemPurpose, shouldDo: items } }))} placeholder="Desired behavior" />
          <StringListEditor label="What Should The System Not Do?" items={design.systemPurpose.shouldNotDo} onChange={(items) => onChange((current) => ({ ...current, systemPurpose: { ...current.systemPurpose, shouldNotDo: items } }))} placeholder="Forbidden behavior" />
          <StringListEditor label="Success Criteria" items={design.systemPurpose.successCriteria} onChange={(items) => onChange((current) => ({ ...current, systemPurpose: { ...current.systemPurpose, successCriteria: items } }))} placeholder="Success criterion" />
          <StringListEditor label="Failure Criteria" items={design.systemPurpose.failureCriteria} onChange={(items) => onChange((current) => ({ ...current, systemPurpose: { ...current.systemPurpose, failureCriteria: items } }))} placeholder="Failure criterion" />
          <StringListEditor label="Feature Boundaries" items={design.systemPurpose.boundaries} onChange={(items) => onChange((current) => ({ ...current, systemPurpose: { ...current.systemPurpose, boundaries: items } }))} placeholder="Boundary" />
        </div>
      );
    case "io":
      return (
        <div className="grid gap-4">
          <StringListEditor label="Inputs" items={design.io.inputs} onChange={(items) => onChange((current) => ({ ...current, io: { ...current.io, inputs: items } }))} placeholder="Input source" />
          <StringListEditor label="Outputs" items={design.io.outputs} onChange={(items) => onChange((current) => ({ ...current, io: { ...current.io, outputs: items } }))} placeholder="Output artifact" />
        </div>
      );
    case "events":
      return (
        <EventListEditor
          items={design.events}
          onChange={(items) =>
            onChange((current) => ({
              ...current,
              events: items,
            }))
          }
        />
      );
    case "states":
      return (
        <StateListEditor
          items={design.states}
          onChange={(items) =>
            onChange((current) => ({
              ...current,
              states: items,
            }))
          }
        />
      );
    case "responsibilities":
      return (
        <ObjectListEditor<ResponsibilityDefinition>
          label="Responsibilities"
          hint="Split the feature into focused modules or subsystems."
          items={design.responsibilities}
          onChange={(items) => onChange((current) => ({ ...current, responsibilities: items }))}
          template={{ responsibility: "", module: "", notes: "" }}
          fields={[
            { key: "responsibility", label: "Responsibility" },
            { key: "module", label: "Candidate Module / Subsystem" },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
        />
      );
    case "interactions":
      return (
        <ObjectListEditor<InteractionDefinition>
          label="Interactions & Data Flow"
          hint="Describe who talks to whom, how, and what is exchanged."
          items={design.interactions}
          onChange={(items) => onChange((current) => ({ ...current, interactions: items }))}
          template={{ from: "", to: "", mechanism: "queue", data: "", notes: "" }}
          fields={[
            { key: "from", label: "From" },
            { key: "to", label: "To" },
            { key: "mechanism", label: "Mechanism", type: "select", options: ["queue", "event", "notification", "callback", "shared_memory", "direct_call", "other"] },
            { key: "data", label: "Data" },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
        />
      );
    case "rtos":
      return (
        <div className="grid gap-4">
          <ObjectListEditor<RtosTaskDefinition>
            label="RTOS Tasks"
            hint="Define the concurrency model only after the behavior is clear."
            items={design.rtos.tasks}
            onChange={(items) => onChange((current) => ({ ...current, rtos: { ...current.rtos, tasks: items } }))}
            template={{ name: "", responsibility: "", priority: "medium", type: "event-driven", trigger: "", mayBlock: false, notes: "" }}
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
          <StringListEditor label="Synchronization" items={design.rtos.synchronization} onChange={(items) => onChange((current) => ({ ...current, rtos: { ...current.rtos, synchronization: items } }))} placeholder="Synchronization strategy" />
          <StringListEditor label="Timing Risks" items={design.rtos.timingRisks} onChange={(items) => onChange((current) => ({ ...current, rtos: { ...current.rtos, timingRisks: items } }))} placeholder="Timing risk" />
        </div>
      );
    case "ownership":
      return (
        <ObjectListEditor<OwnershipDefinition>
          label="Resource Ownership"
          items={design.ownership}
          onChange={(items) => onChange((current) => ({ ...current, ownership: items }))}
          template={{ resource: "", owner: "", accessRules: "" }}
          fields={[
            { key: "resource", label: "Resource" },
            { key: "owner", label: "Owner" },
            { key: "accessRules", label: "Access Rules", type: "textarea" },
          ]}
        />
      );
    case "failureModes":
      return (
        <ObjectListEditor<FailureModeDefinition>
          label="Failure Analysis"
          items={design.failureModes}
          onChange={(items) => onChange((current) => ({ ...current, failureModes: items }))}
          template={{ scenario: "", impact: "", recovery: "" }}
          fields={[
            { key: "scenario", label: "Failure Scenario" },
            { key: "impact", label: "Impact", type: "textarea" },
            { key: "recovery", label: "Recovery Strategy", type: "textarea" },
          ]}
        />
      );
    case "layers":
      return (
        <div className="grid gap-4">
          <StringListEditor label="Application Layer Modules" items={design.layers.application} onChange={(items) => onChange((current) => ({ ...current, layers: { ...current.layers, application: items } }))} placeholder="Application module" />
          <StringListEditor label="Service Layer Modules" items={design.layers.service} onChange={(items) => onChange((current) => ({ ...current, layers: { ...current.layers, service: items } }))} placeholder="Service module" />
          <StringListEditor label="Driver Layer Modules" items={design.layers.driver} onChange={(items) => onChange((current) => ({ ...current, layers: { ...current.layers, driver: items } }))} placeholder="Driver module" />
          <StringListEditor label="HAL / BSP Layer Modules" items={design.layers.halBsp} onChange={(items) => onChange((current) => ({ ...current, layers: { ...current.layers, halBsp: items } }))} placeholder="HAL/BSP module" />
        </div>
      );
    case "debugging":
      return (
        <div className="grid gap-4">
          <StringListEditor label="Logs" items={design.debugging.logs} onChange={(items) => onChange((current) => ({ ...current, debugging: { ...current.debugging, logs: items } }))} placeholder="Log signal" />
          <StringListEditor label="Trace Points" items={design.debugging.traces} onChange={(items) => onChange((current) => ({ ...current, debugging: { ...current.debugging, traces: items } }))} placeholder="Trace point" />
          <StringListEditor label="Observability Points" items={design.debugging.observability} onChange={(items) => onChange((current) => ({ ...current, debugging: { ...current.debugging, observability: items } }))} placeholder="Observability point" />
        </div>
      );
    case "implementationPlan":
      return (
        <div className="grid gap-4">
          <StringListEditor label="Milestones" items={design.implementationPlan.milestones} onChange={(items) => onChange((current) => ({ ...current, implementationPlan: { ...current.implementationPlan, milestones: items } }))} placeholder="Milestone" />
          <StringListEditor label="APIs" items={design.implementationPlan.apis} onChange={(items) => onChange((current) => ({ ...current, implementationPlan: { ...current.implementationPlan, apis: items } }))} placeholder="API" />
          <StringListEditor label="Tests" items={design.implementationPlan.tests} onChange={(items) => onChange((current) => ({ ...current, implementationPlan: { ...current.implementationPlan, tests: items } }))} placeholder="Test" />
        </div>
      );
    default:
      return null;
  }
};
