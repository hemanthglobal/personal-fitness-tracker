import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";

// Relative base: the same build works at https://user.github.io/repo/ and at a custom domain root.
// Override with BASE_PATH (e.g. "/") if you ever need absolute URLs.
export default defineConfig({
  base: process.env.BASE_PATH ?? "./",
  plugins: [tailwindcss()],
  server: { port: 5173, strictPort: true },
  test: { include: ["tests/**/*.test.ts"] },
});
