import { useEffect, useMemo, useReducer } from "react";
import { AppFrame } from "../components/layout/AppFrame";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { FeatureWorkspacePage } from "../pages/workspace/FeatureWorkspacePage";
import { createEmptyWorkspace, createSampleWorkspace } from "../features/workspaces/schema/defaults";
import { applyImportedMarkdownToWorkspace } from "../features/workspaces/import/markdown";
import type { FeatureWorkspace } from "../features/workspaces/schema/workspace";
import {
  loadWorkspaces,
  normalizeImportedWorkspace,
  saveWorkspaces,
} from "../features/workspaces/storage/local-storage";
import {
  canSyncWorkspaceFiles,
  inspectWorkspaceFiles,
  pullWorkspaceFiles,
  syncWorkspaceFiles,
} from "../features/workspaces/storage/file-sync";

type AppState = {
  workspaces: FeatureWorkspace[];
  activeWorkspaceId: string | null;
};

type AppAction =
  | { type: "hydrate"; workspaces: FeatureWorkspace[] }
  | { type: "create"; workspace: FeatureWorkspace }
  | { type: "open"; workspaceId: string }
  | { type: "backToDashboard" }
  | { type: "remove"; workspaceId: string }
  | {
      type: "update";
      workspaceId: string;
      updater: (current: FeatureWorkspace) => FeatureWorkspace;
    };

const reducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        workspaces: action.workspaces,
      };
    case "create":
      return {
        workspaces: [
          action.workspace,
          ...state.workspaces.filter((item) => item.id !== action.workspace.id),
        ],
        activeWorkspaceId: action.workspace.id,
      };
    case "open":
      return {
        ...state,
        activeWorkspaceId: action.workspaceId,
      };
    case "backToDashboard":
      return {
        ...state,
        activeWorkspaceId: null,
      };
    case "remove":
      return {
        workspaces: state.workspaces.filter((workspace) => workspace.id !== action.workspaceId),
        activeWorkspaceId:
          state.activeWorkspaceId === action.workspaceId ? null : state.activeWorkspaceId,
      };
    case "update":
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === action.workspaceId ? action.updater(workspace) : workspace,
        ),
      };
    default:
      return state;
  }
};

const initialState: AppState = {
  workspaces: [],
  activeWorkspaceId: null,
};

