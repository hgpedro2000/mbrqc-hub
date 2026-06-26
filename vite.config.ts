import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const injectVersionMeta = (version: string): Plugin => ({
  name: "inject-app-version-meta",
  transformIndexHtml(html) {
    const meta = `<meta name="app-version" content="${version}" />`;
    if (html.match(/<meta\s+name=["']app-version["'][^>]*>/i)) {
      return html.replace(
        /<meta\s+name=["']app-version["'][^>]*>/i,
        meta
      );
    }

    return html.replace(
      "</head>",
      `  ${meta}\n  </head>`
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
