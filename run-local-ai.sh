#!/usr/bin/env bash
set -euo pipefail

export OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5-coder:7b}"

docker compose up --build
