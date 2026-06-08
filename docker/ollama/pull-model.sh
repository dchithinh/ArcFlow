#!/bin/sh
set -eu

MODEL="${OLLAMA_MODEL:-qwen2.5-coder:7b}"
HOST="${OLLAMA_HOST:-http://ollama:11434}"

echo "Waiting for Ollama at ${HOST}..."
attempts=0
until ollama list >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 60 ]; then
    echo "Ollama did not become ready in time."
    exit 1
  fi
  sleep 2
done

echo "Pulling model: ${MODEL}"
ollama pull "${MODEL}"
echo "Model ready: ${MODEL}"
