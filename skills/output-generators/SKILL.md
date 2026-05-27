---
name: output-generators
description: Use when implementing or revising derived outputs for the firmware design assistant, including markdown generation, Mermaid diagrams, RTOS tables, and risk review generation.
---

# Output Generators

## Use This Skill For

- markdown document generation
- Mermaid flowchart generation
- Mermaid state diagram generation
- RTOS task table generation
- risk review generation

## Responsibilities

- Convert canonical design data into derived artifacts.
- Tolerate incomplete input.
- Stay deterministic and side-effect free.

## Rules

- Keep each generator pure.
- Normalize sparse fields before formatting output.
- Favor valid output over perfect output when data is incomplete.
- Avoid hidden dependencies on UI components or browser APIs.

## Validation Checks

- Does empty or partial data still produce valid output?
- Is Mermaid syntax still valid?
- Are tables stable and readable?
- Is risk output traceable to the design data?
