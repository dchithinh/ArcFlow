import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Mermaid is intentionally lazy-loaded and ships a large vendor chunk.
    // Raise the warning threshold so build output focuses on real regressions.
    chunkSizeWarningLimit: 2200,
  },
});
