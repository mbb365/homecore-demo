import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/move-assistant-card.js",
      formats: ["es"],
      fileName: () => "move-assistant-card.js",
    },
    outDir: "dist",
    emptyOutDir: true,
    minify: true,
  },
});
