# Refactor Notes 2026-05-27

## Why The Design Changed

The initial prototype modeled one design entry as one component-like design record.

That was too late in the design process.

The real missing step is earlier:
- starting from a feature requirement
- discovering what components should exist
- defining how those components relate
- only then detailing each component

## Design Decision

Adopt a hierarchical model:

- one record = one feature workspace
- one workspace = many candidate or refined components
- detailed checklist = applied per component

## What The Existing Prototype Still Represents

The current app implementation is still useful, but only as:

- a prototype of the component-detail editor
- a prototype of deterministic output generation
- a prototype of the local-first workflow

It is not the final domain model.

## Next Refactor Objective

Refactor the app so the editor supports:

1. feature discovery
2. component list and interaction modeling
3. per-component detailed checklist editing
4. feature-level plus component-level outputs

## Constraint

Keep the design documented in markdown first, then align the implementation to it.

## Implementation Status

This refactor objective has now been implemented at MVP level:

- the app stores `FeatureWorkspace` records
- the editor supports discovery-first workflow
- candidate components can be refined one at a time
- outputs are generated from the hierarchical workspace model

Further refinements should now iterate on this workspace model rather than reverting to the old flat design shape.
