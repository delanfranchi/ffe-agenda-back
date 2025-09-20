/**
 * Génération automatique des schémas OpenAPI depuis les types TypeScript
 * Utilise ts-json-schema-generator pour convertir les types en schémas JSON
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

// Types à convertir en schémas OpenAPI
const TYPES_TO_CONVERT = [
  "Tournament",
  "Player",
  "ApiResponse",
  "TournamentListResponse",
  "TournamentDetailsResponse",
];

// Configuration pour ts-json-schema-generator
const SCHEMA_CONFIG = {
  path: "src/types/chess.ts",
  type: "*",
  tsconfig: "tsconfig.json",
  topRef: false,
  expose: "none",
  jsDoc: "extended",
  sortProps: true,
};

/**
 * Génère automatiquement les schémas OpenAPI depuis les types TypeScript
 */
export function generateSchemasFromTypes(): Record<string, unknown> {
  try {
    // Générer un schéma temporaire avec ts-json-schema-generator
    const tempSchemaFile = join(process.cwd(), "temp-schemas.json");

    const command = [
      "ts-json-schema-generator",
      `--path=${SCHEMA_CONFIG.path}`,
      `--type=${SCHEMA_CONFIG.type}`,
      `--tsconfig=${SCHEMA_CONFIG.tsconfig}`,
      `--topRef=${SCHEMA_CONFIG.topRef}`,
      `--expose=${SCHEMA_CONFIG.expose}`,
      `--jsDoc=${SCHEMA_CONFIG.jsDoc}`,
      `--sortProps=${SCHEMA_CONFIG.sortProps}`,
      `--out=${tempSchemaFile}`,
    ].join(" ");

    execSync(command, { stdio: "pipe" });

    // Lire le schéma généré
    const generatedSchema = JSON.parse(readFileSync(tempSchemaFile, "utf-8"));

    // Nettoyer le fichier temporaire
    execSync(`rm -f ${tempSchemaFile}`);

    // Convertir en format OpenAPI
    const openApiSchemas: Record<string, unknown> = {};

    TYPES_TO_CONVERT.forEach((typeName) => {
      if (
        generatedSchema.definitions &&
        generatedSchema.definitions[typeName]
      ) {
        openApiSchemas[typeName] = generatedSchema.definitions[typeName];
      }
    });

    // Ajouter les schémas manquants avec des valeurs par défaut
    if (!openApiSchemas.ApiResponse) {
      openApiSchemas.ApiResponse = {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "object", description: "Données de la réponse" },
          error: { type: "string", description: "Message d'erreur" },
          lastUpdated: {
            type: "string",
            format: "date-time",
            example: "2025-09-20T08:04:23.941Z",
          },
        },
        required: ["success", "data", "lastUpdated"],
      };
    }

    if (!openApiSchemas.Error) {
      openApiSchemas.Error = {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "string",
            description: "Message d'erreur détaillé",
            example: "Invalid parameter",
          },
          lastUpdated: {
            type: "string",
            format: "date-time",
            example: "2025-09-20T08:04:23.941Z",
          },
        },
        required: ["success", "error", "lastUpdated"],
      };
    }

    return openApiSchemas;
  } catch (error) {
    console.warn(
      "⚠️  Échec de la génération automatique des schémas, utilisation des schémas par défaut:",
      error
    );

    // Fallback vers des schémas manuels si la génération automatique échoue
    return getDefaultSchemas();
  }
}

/**
 * Schémas par défaut en cas d'échec de la génération automatique
 */
