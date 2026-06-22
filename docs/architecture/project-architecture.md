# Project Architecture

## Current Direction

ArchFlow is no longer being treated as a single-component checklist editor.

The intended product direction is:

`rough feature requirement -> discover candidate components -> define relationships -> refine each component -> generate design outputs`

This better matches real system design work, where the hard problem is not only documenting states and execution units, but first discovering what components, boundaries, and interactions should exist for the feature.

## Product Goal

Build a local-first feature design assistant that helps a developer start from an incomplete feature requirement and progressively shape it into:

- candidate components
- responsibility boundaries
- component relationships
- concurrency and execution proposals
- component-level detailed design
- object-first internal design inside each component
- generated architecture outputs

The product should support design discovery first, then design refinement.

## Product Shape

The MVP+ architecture should center on a `FeatureWorkspace`.

Each feature workspace represents one feature requirement and contains:

- feature requirement and scope
- feature-level discovery artifacts
- proposed components
- per-component detailed design
- generated outputs

This means one design is no longer "one component". One design is one feature workspace that may contain multiple components.

## Core Design Principle

The system should be organized around this pipeline:

`rough requirement -> feature architecture skeleton -> component detail -> derived outputs`

With AI assistance enabled, the assisted path becomes:

`rough requirement + constraints + responsibilities -> AI discovery draft -> user review -> AI component refinement -> derived outputs`

This means:
- the requirement is the input, not the full design
- the app must support architecture discovery before detailed checklists
- per-component design detail is subordinate to the feature workspace
- generated outputs should reflect both feature-level and component-level structure
- AI suggestions must write into the workspace model, not directly into markdown or diagrams
- AI generation should be staged by workflow block instead of trying to draft the full workspace in one request

## Architecture View Roadmap

ArchFlow should support a small set of complementary architecture views instead of trying to force all understanding into one diagram.

Priority views for this product:

1. Context Diagram
2. Functional / Feature Breakdown
3. Component / Container Diagram
4. Interaction / Data Flow Diagram
5. State Diagram
6. Sequence Diagram
7. Deployment / Runtime Diagram

Current coverage:

- Implemented now:
  - 3. Component / Container Diagram
  - 4. Interaction / Data Flow Diagram
  - 5. State Diagram
- Partial now:
  - 2. Functional / Feature Breakdown
- Missing now:
  - 1. Context Diagram
  - 6. Sequence Diagram
  - 7. Deployment / Runtime Diagram

These views answer different questions:

- Context Diagram: who or what is outside the system boundary and what crosses it
- Functional / Feature Breakdown: what the feature is required to do
- Component / Container Diagram: what the major internal building blocks are
- Interaction / Data Flow Diagram: how components communicate and what moves between them
- State Diagram: how selected internal objects change behavior over time
- Sequence Diagram: how one scenario unfolds step by step
- Deployment / Runtime Diagram: where the system runs and how execution is partitioned

## Canonical Domain Model

The canonical source of truth should evolve from a flat `FirmwareDesign` to a hierarchical `FeatureWorkspace`.

Recommended shape:

```ts
type FeatureWorkspace = {
  id: string;
  title: string;
  requirement: string;
  createdAt: string;
  updatedAt: string;

  featureSummary: {
    summary: string;
    problem: string;
    goals: string[];
    constraints: string[];
    assumptions: string[];
    openQuestions: string[];
  };

  discovery: {
    externalActors: string[];
    responsibilities: string[];
    candidateComponents: ComponentCandidate[];
    interactions: ComponentInteraction[];
    candidateTasks: CandidateTask[];
    systemRisks: string[];
  };

  components: FeatureComponent[];
};

type ComponentCandidate = {
  id: string;
  name: string;
  responsibility: string;
  rationale?: string;
};

type ComponentInteraction = {
  fromComponentId: string;
  toComponentId: string;
  mechanism: "queue" | "event" | "notification" | "callback" | "shared_memory" | "direct_call" | "other";
  data: string;
  notes?: string;
};

type CandidateTask = {
  name: string;
  responsibility: string;
  priority: "high" | "medium" | "low";
  trigger: string;
  notes?: string;
};

type FeatureComponent = {
  id: string;
  name: string;
  summary: string;
  inputs: string[];
  outputs: string[];
  events: EventDefinition[];
  objects: ComponentObject[];
  objectInteractions: ComponentObjectInteraction[];
  ownership: OwnershipDefinition[];
  failureModes: FailureModeDefinition[];
  debugging: {
    logs: string[];
    traces: string[];
    observability: string[];
  };
};
```

## User Workflow

### 1. Feature Intake
- User creates a feature workspace.
- User enters a rough feature requirement.
- User records scope, constraints, assumptions, and open questions.

### 2. Architecture Discovery
- User identifies candidate responsibilities.
- User proposes candidate components.
- User maps component interactions.
- User sketches candidate execution units or concurrency boundaries.
- User captures system-level risks.

