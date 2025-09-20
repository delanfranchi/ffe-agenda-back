import { ApiReference } from "@scalar/nextjs-api-reference";

const config = {
  url: "/api/docs",
  theme: "default",
  layout: "modern",
  hideDownloadButton: false,
  hideTryItPanel: false,
  hideServers: false,
  hideModels: false,
  hideSchema: false,
  hideAuthentication: true,
  metaData: {
    title: "FFE Chess Agenda API",
    description:
      "API pour récupérer les informations sur les tournois d'échecs FFE",
    contact: {
      name: "Chess Agenda",
      url: "https://github.com/chess-agenda",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
};

export const GET = ApiReference(config);
