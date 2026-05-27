---
name: design-orchestrator
description: Use when working on top-level app flow for the firmware design assistant, including dashboard to editor transitions, section progression, preview coordination, and keeping module responsibilities separated.
---

# Design Orchestrator

## Use This Skill For

- page-level flow decisions
- editor lifecycle decisions
- coordination between state, preview, and export
- preventing business logic from leaking into page components

## Responsibilities

- Keep the product centered on the guided checklist workflow.
- Preserve the authoring pipeline:
  - create or open design
  - edit one section at a time
  - update live outputs
  - persist draft
  - export markdown

## Rules

- Do not place generator logic in page components.
- Do not place persistence logic in section forms.
- Do not let the preview own canonical state.
- Keep dashboard concerns separate from editor concerns.

## Expected Outputs

- route or screen structure
- editor shell behavior
- section selection logic
- preview refresh orchestration
