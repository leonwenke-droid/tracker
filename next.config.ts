import type { NextConfig } from "next";
import withPWA from "next-pwa";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Silence Next 16 Turbopack+webpack-plugin warning (next-pwa uses webpack)
  turbopack: {},
};

export default withPWA({
  dest: "public",
  disable: isDev,
  register: true,
  skipWaiting: true,
  buildExcludes: [/middleware-manifest\.json$/],
  fallbacks: {
    document: "/offline.html",
  },
})(nextConfig);
