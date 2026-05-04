import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Builds a single-file IIFE bundle: dist/widget.js
// Upload this file to https://widget.fuqah.net/widget.js
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    target: "es2019",
    lib: {
      entry: path.resolve(__dirname, "src/main.tsx"),
      name: "FuqahWidget",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        // CSS gets inlined into the JS via the entry import
      },
    },
  },
});