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

export default defineConfig(async () => {
  // Find available port for the backend server
  const backendPort = await findPort(3001);

  return {
    plugins: [react()],
    optimizeDeps: {
      include: [
        "lucide-react",
        "@supabase/supabase-js",
        "@supabase/postgrest-js",
      ],
    },
    server: {
      proxy: {
        "/api/transcript": {
          target: `http://127.0.0.1:3001`,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) =>
            path.replace(/^\/api\/transcript/, "/api/captions"),
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

              // Add necessary headers
              proxyReq.setHeader(
                "X-Forwarded-For",
                req.socket.remoteAddress || ""
              );
              proxyReq.setHeader("X-Forwarded-Proto", "http");
              proxyReq.setHeader("X-Forwarded-Host", req.headers.host || "");
              proxyReq.setHeader("Accept", "application/json");
              proxyReq.setHeader("Host", `127.0.0.1:3001`);
            });
            proxy.on("proxyRes", (proxyRes, _req, res) => {
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");

              if (proxyRes.statusCode >= 400) {
                let body = "";
                proxyRes.on("data", (chunk) => {
                  body += chunk;
                });
                proxyRes.on("end", () => {
                  try {
                    const parsedBody = JSON.parse(body);
                    res.end(JSON.stringify(parsedBody));
                  } catch (e) {
                    res.end(
                      JSON.stringify({
                        error:
                          "字幕の取得に失敗しました。もう一度お試しください。",
                      })
                    );
                  }
                });
              }
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
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
        },
      },
    },
    // 静的ファイルの設定
    publicDir: "public",
    assetsInclude: ["**/*.md"],
  };
});
