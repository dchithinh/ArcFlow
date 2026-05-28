# AGENTS.md

## Purpose

This repository is for a local-first web app that helps firmware developers turn rough feature requirements into a structured system design.

Before implementation, treat this file as the operating contract for how work should be split, reviewed, and evolved.

## Working Rules

- Preserve the product goal: guided design thinking first, generation second.
- Keep the app local-first for the MVP.
- Avoid hidden coupling between editor UI, design data, and output generators.
- Treat generated outputs as derived views of the design model, not as the source of truth.
- Prefer additive schema evolution so incomplete designs remain editable.
- Distinguish feature-level discovery from component-level detail.

## Project Agents

These are project roles and responsibility boundaries. They are architectural ownership blocks, not runtime agents.

### 1. Design Orchestrator
- Owns application flow and feature workspace progression.
- Coordinates discovery, component refinement, preview refresh, and export actions.
- Must not contain output formatting rules or persistence internals.

### 2. Design Schema Agent
- Owns the `FeatureWorkspace` type and default workspace state.
- Defines feature-level and component-level schema boundaries, field semantics, and validation constraints.
- Must remain UI-agnostic and generator-agnostic.

### 3. Discovery Workflow Agent
- Owns the feature architecture discovery flow.
- Handles responsibilities, candidate components, interactions, candidate tasks, assumptions, and open questions.
- Must not own persistence or output formatting rules.

### 4. Component Detail Agent
- Owns per-component detailed design workflow.
- Handles one selected component at a time.
- Reuses checklist structure for inputs/outputs, events, states, ownership, failure modes, and debugging.
- Must not own workspace-level discovery rules.

### 5. Output Generator Agent
- Owns all derived artifacts:
  - Markdown design document
  - Mermaid architecture flowchart
  - Component state diagrams
  - RTOS task table
  - Risk review checklist
- Must be pure and deterministic from workspace input.

### 6. Persistence and Export Agent
- Owns `localStorage` read/write, versioning, hydration, migration, and export.
- Must isolate storage concerns from UI components.

### 7. UI System Agent
- Owns layout, visual system, reusable form primitives, and preview presentation.
- Preserves a clear workspace mental model:
  - discovery
  - component refinement
  - generated output

### 8. Migration Agent
- Owns transition from the current flat prototype to the hierarchical workspace model.
- Must preserve useful existing behavior where possible.
- Must not freeze the old flat schema in place.

### 9. Editor Workflow Agent
- Owns general form behavior, progress tracking, and incomplete draft handling across both discovery and component detail flows.
- Ensures the active editing context is clear at all times.
- Must not own data persistence or markdown generation logic.

### 10. AI Drafting Agent
- Owns AI-assisted workspace drafting from user-provided feature inputs.
- Calls external model APIs and returns structured workspace data only.
- Must preserve user-owned inputs:
  - feature name
  - requirement
  - constraints
  - responsibilities
- Must not generate markdown or diagrams as the source of truth.
- Must leave all generated workspace fields editable by the user afterward.

## Architectural Rules

- The canonical source of truth is the `FeatureWorkspace` object.
- UI writes only to state actions/selectors, not directly to generators or storage.
- Generators consume normalized design data and return strings or structured derived output.
- Persistence runs at app boundaries and never mutates schema shape.
- Feature-level discovery happens before component-level detail.
- The detailed checklist belongs to a selected component, not the entire feature workspace.
- Each workflow block maps to:
  - workspace schema fragment
  - editor component
  - optional generator dependency

## Suggested Repository Shape

The implementation should align to this structure unless a later revision replaces it explicitly.

```text
src/
  app/
  pages/
  features/
    workspaces/
      schema/
      state/
      discovery/
      components/
      editor/
      generators/
      storage/
      export/
  components/
  lib/
  styles/
docs/
  architecture/
skills/
```

## Decision Filter

When choosing implementation details, prefer the option that:
- keeps feature discovery and component detail separate
- keeps component boundaries explicit
- keeps generators pure
- keeps draft persistence recoverable
- allows future AI-assisted review without redesigning the core model

## Change Policy

Before major implementation starts, update these first if needed:
- `AGENTS.md` when responsibility boundaries change
- `docs/architecture/project-architecture.md` when system design changes
- `skills/*/SKILL.md` when a project block changes workflow or constraints
