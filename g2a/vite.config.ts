import { defineConfig } from "vite";
export default defineConfig({
  root: "g2a",
  publicDir: "../public",
  base: "./",
  build: {
    target: "es2022",
    outDir: "../dist-g2a",
    emptyOutDir: true,
    chunkSizeWarningLimit: 720,
  },
});
