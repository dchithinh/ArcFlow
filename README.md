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

Start or restart Ollama on the host machine first.

On Windows PowerShell:

```powershell
ollama serve
```

Verify that Ollama is running:

```powershell
curl -UseBasicParsing http://localhost:11434/api/tags
ollama list
```

If your preferred model is not installed yet:

```powershell
ollama pull qwen2.5-coder:7b
```

After a reboot, run `ollama serve` again if Ollama is not already running in the background.

For Docker Desktop on Windows/macOS, this usually works directly:

```bash
docker run --rm -p 8080:80 \
  -e AI_PROVIDER=ollama \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -e OLLAMA_MODEL=gpt-oss \
  archflow-app
```

If `host.docker.internal` is not available inside the container, pass your host gateway explicitly:

```bash
docker run --rm -p 8080:80 \
  --add-host=host.docker.internal:host-gateway \
  -e AI_PROVIDER=ollama \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -e OLLAMA_MODEL=gpt-oss \
  archflow-app
```

If Docker still cannot reach Ollama, use the host machine IP directly:

```bash
docker run --rm -p 8080:80 \
  -e AI_PROVIDER=ollama \
  -e OLLAMA_BASE_URL=http://YOUR_HOST_IP:11434 \
  -e OLLAMA_MODEL=qwen2.5-coder:7b \
  archflow-app
```

On WSL, you can usually find the Windows host IP with:

```bash
ip route | awk '/default/ {print $3}'
```

Then test connectivity before starting ArchFlow:

```bash
curl http://YOUR_HOST_IP:11434/api/tags
```

General AI environment variables:

- `AI_PROVIDER`
  `openai` or `ollama`
- `OLLAMA_BASE_URL`
  Base URL of the Ollama HTTP API as seen from inside the ArchFlow container.
  Examples:
  - `http://host.docker.internal:11434`
  - `http://172.26.112.1:11434`
- `OLLAMA_MODEL`
  Name of the Ollama model to use, for example `qwen2.5-coder:7b`
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

For exact cross-PC round-trip of a full workspace, use:

- `Export Workspace JSON` from the workspace page
- `Import Workspace JSON` from the dashboard

The markdown preview/export is now feature-definition-only and is intended for human-readable requirement sharing, not full workspace restoration.

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
- Live feature-requirement markdown preview
- Mermaid feature architecture flowchart preview
- Mermaid selected-component state diagram preview
- RTOS task table generation
- Risk review generation
- Requirement markdown export
- Workspace JSON export/import
- Browser `localStorage` persistence

## Notes

- Saved workspaces stay in the browser storage of the machine and browser where the app is opened.
- Without a configured provider, the app still runs normally but AI drafting is disabled.
- The Docker container serves the frontend and a small API endpoint for AI draft generation; user workspace data still stays in browser storage.
