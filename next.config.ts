import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration pour corriger l'avertissement workspace root
  turbopack: {
    root: __dirname,
  },

  // Configuration TypeScript pour ignorer les erreurs dans node_modules
  typescript: {
    ignoreBuildErrors: true,
  },

  // Configuration pour le port par défaut
  env: {
    PORT: process.env.PORT || "3012",
  },

  // Configuration pour les API routes
  async headers() {
    return [
      {
        source: "/api/tournaments",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Cache-Control",
            value: "public, s-maxage=36000, stale-while-revalidate=72000",
          },
        ],
      },
      {
        source: "/api/tournaments/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Cache-Control",
            value: "public, s-maxage=25200, stale-while-revalidate=50400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
