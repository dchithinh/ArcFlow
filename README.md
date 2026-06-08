# ArchFlow

ArchFlow is a local-first web app for system and feature design. It turns a rough feature request into a feature workspace where you can discover candidate components, define their relationships, refine one component at a time, and export a structured design draft.

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

## Run With Docker Compose And Built-In Ollama

If you want ArchFlow and a local Ollama model in one Docker stack, use the bundled [compose.yaml](/mnt/d/learn/ArchFlow/compose.yaml).

Set the model you want, then start the stack:

```bash
OLLAMA_MODEL=qwen2.5-coder:7b docker compose up --build
```

Or use the bundled helper script:

```bash
bash run-local-ai.sh
```

Override the model if needed:

```bash
OLLAMA_MODEL=gpt-oss bash run-local-ai.sh
```

Open the app at [http://localhost:8080](http://localhost:8080).

What this stack does:

- starts `archflow`
- starts `ollama`
- automatically pulls the model named by `OLLAMA_MODEL`
- wires ArchFlow to `http://ollama:11434` inside the Docker network

Useful compose environment variables:

- `OLLAMA_MODEL`
  Model name to pull and use, for example `qwen2.5-coder:7b`
- `ARCHFLOW_PORT`
  Host port for the app, defaults to `8080`
- `OLLAMA_PORT`
  Host port exposed for the Ollama API, defaults to `11434`

Examples:

```bash
OLLAMA_MODEL=qwen2.5-coder:7b docker compose up --build
ARCHFLOW_PORT=8081 OLLAMA_MODEL=gpt-oss docker compose up --build
```

Notes:

- the first run can take a while because the model must be downloaded
- models are stored in the Docker volume `ollama-data`, so later runs reuse them
- for CPU-only machines, choose a model size your system can handle comfortably
- to stop the stack:

```bash
docker compose down
```

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

You have two Ollama options:

1. Use the built-in Docker Compose stack above.
2. Run Ollama separately on the host and point ArchFlow to it.

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

Then the app uses smaller AI actions:

- `Generate Discovery Draft`
  Fills summary, problem, assumptions, open questions, actors, candidate components, interactions, candidate tasks, and system risks.
- `Refine Selected Component`
  Fills one component’s detailed design only.

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
- Candidate task / execution-unit modeling
- Per-component detail editor
- AI-assisted staged drafting for definition, discovery, and component refinement
- Markdown requirement import for AI input prefill
- Live feature-requirement markdown preview
- Mermaid feature architecture flowchart preview
- Mermaid selected-component state diagram preview
- Floating design chat with workspace and component scope
- Requirement markdown export
- Workspace JSON export/import
- Browser `localStorage` persistence

## Notes

- Saved workspaces stay in the browser storage of the machine and browser where the app is opened.
- Without a configured provider, the app still runs normally but AI drafting is disabled.
- The Docker container serves the frontend and a small API endpoint for AI draft generation; user workspace data still stays in browser storage.
