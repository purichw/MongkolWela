import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
export default defineConfig({
  output: "static",
  compressHTML: true,
  adapter: vercel(),
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
