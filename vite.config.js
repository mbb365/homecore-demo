import { defineConfig } from "vite";

// A plain static site. Relative paths so it works from any folder (GitHub Pages serves it under /homecore-demo/).
export default defineConfig({
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
});
