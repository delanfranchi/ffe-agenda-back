import { createSwaggerSpec } from "next-swagger-doc";
import { generateSchemasFromTypes, commonParameters } from "./auto-schemas";

export const swaggerConfig = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FFE Chess Agenda API",
      version: "1.0.0",
      description:
        "API pour récupérer les informations sur les tournois d'échecs FFE",
      contact: {
        name: "Chess Agenda",
        url: "https://github.com/chess-agenda",
      },
    },
    servers: [
      {
        url: process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3012",
        description: "Serveur principal",
      },
    ],
    components: {
      schemas: generateSchemasFromTypes(),
      parameters: commonParameters,
    },
  },
  apiFolder: "src/app/api",
  schemaFolders: ["src/types", "src/_types"],
};

export const getSwaggerSpec = async () => {
  return await createSwaggerSpec(swaggerConfig);
};
