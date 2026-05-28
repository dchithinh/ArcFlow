# ArchFlow

ArchFlow is a local-first web app for firmware and embedded developers. It turns a rough feature request into a feature workspace where you can discover candidate components, define their relationships, refine one component at a time, and export a structured design draft.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Mermaid
- `localStorage` persistence
- Docker multi-stage build with Node runtime

## Run With Docker

Build the image:

```bash
docker build -t archflow-app .
```

Run the container:

```bash
docker run --rm -p 8080:80 archflow-app
```

Open the app at [http://localhost:8080](http://localhost:8080).

## Enable AI Drafting

AI drafting is optional. The app now supports `OpenAI` and local `Ollama`.

### OpenAI

```bash
docker run --rm -p 8080:80 \
  -e AI_PROVIDER=openai \
  -e OPENAI_API_KEY=your_key_here \
  archflow-app
```

OpenAI environment variables:

- `OPENAI_MODEL`
  Defaults to `gpt-5-mini`

### Ollama

For Docker Desktop on Windows/macOS, this usually works directly:

```bash
docker run --rm -p 8080:80 \
  -e AI_PROVIDER=ollama \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -e OLLAMA_MODEL=gpt-oss \
  archflow-app
```

On Linux, if `host.docker.internal` is not available, pass your host gateway explicitly:

```bash
docker run --rm -p 8080:80 \
  --add-host=host.docker.internal:host-gateway \
  -e AI_PROVIDER=ollama \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -e OLLAMA_MODEL=gpt-oss \
  archflow-app
```

General AI environment variables:

- `AI_PROVIDER`
  `openai` or `ollama`
- `OLLAMA_BASE_URL`
  Defaults to `http://host.docker.internal:11434`
- `OLLAMA_MODEL`
  Defaults to `gpt-oss`
- `PORT`
  Defaults to `80`

The staged AI flow starts from:

- feature name
- feature requirement
- at least one constraint
- at least one responsibility

Then the app uses three smaller AI actions:

- `Generate Discovery Draft`
  Fills summary, problem, goals, assumptions, open questions, actors, candidate components, interactions, candidate tasks, and system risks.
- `Refine Selected Component`
  Fills one component’s detailed design only.
- `Generate Implementation Plan`
  Fills milestones, APIs, and tests from the stabilized workspace.

This keeps prompts smaller, improves local-model reliability, and preserves the same editable workspace model.

You can also use `Import Requirement File` to load a `.md`, `.markdown`, or `.txt` requirement file and prefill:

- feature title from the first `#` heading or filename
- requirement from a `Requirement` or `Feature Requirement` section
- constraints from a `Constraints` section
- responsibilities from a `Responsibilities` section
- optional goals, assumptions, and open questions when those headings are present

An example import file is included at:

- [stm32f4-taskmanager-lvgl-feature.md](/mnt/d/learn/ArchFlow/examples/stm32f4-taskmanager-lvgl-feature.md)

## Current MVP Features

- Dashboard for saved feature workspaces
- Empty feature workspace creation
- Sample UART command-handling workspace
- Discovery-first editor flow
- Candidate component list and interaction mapping
- Candidate RTOS task modeling
- Per-component detail editor
- AI-assisted staged drafting for discovery, component refinement, and implementation planning
- Markdown requirement import for AI input prefill
- Live markdown preview
- Mermaid feature architecture flowchart preview
- Mermaid selected-component state diagram preview
- RTOS task table generation
- Risk review generation
- Markdown export
- Browser `localStorage` persistence

## Notes

- Saved workspaces stay in the browser storage of the machine and browser where the app is opened.
- Without a configured provider, the app still runs normally but AI drafting is disabled.
- The Docker container serves the frontend and a small API endpoint for AI draft generation; user workspace data still stays in browser storage.
