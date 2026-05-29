# Implementation Plan

## Current Status

The current implementation now runs on the hierarchical workspace model:

- one record = one feature workspace
- discovery-first editor flow
- candidate components and interactions
- candidate RTOS tasks
- per-component detail editor
- derived outputs generated from workspace-level and component-level data

The old flat model should now be considered a legacy prototype shape only.

## Implemented Structure

The editor is split into two main design phases:

1. Feature Architecture Discovery
2. Component Detail Refinement

## Chosen Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- React Context plus `useReducer`
- `localStorage` persistence with debounced autosave
- Inline Mermaid rendering with text fallback
- Docker multi-stage build with Nginx runtime

## Refactor Strategy Used

These parts were intentionally reused:
- dashboard structure
- storage adapter pattern
- output preview pattern
- component-detail checklist patterns
- markdown and Mermaid generation approach

These parts were replaced or redesigned:
- flat `FirmwareDesign` schema
- flat editor navigation
- single-level section progress model
- generator assumptions that everything belongs to one component

## Target Source Layout

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
        model/
  components/
    form/
    layout/
    preview/
    workspace/
  styles/
```

## Planned Domain Model

Top-level record:
- `FeatureWorkspace`

Nested structures:
- feature summary
- discovery data
- component collection
- implementation plan

Per-component details:
- inputs
- outputs
- events
- states
- ownership
- failure modes
- debugging

## Target Navigation Model

The app starts at the dashboard.

Selecting a workspace opens the feature workspace editor with this structure:

### Stage A: Feature Discovery
- Feature Summary
- Scope / Constraints / Assumptions
- Responsibilities
- Candidate Components
- Interactions
- Candidate RTOS Tasks
- System Risks

### Stage B: Component Detail
- Component list
- Active component editor
  - Inputs / Outputs
  - Events
  - States
  - Ownership
  - Failure Modes
  - Debugging

### Stage C: Output and Delivery
- Implementation Plan
- Generated Outputs

## Architecture Views Plan

ArchFlow should track the following seven system-design views explicitly:

1. Context Diagram
2. Functional / Feature Breakdown
3. Component / Container Diagram
4. Interaction / Data Flow Diagram
5. State Diagram
6. Sequence Diagram
7. Deployment / Runtime Diagram

Current implementation status:

- Available now:
  - 3. Component / Container Diagram
  - 4. Interaction / Data Flow Diagram
  - 5. State Diagram
- Partial now:
  - 2. Functional / Feature Breakdown
- Not implemented yet:
  - 1. Context Diagram
  - 6. Sequence Diagram
  - 7. Deployment / Runtime Diagram

Recommended implementation order:

1. Context Diagram
2. Functional / Feature Breakdown cleanup
3. Sequence Diagram
4. Deployment / Runtime Diagram

Rationale:

- Context should come first because it clarifies system boundary and external actors before more internal modeling is added.
- Functional / Feature Breakdown should be tightened next because it is already partially present through requirements and responsibilities.
- Sequence Diagram should come before runtime deployment because scenario flow will expose whether the current interaction model is expressive enough.
- Deployment / Runtime Diagram should come after that, once task/runtime ownership and execution boundaries are stable enough to visualize cleanly.

## Completion Rules

- Progress is approximate and never blocking.
- A discovery section counts as started when meaningful data exists.
- A component counts as started when any design detail exists.
- A workspace can always be saved and reopened even when incomplete.

## Persistence Rules

- Store all feature workspaces under one application key.
- Persist canonical workspace data only.
- Include a storage version for migration.
- Consider one-time migration from old flat design records.

## Generator Contracts

- Generators accept one `FeatureWorkspace`.
- Feature-level generators produce workspace-wide outputs.
- Component-level generators operate on selected components when needed.
- Generators never mutate the input.

## Refactor Status

Completed:
1. Defined new workspace schema
2. Added migration strategy from old `FirmwareDesign`
3. Refactored storage and state
4. Replaced editor navigation with discovery-first workflow
5. Added component registry and component selector
6. Moved detailed checklist editing under component refinement
7. Refactored generators to consume hierarchical workspace data
8. Updated preview and export behavior
9. Rebuilt and verified in Docker

Remaining improvements:
1. Better editing controls for component interactions and task ownership
2. Stronger migration and versioning tests
3. Clearer separation of feature-level state versus component-level state if needed later

## Practical Rule

Do not add AI drafting until the workspace model is correct.

AI can only be useful here if the app first knows how to represent:
- candidate components
- their relationships
- the boundary between feature-level and component-level design
