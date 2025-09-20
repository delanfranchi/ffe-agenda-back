import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration pour corriger l'avertissement workspace root
  turbopack: {
    root: __dirname,
  },

  // Configuration pour le port par défaut
  env: {
    PORT: process.env.PORT || "3012",
  },

  // Configuration pour les API routes
  async headers() {
    return [
      {
        source: "/api/(.*)",
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
        ],
      },
    ];
  },
};

export default nextConfig;