### 2a. AI-Assisted Discovery
- User supplies feature name, requirement, constraints, and responsibilities.
- AI may generate a first-pass discovery draft for feature-level sections.
- The generated draft must remain fully editable in the same workspace.
- User edits remain authoritative after generation.

### 3a. AI-Assisted Component Refinement
- User selects one component after discovery stabilizes.
- AI generates detailed design only for that selected component.
- This keeps request size bounded and avoids global redesign side effects.

### 3. Component Refinement
- User selects one component at a time.
- User first identifies the internal objects inside that component.
- User marks which objects are active vs passive.
- User decides which objects need state.
- User fills detailed component fields:
  - inputs and outputs
  - events
  - internal objects and object interactions
  - per-object states and transitions
  - ownership
  - failure modes
  - debugging hooks

### 4. Output Generation
- Generate feature-level architecture flow
- Generate component-level state diagrams
- Generate markdown design draft
- Generate risk review

## Primary Modules

### 1. App Shell
- Owns routing and top-level layout.
- Switches between dashboard and feature workspace flows.

### 2. Workspace Domain
- Owns `FeatureWorkspace` types.
- Owns empty defaults and sample feature workspaces.
- Owns shape evolution and migration.

### 3. Discovery Module
- Owns the feature-level architecture discovery step.
- Handles responsibilities, components, interactions, tasks, assumptions, and open questions.

### 4. Component Design Module
- Owns per-component detailed design.
- Reuses the existing checklist patterns, but scoped to a selected component and its internal objects.

### 5. Workspace State
- Owns in-memory editing state.
- Owns selected stage, selected component, and progress state.

### 6. Generator Module
- Produces derived outputs from the full feature workspace.
- Must combine:
  - feature-level structure
  - component-level details
- Owns the architecture-view roadmap above and keeps naming/output boundaries consistent across the supported view set.

### 7. Preview Module
- Displays live generated output.
- Must support both workspace-wide and component-level views.

### 8. Persistence Module
- Stores feature workspaces in `localStorage`.
- Handles migration from older flat design records if needed.

### 9. Export Module
- Exports generated markdown and later optional JSON.

### 10. AI Drafting Module
- Owns backend calls to the OpenAI Responses API.
- Owns backend calls to local-model providers such as Ollama when configured.
- Requests structured JSON that maps into workflow-stage outputs, then merges them into `FeatureWorkspace`.
- Must preserve user-owned inputs:
  - title
  - requirement
  - constraints
  - responsibilities
- Must return editable workspace data, not final locked artifacts.
- Should prefer smaller stage-scoped requests over one large full-workspace generation request.

## Editor Information Architecture

The editor should no longer be a single flat checklist.

Recommended left-navigation grouping:

1. Feature Definition
2. Feature Summary
3. Scope, Constraints, Assumptions
4. Responsibilities
5. Feature Design
6. Candidate Components
7. Component Interactions
8. Component Detail
9. System Risks
10. Implementation
11. Candidate RTOS Tasks
12. Implementation Plan
13. Generated Outputs

Within `Component Detail`, the user then chooses one component and fills:

1. Inputs / Outputs
2. Events
3. Internal Objects
4. Object Interactions
5. Selected Object States
6. Ownership
7. Failure Modes
8. Debugging

## Output Model

Outputs should be separated into feature-level and component-level artifacts.

### Feature-Level Outputs
- feature summary markdown
- architecture flowchart
- component relationship map
- execution-unit proposal table
- system-level risk review

### Component-Level Outputs
- per-component design notes
- per-component internal object notes
- per-object state diagram
- component-specific failure and ownership sections

## Recommended Source Layout

```text
src/
  app/
  pages/
    dashboard/
    workspace/
  features/
    workspaces/
      schema/
      state/
      storage/
      generators/
      discovery/
      components/
        editor/
        selectors/
  components/
    form/
    layout/
    preview/
    workspace/
  styles/
```

## Migration From Current Implementation

Current implementation status:
- one flat `FirmwareDesign`
- one checklist for the whole design
- no explicit component discovery stage
- outputs derived from manually entered flat fields

Target implementation status:
- one `FeatureWorkspace`
- feature-level discovery before component detail
- multiple components inside one workspace
- outputs derived from hierarchical workspace data

The current implementation should be treated as a prototype of the component-detail editor, not as the final product model.

## Non-Goals For This Phase

- automatic architecture correctness
- backend persistence
- multi-user collaboration
- full AI drafting in the same refactor

## Open Design Questions

- Should candidate execution units remain feature-level only, or also allow per-component ownership?
- Should passive objects with meaningful lifecycle be modeled the same way as active objects, or separately?
- Should system-level states exist alongside component states?
- Should interactions reference tasks, components, or both?

## Immediate Refactor Goal

Refactor the product from:

`single flat checklist editor`

to:

`feature workspace with discovery stage + per-component detailed design`
