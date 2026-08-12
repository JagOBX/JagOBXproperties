import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The site is served by GitHub Pages from the docs/ folder on main, so that is
// where the build output goes. Everything in docs/ is generated — never edit it
// by hand; edit src/App.jsx and let the build (or the GitHub Action) rewrite it.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "docs",
    emptyOutDir: false, // keeps CNAME, favicon.svg, og-image.jpg in place
    assetsInlineLimit: 0,
  },
});

