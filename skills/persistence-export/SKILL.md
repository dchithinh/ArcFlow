---
name: persistence-export
description: Use when working on local draft storage, schema migrations, hydration, autosave behavior, or markdown export in the firmware design assistant.
---

# Persistence and Export

## Use This Skill For

- `localStorage` persistence
- hydration logic
- schema migration handling
- autosave policy
- markdown export

## Responsibilities

- Keep drafts recoverable.
- Separate stored source data from generated export data.
- Make persistence failures non-destructive.

## Rules

- Store canonical design objects, not preview fragments.
- Keep storage format version-aware.
- Export from generated markdown, not directly from arbitrary form state.
- Isolate browser storage APIs behind a small module.

## Validation Checks

- Can a saved draft reload safely?
- Will schema changes preserve older drafts?
- Does export reflect current generated content?
- Does save behavior avoid data loss and excessive writes?
