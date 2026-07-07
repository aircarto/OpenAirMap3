import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/setupTests.ts",
    css: true,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules",
        "src/tests",
        "**/*.d.ts",
        "**/*.config.{js,ts}",
      ],
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [
      "crista-unlockable-vivan.ngrok-free.dev",
      "localhost",
      "127.0.0.1",
      ".ngrok-free.dev",
    ],
    proxy: {
      "/aircarto": {
        target: "https://api.aircarto.fr",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aircarto/, ""),
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.log("aircarto proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req) => {
            console.log("Sending Request to AirCarto:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            console.log(
              "Received Response from AirCarto:",
              proxyRes.statusCode,
              req.url
            );
          });
        },
      },
      "/microspot": {
        target: "http://172.16.13.183:3032",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.log("microspot proxy error", err);
          });
          proxy.on("proxyReq", (_proxyReq, req) => {
            console.log("Sending Request to Microspot:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            console.log(
              "Received Response from Microspot:",
              proxyRes.statusCode,
              req.url
            );
          });
        },
      },
    },
  },
});
