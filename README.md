
# ArchFlow

ArchFlow is a local-first web app for turning rough ideas, requirements, and feature requests into structured design workspaces.

This project came out of a common design struggle: ideas usually arrive as messy notes, half-formed requirements, chat threads, or scattered documents, but the actual design work needs structure. In practice, a lot of time gets lost trying to translate vague intent into clear responsibilities, component boundaries, interactions, states, and diagrams. It is easy to jump straight into drawing boxes or writing code before the design is stable, and that usually leads to churn.

ArchFlow was created to make that early design phase less fragile. The goal is to give a workspace where a rough request can evolve into a coherent design model step by step, while keeping diagrams, text, and design detail connected to the same underlying source of truth.

It helps turn a rough feature request into a structured design workspace where you can:

- define feature requirements and responsibilities
- model context and external boundaries
- discover candidate components and interactions
- refine component boundaries and state behavior
- capture runtime scenarios, data flow, and deployment/runtime structure
- export a readable markdown design draft

ArchFlow is designed so the workspace data is the source of truth and diagrams are derived views, not hand-maintained artifacts.


[![ArcFlow View](https://github.com/dchithinh/ArcFlow/blob/master/docs/demo/ArcFlow_Anim.gif)](https://youtu.be/dDsLkX8JQ_E)


## Why ArchFlow

Design work often starts from incomplete notes, chat messages, or requirement fragments. The hard part is usually not drawing a diagram. It is deciding:

- what the feature must do
- what responsibilities belong inside the feature
- what components should exist
- how they interact
- what states, flows, scenarios, or runtime structure they need

ArchFlow keeps that design work editable and structured before code exists.

## Highlights

- Local-first workspace editing with browser persistence
- Feature definition and feature design workflow
- Context diagram
- Component / container diagram
- Feature architecture flowchart
- Data flow diagram
- Behavioral architecture diagram
- Component state diagram
- Sequence diagram
- Deployment / runtime diagram
- Markdown export
- Workspace JSON export/import
- Optional AI-assisted drafting with OpenAI or Ollama

## Requirements

For container-based usage:

- Docker Desktop or Docker Engine
- Docker Compose

For local AI with Ollama:

- enough disk and memory for your selected model

## Quick Start

### Option 1: Run Without AI assistant

If you don't need AI to generate draft feature, not need to fill your own components, interaction, etc.
Build the image:

```bash
docker build -t archflow-app .
```

Run it:

```bash
docker run --rm -p 8080:80 archflow-app
```

Open [http://localhost:8080](http://localhost:8080).


### Option 2: Run With AI Assistant

#### Local LLM
Start the full stack:

```bash
./run-local-ai.sh
```

Or explicitly:

```bash
OLLAMA_MODEL=qwen2.5-coder:7b docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080).

Useful environment variables:

- `OLLAMA_MODEL`
  Model to pull and use, for example `qwen2.5-coder:7b`
- `ARCHFLOW_PORT`
  Host port for ArchFlow, default `8080`
- `OLLAMA_PORT`
  Host port for the Ollama API, default `11434`

Examples:

```bash
OLLAMA_MODEL=qwen2.5-coder:7b ./run-local-ai.sh
ARCHFLOW_PORT=8081 OLLAMA_PORT=11435 OLLAMA_MODEL=qwen2.5:3b ./run-local-ai.sh
```

Stop the stack:

```bash
docker compose down
```

#### OpenAI

Run the container with:

```bash
docker run --rm -p 8080:80 \
  -e AI_PROVIDER=openai \
  -e OPENAI_API_KEY=your_key_here \
  archflow-app
```

Optional variables:

- `OPENAI_MODEL`
  Default: `gpt-5-mini`

General AI environment variables:

- `AI_PROVIDER`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `PORT`

## Current Workflow

### Feature Definition

Use this stage to define:

- feature name
- feature summary
- feature requirements
- feature responsibilities
- constraints
- assumptions
- open questions

### Feature Design

Use this stage to model and refine:

- context entities and boundary flows
- component / container structure
- component interactions
- data flow nodes and edges
- component states
- runtime scenarios
- deployment / runtime structure

The generated diagrams update from the workspace data.

## Import And Export

### Requirement Import

You can import `.md`, `.markdown`, or `.txt` requirement files from the workspace.

The importer can prefill:

- feature title
- summary
- requirements
- constraints
- responsibilities
- assumptions
- open questions

### Markdown Export

ArchFlow can export a human-readable markdown design draft from the current workspace.

### Workspace JSON Export / Import

Use workspace JSON when you want full-fidelity round-trip of the design data between machines or browsers.

## Notes

- Workspaces are stored in browser `localStorage`
- Generated outputs are derived from workspace state
- Without AI configuration, all manual editing still works normally
- First-time Ollama runs can take a while because the model must be pulled
- Docker model data is stored in the `ollama-data` volume

## Development Notes

- The canonical source of truth is the workspace schema, not the Mermaid text
- The workspace page is the main integration surface
- Diagram rendering is intentionally derived from normalized workspace data

