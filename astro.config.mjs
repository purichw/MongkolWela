import { defineConfig } from "astro/config";
export default defineConfig({
  output: "static",
  devToolbar: {
    enabled: false
  },
  vite: {
    server: {
      watch: {
        ignored: ["**/playwright-report/**", "**/test-results/**"]
      }
    }
  }
});