export const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const activeWorkspace = useMemo(
    () => state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? null,
    [state.activeWorkspaceId, state.workspaces],
  );

  useEffect(() => {
    dispatch({ type: "hydrate", workspaces: loadWorkspaces() });
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      saveWorkspaces(state.workspaces);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [state.workspaces]);

  const buildWorkspaceBaseName = (workspace: FeatureWorkspace): string =>
    workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "feature-workspace";

  const buildCurrentSyncFiles = (workspace: FeatureWorkspace, markdown: string) => {
    const baseName = buildWorkspaceBaseName(workspace);
    const workspaceJson = JSON.stringify(workspace, null, 2);
    const agents = buildLlmGuideContent(workspace, markdown);
    const editTemplate = buildEditTemplateContent(workspace);

    return {
      agents,
      baseName,
      editTemplate,
      markdown,
      workspaceJson,
    };
  };

  const hashString = (value: string): string => {
    let hash = 5381;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 33) ^ value.charCodeAt(index);
    }
    return (hash >>> 0).toString(16);
  };

  const buildEditTemplateContent = (workspace: FeatureWorkspace): string => {
    const featureTitle = workspace.title || "Feature Name";
    return `# ARCHFLOW_EDIT_TEMPLATE.md

## Purpose

Use this file as the concrete editing pattern reference when updating ArchFlow synced files.

Read order:

1. \`AGENTS.md\`
2. \`${buildWorkspaceBaseName(workspace)}.md\`
3. \`${buildWorkspaceBaseName(workspace)}.workspace.json\`
4. \`ARCHFLOW_EDIT_TEMPLATE.md\`

This file shows valid edit shapes.
It is not the source of truth.
It is the example guide for how to edit the real workspace JSON safely.

## Core Rules

- Keep JSON valid.
- Preserve existing IDs for existing items.
- Add new IDs only for new items.
- Preserve arrays as arrays.
- Preserve objects as objects.
- Do not replace structured fields with prose.
- Edit markdown only for feature-definition text.

## Feature Definition Pattern

Use these JSON fields:

\`\`\`text
title
requirement
featureSummary.summary
featureSummary.goals
featureSummary.constraints
featureSummary.assumptions
featureSummary.openQuestions
discovery.responsibilities
\`\`\`

Example:

\`\`\`json
{
  "title": "${featureTitle}",
  "requirement": "REQ-1\\nREQ-2",
  "featureSummary": {
    "summary": "Short feature summary",
    "goals": ["REQ-1", "REQ-2"],
    "constraints": ["Constraint 1"],
    "assumptions": ["Assumption 1"],
    "openQuestions": ["Question 1"]
  },
  "discovery": {
    "responsibilities": ["Responsibility 1", "Responsibility 2"]
  }
}
\`\`\`

## Candidate Component Pattern

Use:

\`\`\`text
discovery.candidateComponents[]
\`\`\`

Example:

\`\`\`json
{
  "id": "component-existing-or-new-id",
  "name": "Command Parser",
  "responsibility": "Parse raw command text into structured command data",
  "rationale": "Separates parsing from transport and dispatch"
}
\`\`\`

## Component Interaction Pattern

Use:

\`\`\`text
discovery.interactions[]
\`\`\`

Example:

\`\`\`json
{
  "fromComponentId": "component-a-id",
  "toComponentId": "component-b-id",
  "mechanism": "event",
  "data": "parsed command",
  "notes": "Forward validated command for dispatch"
}
\`\`\`

Important:

- Use component IDs, not component names.
- Keep \`mechanism\` as a short machine-friendly string.

## Component Detail Pattern

Use:

\`\`\`text
components[]
\`\`\`

Example:

\`\`\`json
{
  "id": "component-a-id",
  "name": "Command Parser",
  "summary": "Parse raw terminal input into structured command data",
  "inputs": ["raw command text"],
  "outputs": ["parsed command"],
  "incomingEvents": [],
  "internalSignals": [],
  "outgoingSignals": [],
  "objects": [],
  "objectInteractions": [],
  "ownership": [],
  "failureModes": [],
  "debugging": {
    "logs": [],
    "traces": [],
    "observability": []
  }
}
\`\`\`

## Internal Object Pattern

Use:

\`\`\`text
components[].objects[]
\`\`\`

Example:

\`\`\`json
{
  "id": "component-object-new-id",
  "name": "Dispatch Queue Worker",
  "responsibility": "Wait for parsed command and route it to the correct handler",
  "objectType": "active",
  "needsState": true,
  "states": []
}
\`\`\`

Valid \`objectType\` values:

- \`active\`
- \`passive\`

## Internal Object Interaction Pattern

Use:

\`\`\`text
components[].objectInteractions[]
\`\`\`

Example:

\`\`\`json
{
  "fromObjectId": "object-a-id",
  "toObjectId": "object-b-id",
  "relationship": "Forwards parsed command",
  "notes": "Internal handoff inside the component"
}
\`\`\`

Important:

- Use object IDs, not object names.

## Object State Pattern

Use:

\`\`\`text
components[].objects[].states[]
\`\`\`

Example:

\`\`\`json
{
  "name": "WAIT_FOR_COMMAND",
  "description": "Waiting for parsed command",
  "transitions": [
    {
      "event": "parsed command received",
      "triggerKind": "incoming",
      "targetState": "DISPATCHING",
      "action": "Select target handler"
    }
  ]
}
\`\`\`

Valid \`triggerKind\` values:

- \`incoming\`
- \`internal\`

Important:

- \`targetState\` must match a real state name in the same object.

## Sequence Scenario Pattern

Use:

\`\`\`text
discovery.sequenceScenarios[]
\`\`\`

Scenario shape:

\`\`\`json
{
  "id": "sequence-scenario-id",
  "name": "User sends LED control command",
  "goal": "Send an LED command and return a result",
  "trigger": "User enters LED command in terminal",
  "outcome": "LED handler executes the command and the user receives a response",
  "failurePath": "Invalid command is rejected before dispatch",
  "participants": [],
  "steps": []
}
\`\`\`

Participant shape:

\`\`\`json
{
  "id": "sequence-participant-id",
  "name": "Command Parser",
  "kind": "component",
  "description": "Parses raw command text"
}
\`\`\`

Step shape:

\`\`\`json
{
  "id": "sequence-step-id",
  "fromParticipantId": "sequence-participant-a",
  "toParticipantId": "sequence-participant-b",
  "message": "Forward raw command text",
  "type": "call",
  "note": "Optional extra detail"
}
\`\`\`

Only valid sequence step \`type\` values:

- \`call\`
- \`async\`
- \`return\`
- \`event\`

Never use:

- \`request\`
- \`response\`
- \`message\`

If you think in terms of request/response, map them like this:

- request -> \`call\`
- async send -> \`async\`
- response/result -> \`return\`
- event emission -> \`event\`

## Context Diagram Pattern

Use:

\`\`\`text
discovery.contextEntities[]
discovery.contextFlows[]
\`\`\`

Context entity example:

\`\`\`json
{
  "id": "context-entity-id",
  "name": "User",
  "kind": "user",
  "description": "Sends commands through terminal"
}
\`\`\`

Context flow example:

\`\`\`json
{
  "id": "context-flow-id",
  "entityId": "context-entity-id",
  "direction": "bidirectional",
  "label": "set/get data",
  "description": "User interacts with the feature"
}
\`\`\`

## Data Flow Pattern

Use:

\`\`\`text
discovery.dataFlowNodes[]
discovery.dataFlows[]
\`\`\`

Data flow node example:

\`\`\`json
{
  "id": "data-flow-node-id",
  "name": "Command Dispatcher",
  "kind": "process",
  "description": "Routes commands to handlers"
}
\`\`\`

Data flow example:

\`\`\`json
{
  "id": "data-flow-id",
  "fromNodeId": "data-flow-node-a",
  "toNodeId": "data-flow-node-b",
  "label": "parsed command",
  "notes": "Command transfer"
}
\`\`\`

## Runtime Pattern

Use:

\`\`\`text
discovery.runtimeNodes[]
discovery.runtimeLinks[]
\`\`\`

What this section means:

- This is runtime structure, not code structure.
- It shows what actually runs or exists at execution time.
- Use it for tasks, threads, ISRs, queues, timers, mutexes, peripherals, services, devices, and hosting nodes.

How to think:

- Component diagram asks: what logical parts exist?
- Runtime diagram asks: where do those parts execute and what runtime resources connect them?

Do not fill this section with folder names, source files, or class names.
Do not copy logical component names blindly unless they also represent real runtime nodes.

Runtime node example:

\`\`\`json
{
  "id": "runtime-node-id",
  "name": "Command Task",
  "kind": "task",
  "responsibility": "Processes parsed commands",
  "hostNodeId": "runtime-node-parent-id",
  "notes": ""
}
\`\`\`

Example runtime mapping for an STM32 + FreeRTOS command feature:

\`\`\`json
{
  "runtimeNodes": [
    {
      "id": "runtime-mcu",
      "name": "STM32F4 MCU",
      "kind": "mcu",
      "responsibility": "Hosts FreeRTOS tasks, queues and peripherals",
      "hostNodeId": "",
      "notes": ""
    },
    {
      "id": "runtime-uart-isr",
      "name": "UART ISR",
      "kind": "isr",
      "responsibility": "Receives UART bytes and wakes command handling flow",
      "hostNodeId": "runtime-mcu",
      "notes": ""
    },
    {
      "id": "runtime-cli-task",
      "name": "CLI Task",
      "kind": "task",
      "responsibility": "Collects terminal input and forwards complete command text",
      "hostNodeId": "runtime-mcu",
      "notes": ""
    },
    {
      "id": "runtime-command-queue",
      "name": "Command Queue",
      "kind": "queue",
      "responsibility": "Transfers parsed commands to worker tasks",
      "hostNodeId": "runtime-mcu",
      "notes": ""
    },
    {
      "id": "runtime-led-task",
      "name": "LED Task",
      "kind": "task",
      "responsibility": "Executes LED control commands",
      "hostNodeId": "runtime-mcu",
      "notes": ""
    },
    {
      "id": "runtime-datetime-task",
      "name": "DateTime Task",
      "kind": "task",
      "responsibility": "Executes date/time update commands",
      "hostNodeId": "runtime-mcu",
      "notes": ""
    }
  ],
  "runtimeLinks": [
    {
      "id": "runtime-link-uart-cli",
      "fromNodeId": "runtime-uart-isr",
      "toNodeId": "runtime-cli-task",
      "kind": "interrupt",
      "label": "UART receive event",
      "notes": ""
    },
    {
      "id": "runtime-link-cli-queue",
      "fromNodeId": "runtime-cli-task",
      "toNodeId": "runtime-command-queue",
      "kind": "queue",
      "label": "parsed command",
      "notes": ""
    },
    {
      "id": "runtime-link-queue-led",
      "fromNodeId": "runtime-command-queue",
      "toNodeId": "runtime-led-task",
      "kind": "queue",
      "label": "LED command",
      "notes": ""
    },
    {
      "id": "runtime-link-queue-datetime",
      "fromNodeId": "runtime-command-queue",
      "toNodeId": "runtime-datetime-task",
      "kind": "queue",
      "label": "date/time command",
      "notes": ""
    }
  ]
}
\`\`\`

Runtime link example:

\`\`\`json
{
  "id": "runtime-link-id",
  "fromNodeId": "runtime-node-a",
  "toNodeId": "runtime-node-b",
  "kind": "queue",
  "label": "command queue",
  "notes": ""
}
\`\`\`

## Candidate Task Pattern

Use:

\`\`\`text
discovery.candidateTasks[]
\`\`\`

Example:

\`\`\`json
{
  "id": "task-id",
  "name": "LED Worker Task",
  "responsibility": "Execute LED commands",
  "priority": "medium",
  "type": "event-driven",
  "trigger": "LED command queued",
  "mayBlock": false,
  "notes": ""
}
\`\`\`

## Common Mistakes To Avoid

- Do not replace IDs with labels.
- Do not invent new enum values when an existing one already exists.
- Do not write sequence steps without \`id\`.
- Do not use \`request\`, \`response\`, or \`message\` as sequence step types.
- Do not move component architecture edits into markdown only.
- Do not delete empty arrays or optional fields just to simplify the file.
- Do not rename keys such as \`note\` to \`notes\` unless the schema already uses that exact field in that exact section.
`;
  };

  const buildLlmGuideContent = (workspace: FeatureWorkspace, markdown: string): string => {
    const baseName = buildWorkspaceBaseName(workspace);
    return `# AGENTS.md

## Purpose

This file tells Codex or another coding/design assistant how to edit the synced ArchFlow files safely so they can be pulled back into ArchFlow without breaking the workspace.

The goal is not to generate arbitrary documents.
The goal is to make structured, incremental design edits that still conform to ArchFlow's workspace model.

## Workspace Files

Use these files together:

### \`${baseName}.workspace.json\`
- Structured ArchFlow workspace export.
- This is the canonical source of truth for the design model.
- It contains feature definition, components, internal objects, interactions, states, and detailed editor data.

### \`${baseName}.md\`
- Human-readable design summary.
- Use this for quick orientation before reading the JSON.
- It may be easier to review, but it is derived output.

### \`ARCHFLOW_EDIT_TEMPLATE.md\`
- Concrete editing examples for each workspace section.
- Use this when you need an exact reference for valid JSON shapes and allowed values.
- Follow this template when editing the synced workspace files.

## File Ownership Rules

- Treat \`${baseName}.workspace.json\` as the only full-fidelity editable source.
- Treat \`${baseName}.md\` as a limited feature-definition edit surface.
- Do not use \`${baseName}.md\` to redesign component structure, object structure, interactions, or states.
- Do not edit \`AGENTS.md\` unless the user explicitly asks to change the agent instructions.
- If markdown and JSON disagree, trust and edit the JSON.

## Design View Meaning

Use the correct design view for the correct kind of change:

- Feature definition = feature intent, requirements, constraints, responsibilities
- Component design = logical responsibilities and boundaries
- Object/state design = internal behavior inside one component
- Sequence design = step-by-step scenario flow
- Runtime / deployment design = execution topology

Important distinction:

- Component design is not code structure.
- Runtime / deployment design is not code structure either.
- Runtime / deployment design shows what actually runs and how runtime nodes communicate.

Runtime / deployment examples:

- task
- thread
- ISR
- timer
- queue
- mutex
- peripheral
- service
- device

Use runtime / deployment design when the question is:

- where does this behavior execute?
- what task/thread/ISR/service owns it?
- what runtime resource carries the communication?

## Working Rules

- Read this file first.
- Read \`${baseName}.md\` next for fast understanding.
- Read \`${baseName}.workspace.json\` after that for exact structure and field-level truth.
- Read \`ARCHFLOW_EDIT_TEMPLATE.md\` before making JSON edits.
- If markdown and JSON differ, trust the JSON.
- Keep suggestions incremental and practical.
- Preserve the user's intent and vocabulary.
- Prefer identifying gaps, ambiguities, and weak boundaries over rewriting the whole design.
- Do not invent domain facts that are not supported by the files.
- Treat diagrams and markdown as derived views, not the source of truth.
- Prefer small edits over large rewrites.
- Preserve existing IDs whenever an item still represents the same thing.
- Do not delete fields just because they are empty or unfamiliar.
- Do not rename schema keys.
- Do not add comments, trailing commas, or non-JSON syntax to the JSON file.

## Strict JSON Editing Contract

When editing \`${baseName}.workspace.json\`, follow these rules strictly:

- Keep the file as valid JSON.
- Keep the top-level object shape intact.
- Preserve existing object IDs, component IDs, interaction IDs, scenario IDs, node IDs, and link IDs unless the item is being intentionally replaced.
- If you add a new item to a list, create a new ID string and keep the existing IDs unchanged.
- Preserve unknown fields if they already exist.
- Preserve array structure for fields that are already arrays.
- Preserve object structure for fields that are already objects.
- Do not convert arrays into paragraphs or paragraphs into arrays.
- Do not collapse nested workspace data into summary text.
- Do not remove empty arrays or empty strings just to "clean up" the file.
- Only change values that are relevant to the requested design update.

## Strict Markdown Editing Contract

When editing \`${baseName}.md\`, assume ArchFlow only re-imports feature-definition content from it.

Safe markdown edits:

- feature title
- feature summary
- feature requirements
- constraints
- responsibilities
- assumptions
- open questions

Unsafe markdown edits for round-trip purposes:

- component definitions
- internal object definitions
- component interactions
- state machine structure
- runtime structure
- data flow structure

If the requested change affects architecture, components, objects, interactions, or state, edit the JSON instead of the markdown.

## Preferred Edit Strategy

1. Read \`${baseName}.md\` for quick understanding.
2. Read \`${baseName}.workspace.json\` for the real editable structure.
3. Decide whether the requested change belongs in markdown, JSON, or both.
4. For architecture/detail changes, edit JSON first.
5. Only edit markdown when the change is part of feature-definition text.
6. Keep JSON and markdown semantically aligned when both are updated.

## Workspace Section Edit Map

Use this map to decide exactly where to edit.

### 1. Feature definition

Use markdown and JSON together only for feature-definition content.

Primary JSON fields:

- \`title\`
- \`requirement\`
- \`featureSummary.summary\`
- \`featureSummary.goals\`
- \`featureSummary.constraints\`
- \`featureSummary.assumptions\`
- \`featureSummary.openQuestions\`
- \`discovery.responsibilities\`

Use this section for:

- feature name
- feature summary
- requirements
- constraints
- responsibilities
- assumptions
- open questions

### 2. Candidate components

Primary JSON field:

- \`discovery.candidateComponents\`

Each item should keep:

- \`id\`
- \`name\`
- \`responsibility\`
- \`rationale\`

Use this section for:

- adding or refining high-level components
- adjusting component names
- refining component responsibility wording
- improving rationale for why a component exists

### 3. Component interactions

Primary JSON field:

- \`discovery.interactions\`

Each item should keep:

- \`fromComponentId\`
- \`toComponentId\`
- \`mechanism\`
- \`data\`
- \`notes\`

Use this section for:

- who talks to whom
- what data is exchanged
- what interaction mechanism is used

Do not replace component IDs with names in this section.

### 4. Component details

Primary JSON field:

- \`components\`

Each component should keep:

- \`id\`
- \`name\`
- \`summary\`
- \`inputs\`
- \`outputs\`
- \`incomingEvents\`
- \`internalSignals\`
- \`outgoingSignals\`
- \`objects\`
- \`objectInteractions\`
- \`ownership\`
- \`failureModes\`
- \`debugging\`

Use this section for:

- refining one component in detail
- defining inputs/outputs/events/signals
- ownership and failure-mode detail
- logging, traces, and observability notes

### 5. Internal objects inside a component

Primary JSON field:

- \`components[].objects\`

Each object should keep:

- \`id\`
- \`name\`
- \`responsibility\`
- \`objectType\`
- \`needsState\`
- \`states\`

Use this section for:

- defining internal objects before state design
- deciding active vs passive objects
- deciding whether an object needs state

Valid intent:

- add a new object
- refine object responsibility
- change \`objectType\` between \`active\` and \`passive\`
- set \`needsState\`

### 6. Internal object interactions

Primary JSON field:

- \`components[].objectInteractions\`

Each item should keep:

- \`fromObjectId\`
- \`toObjectId\`
- \`relationship\`
- \`notes\`

Use this section for:

- object-to-object collaboration inside one component
- control flow or information flow between internal objects

Do not use object names in place of object IDs here.

### 7. Object state diagrams

Primary JSON field:

- \`components[].objects[].states\`

Each state should keep:

- \`name\`
- \`description\`
- \`transitions\`

Each transition should keep:

- \`event\`
- \`triggerKind\`
- \`targetState\`
- \`action\`

Use this section for:

- adding states for one object
- adding transitions between states
- clarifying transition events and actions

Important:

- state names must be stable strings
- \`targetState\` must point to a real state name in the same object
- do not replace states with free-form prose

### 8. Context diagram

Primary JSON fields:

- \`discovery.contextEntities\`
- \`discovery.contextFlows\`

Use this section for:

- external users, devices, systems, or services
- boundary flows into and out of the feature

### 9. Sequence scenarios

Primary JSON field:

- \`discovery.sequenceScenarios\`

Each scenario should keep:

- \`id\`
- \`name\`
- \`goal\`
- \`trigger\`
- \`outcome\`
- \`failurePath\`
- \`participants\`
- \`steps\`

Each participant should keep:

- \`id\`
- \`name\`
- \`kind\`
- \`description\`

Each step should keep:

- \`id\`
- \`fromParticipantId\`
- \`toParticipantId\`
- \`message\`
- \`type\`
- \`note\`

For sequence step \`type\`, only use:

- \`call\`
- \`async\`
- \`return\`
- \`event\`

Do not invent alternative step types like:

- \`request\`
- \`response\`
- \`message\`

Map them to the valid values above instead.

### 10. Data flow diagram

Primary JSON fields:

- \`discovery.dataFlowNodes\`
- \`discovery.dataFlows\`

Use this section for:

- external entities
- processes
- data stores
- data movement between them

### 11. Runtime / deployment

Primary JSON fields:

- \`discovery.runtimeNodes\`
- \`discovery.runtimeLinks\`

Use this section for:

- MCU/core/task/thread/timer/queue/mutex/service topology
- execution placement
- runtime communication links

This section is for runtime entities, not logical components.

Good runtime nodes:

- UART ISR
- CLI Task
- Command Queue
- LED Task
- DateTime Task
- STM32F4 MCU

Do not blindly copy component names into runtime nodes unless that component is also a real execution node or runtime resource.

### 12. Candidate tasks

Primary JSON field:

- \`discovery.candidateTasks\`

Use this section for:

- candidate execution units
- worker/task ideas
- trigger, priority, and blocking notes

### 13. Custom options

Primary JSON field:

- \`discovery.customOptions\`

Only edit this when you are intentionally adding custom enum-like values for:

- interaction mechanisms
- data flow node kinds
- runtime node kinds
- runtime link kinds
- context entity kinds

Do not edit this section unless needed.

## What Codex Should Help With

- find missing components
- find missing internal objects inside a component
- suggest active objects vs passive objects
- suggest candidate execution units, workers, handlers, or tasks
- suggest clearer interactions between components
- suggest clearer interactions between internal objects
- suggest state candidates, transitions, and triggering events
- identify risks, assumptions, and open questions
- point out inconsistent responsibilities or weak boundaries
- help the user refine the design without replacing it

## What Codex Should Avoid

- do not rewrite the entire architecture unless the user explicitly asks
- do not convert uncertain assumptions into facts
- do not ignore the JSON when markdown is simpler to read
- do not force implementation details too early when the design is still exploratory
- do not collapse feature-level discovery and component-level detail into one step
- do not rewrite IDs for existing entities
- do not remove schema fields that ArchFlow may still need
- do not move detailed architecture into markdown-only prose
- do not edit only markdown when the requested change clearly affects structured design data

## Recommended Review Flow

1. Understand the feature goal from the markdown file.
2. Inspect the JSON structure to verify what is actually defined.
3. Look for missing components, unclear responsibilities, and weak boundaries.
4. Inside each component, look for missing internal objects before deciding active objects and per-object states.
5. When making file edits, prefer structured JSON edits that ArchFlow can pull back safely.
6. Suggest concrete edits the user can apply back into ArchFlow.

## Suggested Prompt For Codex

\`\`\`text
Read AGENTS.md first, then read ${baseName}.md and ${baseName}.workspace.json.

Use the markdown file for overview and the JSON file as the source of truth.
Edit the files in a way that remains re-importable into ArchFlow.
Follow the workspace section edit map in AGENTS.md when deciding what to change.
Use ARCHFLOW_EDIT_TEMPLATE.md as the concrete reference for valid edit shapes.

Help me improve this design incrementally.
Focus on:
- missing components
- missing internal objects
- active vs passive object suggestions
- candidate execution units or tasks
- missing states, transitions, or events
- unclear interactions
- design risks, weak assumptions, or inconsistent boundaries

Do not rewrite the whole design unless I ask.
Preserve schema structure and existing IDs unless a new item is being added.
If the change affects architecture detail, edit the JSON.
If the change only affects feature-definition text, markdown edits are allowed.
For sequence scenarios, use only valid step types: call, async, return, event.
Keep edits concrete so I can pull them back into ArchFlow.
\`\`\`

## Current Feature Context

### Feature Name
${workspace.title || "Untitled Feature"}

### Feature Summary
${workspace.featureSummary.summary || "No feature summary documented yet."}

### Exported Requirement Markdown
\`\`\`md
${markdown}
\`\`\`
`;
  };

  const exportMarkdown = (markdown: string, fileName: string) => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "feature-design"}.md`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const exportWorkspaceJson = (workspace: FeatureWorkspace) => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "feature-workspace"}.workspace.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const syncLlmFiles = async (workspace: FeatureWorkspace, markdown: string) => {
    if (!canSyncWorkspaceFiles()) {
      throw new Error("File sync is only supported in browsers with the File System Access API.");
    }

    const currentFiles = buildCurrentSyncFiles(workspace, markdown);
    await syncWorkspaceFiles({
      workspaceId: workspace.id,
      manifest: {
        workspaceJson: `${currentFiles.baseName}.workspace.json`,
        markdown: `${currentFiles.baseName}.md`,
        agents: "AGENTS.md",
      },
      files: [
        {
          name: `${currentFiles.baseName}.workspace.json`,
          content: currentFiles.workspaceJson,
          type: "application/json;charset=utf-8",
        },
        {
          name: `${currentFiles.baseName}.md`,
          content: currentFiles.markdown,
          type: "text/markdown;charset=utf-8",
        },
        {
          name: `AGENTS.md`,
          content: currentFiles.agents,
          type: "text/markdown;charset=utf-8",
        },
        {
          name: `ARCHFLOW_EDIT_TEMPLATE.md`,
          content: currentFiles.editTemplate,
          type: "text/markdown;charset=utf-8",
        },
      ],
    });
  };

  const inspectLlmSync = async (workspace: FeatureWorkspace, markdown: string) => {
    const currentFiles = buildCurrentSyncFiles(workspace, markdown);
    return inspectWorkspaceFiles({
      workspaceId: workspace.id,
      fallbackBaseName: currentFiles.baseName,
      currentFiles: {
        workspaceJson: hashString(currentFiles.workspaceJson),
        markdown: hashString(currentFiles.markdown),
        agents: hashString(currentFiles.agents),
      },
    });
  };

  const pullSyncedLlmFiles = async (workspace: FeatureWorkspace) => {
    if (!canSyncWorkspaceFiles()) {
      throw new Error("File sync is only supported in browsers with the File System Access API.");
    }

    const pulled = await pullWorkspaceFiles({
      workspaceId: workspace.id,
      fallbackBaseName: buildWorkspaceBaseName(workspace),
    });

    let nextWorkspace = workspace;
    if (pulled.workspaceJson) {
      const parsed = JSON.parse(pulled.workspaceJson.content) as FeatureWorkspace;
      const normalized = normalizeImportedWorkspace(parsed);
      nextWorkspace = {
        ...normalized,
        id: workspace.id,
        createdAt: workspace.createdAt,
        updatedAt: new Date().toISOString(),
      };
    }

    if (pulled.markdown) {
      nextWorkspace = {
        ...applyImportedMarkdownToWorkspace(
          nextWorkspace,
          pulled.markdown.content,
          pulled.markdown.name,
        ),
        updatedAt: new Date().toISOString(),
      };
    }

    dispatch({
      type: "update",
      workspaceId: workspace.id,
      updater: () => nextWorkspace,
    });

    return pulled;
  };

  const importWorkspaceJson = async (file: File) => {
    const content = await file.text();
    const parsed = JSON.parse(content) as FeatureWorkspace;
    const normalized = normalizeImportedWorkspace(parsed);
    const importedWorkspace: FeatureWorkspace = {
      ...normalized,
      id: `${normalized.id}-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: "create", workspace: importedWorkspace });
  };

  return (
    <AppFrame
      header={
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-copper">System Design Assistant</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">ArchFlow</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate">
              Local-first feature architecture discovery for software, systems, and embedded work, with candidate component mapping, per-component detail editing, and structured design artifacts.
            </p>
          </div>
        </div>
      }
    >
      {activeWorkspace ? (
        <FeatureWorkspacePage
          workspace={activeWorkspace}
          onBack={() => dispatch({ type: "backToDashboard" })}
          onChange={(updater) => {
            dispatch({
              type: "update",
              workspaceId: activeWorkspace.id,
              updater,
            });
          }}
          onExport={exportMarkdown}
          onExportWorkspaceJson={exportWorkspaceJson}
          onSyncLlmFiles={syncLlmFiles}
          onInspectLlmSync={inspectLlmSync}
          onPullLlmFiles={pullSyncedLlmFiles}
        />
      ) : (
        <DashboardPage
          designs={state.workspaces}
          onCreate={() => dispatch({ type: "create", workspace: createEmptyWorkspace() })}
          onOpen={(designId) => dispatch({ type: "open", workspaceId: designId })}
          onRemove={(workspaceId) => dispatch({ type: "remove", workspaceId })}
          onLoadSample={() =>
            dispatch({ type: "create", workspace: createSampleWorkspace() })
          }
          onImportWorkspaceJson={importWorkspaceJson}
        />
      )}
    </AppFrame>
  );
};
