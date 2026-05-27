---
name: design-schema
description: Use when defining or changing the FirmwareDesign model, defaults, fixtures, field semantics, validation assumptions, or schema evolution rules for the firmware design assistant.
---

# Design Schema

## Use This Skill For

- `FirmwareDesign` type updates
- default value design
- sample design fixtures
- field naming consistency
- storage-safe schema evolution

## Responsibilities

- Keep one canonical design model.
- Prefer explicit field semantics over overloaded text blobs.
- Allow incomplete drafts without invalidating the whole object.
- Keep the schema independent from UI and generators.

## Rules

- The schema is the source of truth.
- Generators derive from schema; they never redefine it.
- UI labels may change without changing schema semantics.
- New fields should be backward-compatible where possible.

## Review Checks

- Can this field be saved even if incomplete?
- Is this field domain data rather than UI state?
- Will this field be needed by a generator?
- Can old drafts survive this schema change?
