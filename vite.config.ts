import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Injects <meta name="app-version" content="..."> into index.html at build time
// so the running client can compare against the version that is actually
// deployed (not just what's stored in the database).
const injectVersionMeta = (version: string): Plugin => ({
  name: "inject-app-version-meta",
  transformIndexHtml(html) {
    return html.replace(
      "</head>",
      `  <meta name="app-version" content="${version}" />\n  </head>`
    );
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const version = env.VITE_APP_VERSION || "1.0.0.0";
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      injectVersionMeta(version),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
