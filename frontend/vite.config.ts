import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "auth-vendor": ["@azure/msal-browser", "@azure/msal-react"],
          "data-vendor": ["@reduxjs/toolkit", "@tanstack/react-query", "axios", "react-redux"],
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": [
            "@radix-ui/react-slot",
            "class-variance-authority",
            "framer-motion",
            "lucide-react",
          ],
        },
      },
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
    },
  },
});
