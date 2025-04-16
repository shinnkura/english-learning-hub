import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Function to find an available port
const findPort = async (startPort: number): Promise<number> => {
  const net = await import("node:net");

  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => {
        resolve(false);
      });
      server.once("listening", () => {
        server.close();
        resolve(true);
      });
      server.listen(port, "0.0.0.0");
    });
  };

  for (let port = startPort; port < startPort + 10; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error("利用可能なポートが見つかりませんでした");
};

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "lucide-react",
      "@supabase/supabase-js",
      "@supabase/postgrest-js",
    ],
  },
  build: {
    rollupOptions: {
      output: {
        format: "es",
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name) {
            if (/\.(gif|jpe?g|png|svg)$/.test(assetInfo.name)) {
              return "assets/images/[name]-[hash][extname]";
            }
          }
          return "assets/[name]-[hash].[ext]";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api/captions": {
        target: `http://127.0.0.1:3001`,
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 120000,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, res) => {
            console.log("proxy error", err);
            if (!res.headersSent) {
              res.writeHead(500, {
                "Content-Type": "application/json",
              });
              res.end(
                JSON.stringify({
                  error: "字幕の取得に失敗しました。もう一度お試しください。",
                })
              );
            }
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            // Remove potentially problematic headers
            proxyReq.removeHeader("origin");
            proxyReq.removeHeader("referer");
          });
        },
      },
    },
    host: true,
    port: 5173,
    hmr: {
      timeout: 120000,
      clientPort: 5173,
    },
    fs: {
      // Markdownファイルを含むディレクトリを許可
      allow: [".."],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 静的ファイルの設定
  publicDir: "public",
  assetsInclude: ["**/*.md"],
});
