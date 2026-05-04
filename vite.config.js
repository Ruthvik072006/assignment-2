import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/assignment-2/",
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});
