import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Testing mode: sign in on localhost without the email code (dev server only;
// see the file). Remove before launch.
import { directSignin } from "./scripts/dev-direct-signin.mjs";

export default defineConfig({
  plugins: [react(), directSignin()],
  server: {
    port: 5173,
    open: true,
  },
});
