import { createSwaggerSpec } from "next-swagger-doc";

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
      schemas: {
        // Types de base
        Tournament: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Identifiant unique du tournoi",
              example: "12345",
            },
            name: {
              type: "string",
              description: "Nom du tournoi",
              example: "Open de Paris 2024",
            },
            date: {
              type: "string",
              format: "date",
              description: "Date du tournoi au format ISO",
              example: "2024-03-15T00:00:00.000Z",
            },
            endDate: {
              type: "string",
              format: "date",
              description: "Date de fin du tournoi (optionnel)",
              example: "2024-03-17T00:00:00.000Z",
            },
            location: {
              type: "string",
              description: "Ville du tournoi",
              example: "Paris",
            },
            department: {
              type: "integer",
              description: "Numéro du département",
              example: 75,
            },
            type: {
              type: "string",
              description: "Type de tournoi",
              example: "tournoi",
            },
            status: {
              type: "string",
              enum: ["registration", "ongoing", "finished"],
              description: "Statut du tournoi",
              example: "registration",
            },
            maxPlayers: {
              type: "integer",
              description: "Nombre maximum de joueurs",
              example: 64,
            },
            currentPlayers: {
              type: "integer",
              description: "Nombre actuel de joueurs inscrits",
              example: 32,
            },
            registrationDeadline: {
              type: "string",
              format: "date",
              description: "Date limite d'inscription",
              example: "2024-03-10T00:00:00.000Z",
            },
            url: {
              type: "string",
              format: "uri",
              description: "URL vers la fiche du tournoi sur le site FFE",
              example: "https://www.echecs.asso.fr/FicheTournoi.aspx?Ref=12345",
            },
            players: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Player",
              },
              description: "Liste des joueurs inscrits (optionnel)",
            },
          },
          required: [
            "id",
            "name",
            "date",
            "location",
            "department",
            "type",
            "status",
            "url",
          ],
        },
        Player: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Identifiant unique du joueur",
              example: "jean-dupont",
            },
            name: {
              type: "string",
              description: "Nom de famille du joueur",
              example: "Dupont",
            },
            firstName: {
              type: "string",
              description: "Prénom du joueur",
              example: "Jean",
            },
            club: {
              type: "string",
              description: "Club du joueur",
              example: "Club d'Echecs de Paris",
            },
            elo: {
              type: "integer",
              description: "Classement Elo du joueur",
              example: 1650,
            },
            category: {
              type: "string",
              description: "Catégorie du joueur",
              example: "A",
            },
            isRegistered: {
              type: "boolean",
              description: "Indique si le joueur est inscrit au tournoi",
              example: true,
            },
          },
          required: [
            "id",
            "name",
            "firstName",
            "club",
            "elo",
            "category",
            "isRegistered",
          ],
        },
        ApiResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Indique si la requête a réussi",
              example: true,
            },
            data: {
              type: "object",
              description:
                "Données de la réponse (peut être null en cas d'erreur)",
            },
            error: {
              type: "string",
              description:
                "Message d'erreur (présent uniquement si success=false)",
              example: "Tournament not found",
            },
            lastUpdated: {
              type: "string",
              format: "date-time",
              description: "Timestamp de la dernière mise à jour des données",
              example: "2024-03-01T10:30:00.000Z",
            },
          },
          required: ["success", "data", "lastUpdated"],
        },
        TournamentListResponse: {
          type: "object",
          properties: {
            tournaments: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Tournament",
              },
              description: "Liste des tournois",
            },
            total: {
              type: "integer",
              description: "Nombre total de tournois trouvés",
              example: 25,
            },
            department: {
              type: "integer",
              description: "Département recherché (0 si multiple départements)",
              example: 37,
            },
            lastUpdated: {
              type: "string",
              format: "date-time",
              description: "Timestamp de la dernière mise à jour",
              example: "2024-03-01T10:30:00.000Z",
            },
          },
          required: ["tournaments", "total", "department", "lastUpdated"],
        },
        TournamentDetailsResponse: {
          type: "object",
          properties: {
            tournament: {
              $ref: "#/components/schemas/Tournament",
            },
            players: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Player",
              },
              description: "Liste des joueurs inscrits au tournoi",
            },
            lastUpdated: {
              type: "string",
              format: "date-time",
              description: "Timestamp de la dernière mise à jour",
              example: "2024-03-01T10:30:00.000Z",
            },
          },
          required: ["tournament", "players", "lastUpdated"],
        },
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "string",
              description: "Message d'erreur détaillé",
              example: "Invalid department parameter",
            },
            lastUpdated: {
              type: "string",
              format: "date-time",
              description: "Timestamp de l'erreur",
              example: "2024-03-01T10:30:00.000Z",
            },
          },
          required: ["success", "error", "lastUpdated"],
        },
      },
      parameters: {
        Department: {
          name: "department",
          in: "query",
          description: "Numéro du département",
          required: true,
          schema: {
            type: "integer",
            example: 37,
          },
        },
        DepartmentArray: {
          name: "department[]",
          in: "query",
          description: "Numéros des départements (peut être répété)",
          required: true,
          schema: {
            type: "array",
            items: {
              type: "integer",
            },
            example: [37, 41],
          },
        },
        TournamentId: {
          name: "id",
          in: "path",
          description: "Identifiant unique du tournoi",
          required: true,
          schema: {
            type: "string",
            example: "12345",
          },
        },
        Limit: {
          name: "limit",
          in: "query",
          description: "Nombre maximum de résultats à retourner",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 50,
            example: 10,
          },
        },
        Offset: {
          name: "offset",
          in: "query",
          description: "Nombre de résultats à ignorer (pour la pagination)",
          required: false,
          schema: {
            type: "integer",
            minimum: 0,
            default: 0,
            example: 0,
          },
        },
        Next: {
          name: "next",
          in: "query",
          description: "Filtrer pour ne retourner que les événements à venir",
          required: false,
          schema: {
            type: "boolean",
            default: false,
            example: true,
          },
        },
        Club: {
          name: "club",
          in: "query",
          description: "Nom du club pour filtrer les tournois",
          required: false,
          schema: {
            type: "string",
            example: "Club de Paris",
          },
        },
        ShowOnlyClub: {
          name: "showOnlyClub",
          in: "query",
          description:
            "Afficher seulement les tournois où des joueurs du club sont inscrits",
          required: false,
          schema: {
            type: "boolean",
            default: false,
            example: true,
          },
        },
      },
    },
  },
  apiFolder: "src/app/api",
  schemaFolders: ["src/types", "src/_types"],
};

export const getSwaggerSpec = async () => {
  return await createSwaggerSpec(swaggerConfig);
};
