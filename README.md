# ArchFlow

ArchFlow is a local-first web app for firmware and embedded developers. It turns a rough feature request into a feature workspace where you can discover candidate components, define their relationships, refine one component at a time, and export a structured design draft.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Mermaid
- `localStorage` persistence
- Docker multi-stage build with Nginx runtime

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

## Current MVP Features

- Dashboard for saved feature workspaces
- Empty feature workspace creation
- Sample UART command-handling workspace
- Discovery-first editor flow
- Candidate component list and interaction mapping
- Candidate RTOS task modeling
- Per-component detail editor
- Live markdown preview
- Mermaid feature architecture flowchart preview
- Mermaid selected-component state diagram preview
- RTOS task table generation
- Risk review generation
- Markdown export
- Browser `localStorage` persistence

## Notes

- Saved workspaces stay in the browser storage of the machine and browser where the app is opened.
- The Docker container serves the built frontend only; it does not store user data itself.
