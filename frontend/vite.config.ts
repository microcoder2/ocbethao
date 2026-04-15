import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(async ({ command }) => {
  const plugins = [vue()];

  if (command === "serve") {
    const { default: VueDevTools } = await import("vite-plugin-vue-devtools");
    plugins.unshift(VueDevTools());
  }

  return {
    plugins,
    server: {
      host: "0.0.0.0",
      port: 5174,
    },
    preview: {
      host: "0.0.0.0",
      port: 4174,
    },
  };
});