function getDefaultSchemas(): Record<string, unknown> {
  return {
    Tournament: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Identifiant unique du tournoi",
          example: "68608",
        },
        name: {
          type: "string",
          description: "Nom du tournoi",
          example: "Tournoi Vétérans + 55 ans N°4 2025 - 2026",
        },
        date: {
          type: "string",
          format: "date",
          description: "Date du tournoi au format ISO",
          example: "2026-04-24T00:00:00.000Z",
        },
        endDate: {
          type: "string",
          format: "date",
          description: "Date de fin du tournoi (optionnel)",
          example: "2026-04-26T00:00:00.000Z",
        },
        location: {
          type: "string",
          description: "Ville du tournoi",
          example: "TOURS",
        },
        department: {
          type: "integer",
          description: "Numéro du département",
          example: 37,
        },
        type: {
          type: "string",
          description: "Type de tournoi",
          example: "CVL",
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
          example: "2026-04-10T00:00:00.000Z",
        },
        url: {
          type: "string",
          format: "uri",
          description: "URL vers la fiche du tournoi sur le site FFE",
          example: "https://www.echecs.asso.fr/FicheTournoi.aspx?Ref=68608",
        },
        players: {
          type: "array",
          items: { $ref: "#/components/schemas/Player" },
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
          example: "Club d'Echecs de Tours",
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
          description: "Données de la réponse (peut être null en cas d'erreur)",
        },
        error: {
          type: "string",
          description: "Message d'erreur (présent uniquement si success=false)",
          example: "Tournament not found",
        },
        lastUpdated: {
          type: "string",
          format: "date-time",
          description: "Timestamp de la dernière mise à jour des données",
          example: "2025-09-20T08:04:23.941Z",
        },
      },
      required: ["success", "data", "lastUpdated"],
    },

    TournamentListResponse: {
      type: "object",
      properties: {
        tournaments: {
          type: "array",
          items: { $ref: "#/components/schemas/Tournament" },
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
          example: "2025-09-20T08:04:23.941Z",
        },
      },
      required: ["tournaments", "total", "department", "lastUpdated"],
    },

    TournamentDetailsResponse: {
      type: "object",
      properties: {
        tournament: { $ref: "#/components/schemas/Tournament" },
        players: {
          type: "array",
          items: { $ref: "#/components/schemas/Player" },
          description: "Liste des joueurs inscrits au tournoi",
        },
        lastUpdated: {
          type: "string",
          format: "date-time",
          description: "Timestamp de la dernière mise à jour",
          example: "2025-09-20T08:04:23.941Z",
        },
      },
      required: ["tournament", "players", "lastUpdated"],
    },

    Error: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        error: {
          type: "string",
          description: "Message d'erreur détaillé",
          example: "Invalid department parameter",
        },
        lastUpdated: {
          type: "string",
          format: "date-time",
          description: "Timestamp de l'erreur",
          example: "2025-09-20T08:04:23.941Z",
        },
      },
      required: ["success", "error", "lastUpdated"],
    },
  };
}

// Paramètres réutilisables
export const commonParameters = {
  Department: {
    name: "department",
    in: "query",
    description: "Numéro du département",
    required: true,
    schema: { type: "integer", example: 37 },
  },
  DepartmentArray: {
    name: "department[]",
    in: "query",
    description: "Numéros des départements (peut être répété)",
    required: true,
    schema: { type: "array", items: { type: "integer" }, example: [37, 41] },
  },
  TournamentId: {
    name: "id",
    in: "path",
    description: "Identifiant unique du tournoi",
    required: true,
    schema: { type: "string", example: "68608" },
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
    schema: { type: "integer", minimum: 0, default: 0, example: 0 },
  },
  Next: {
    name: "next",
    in: "query",
    description: "Filtrer pour ne retourner que les événements à venir",
    required: false,
    schema: { type: "boolean", default: false, example: true },
  },
  Club: {
    name: "club",
    in: "query",
    description: "Nom du club pour filtrer les tournois",
    required: false,
    schema: { type: "string", example: "Club de Tours" },
  },
  ShowOnlyClub: {
    name: "showOnlyClub",
    in: "query",
    description:
      "Afficher seulement les tournois où des joueurs du club sont inscrits",
    required: false,
    schema: { type: "boolean", default: false, example: true },
  },
};
