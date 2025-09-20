import {
  Tournament,
  Player,
  ApiResponse,
  TournamentListResponse,
  TournamentDetailsResponse,
  ChessAgendaProps,
} from "@/types/chess";

/**
 * Utilitaire pour exporter les types TypeScript vers des schémas OpenAPI
 * Cela permet de maintenir la cohérence entre les types TypeScript et la documentation OpenAPI
 */

export interface TypeExporterOptions {
  includeExamples?: boolean;
  includeDescriptions?: boolean;
}

/**
 * Convertit un type TypeScript en schéma OpenAPI
 */
export class TypeExporter {
  private options: TypeExporterOptions;

  constructor(options: TypeExporterOptions = {}) {
    this.options = {
      includeExamples: true,
      includeDescriptions: true,
      ...options,
    };
  }

  /**
   * Exporte tous les types principaux de l'API
   */
  exportAllTypes() {
    return {
      Tournament: this.exportTournamentType(),
      Player: this.exportPlayerType(),
      ApiResponse: this.exportApiResponseType(),
      TournamentListResponse: this.exportTournamentListResponseType(),
      TournamentDetailsResponse: this.exportTournamentDetailsResponseType(),
      ChessAgendaProps: this.exportChessAgendaPropsType(),
    };
  }

  /**
   * Exporte le type Tournament
   */
  exportTournamentType() {
    return {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Identifiant unique du tournoi",
          ...(this.options.includeExamples && { example: "12345" }),
        },
        name: {
          type: "string",
          description: "Nom du tournoi",
          ...(this.options.includeExamples && {
            example: "Open de Paris 2024",
          }),
        },
        date: {
          type: "string",
          format: "date",
          description: "Date du tournoi au format ISO",
          ...(this.options.includeExamples && {
            example: "2024-03-15T00:00:00.000Z",
          }),
        },
        endDate: {
          type: "string",
          format: "date",
          description: "Date de fin du tournoi (optionnel)",
          ...(this.options.includeExamples && {
            example: "2024-03-17T00:00:00.000Z",
          }),
        },
        location: {
          type: "string",
          description: "Ville du tournoi",
          ...(this.options.includeExamples && { example: "Paris" }),
        },
        department: {
          type: "integer",
          description: "Numéro du département",
          ...(this.options.includeExamples && { example: 75 }),
        },
        type: {
          type: "string",
          description: "Type de tournoi",
          ...(this.options.includeExamples && { example: "tournoi" }),
        },
        status: {
          type: "string",
          enum: ["registration", "ongoing", "finished"],
          description: "Statut du tournoi",
          ...(this.options.includeExamples && { example: "registration" }),
        },
        maxPlayers: {
          type: "integer",
          description: "Nombre maximum de joueurs",
          ...(this.options.includeExamples && { example: 64 }),
        },
        currentPlayers: {
          type: "integer",
          description: "Nombre actuel de joueurs inscrits",
          ...(this.options.includeExamples && { example: 32 }),
        },
        registrationDeadline: {
          type: "string",
          format: "date",
          description: "Date limite d'inscription",
          ...(this.options.includeExamples && {
            example: "2024-03-10T00:00:00.000Z",
          }),
        },
        url: {
          type: "string",
          format: "uri",
          description: "URL vers la fiche du tournoi sur le site FFE",
          ...(this.options.includeExamples && {
            example: "https://www.echecs.asso.fr/FicheTournoi.aspx?Ref=12345",
          }),
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
    };
  }

  /**
   * Exporte le type Player
   */
  exportPlayerType() {
    return {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Identifiant unique du joueur",
          ...(this.options.includeExamples && { example: "jean-dupont" }),
        },
        name: {
          type: "string",
          description: "Nom de famille du joueur",
          ...(this.options.includeExamples && { example: "Dupont" }),
        },
        firstName: {
          type: "string",
          description: "Prénom du joueur",
          ...(this.options.includeExamples && { example: "Jean" }),
        },
        club: {
          type: "string",
          description: "Club du joueur",
          ...(this.options.includeExamples && {
            example: "Club d'Echecs de Paris",
          }),
        },
        elo: {
          type: "integer",
          description: "Classement Elo du joueur",
          ...(this.options.includeExamples && { example: 1650 }),
        },
        category: {
          type: "string",
          description: "Catégorie du joueur",
          ...(this.options.includeExamples && { example: "A" }),
        },
        isRegistered: {
          type: "boolean",
          description: "Indique si le joueur est inscrit au tournoi",
          ...(this.options.includeExamples && { example: true }),
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
    };
  }

  /**
   * Exporte le type ApiResponse générique
   */
  exportApiResponseType() {
    return {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          description: "Indique si la requête a réussi",
          ...(this.options.includeExamples && { example: true }),
        },
        data: {
          type: "object",
          description: "Données de la réponse (peut être null en cas d'erreur)",
        },
        error: {
          type: "string",
          description: "Message d'erreur (présent uniquement si success=false)",
          ...(this.options.includeExamples && {
            example: "Tournament not found",
          }),
        },
        lastUpdated: {
          type: "string",
          format: "date-time",
          description: "Timestamp de la dernière mise à jour des données",
          ...(this.options.includeExamples && {
            example: "2024-03-01T10:30:00.000Z",
          }),
        },
      },
      required: ["success", "data", "lastUpdated"],
    };
  }

  /**
   * Exporte le type TournamentListResponse
   */
  exportTournamentListResponseType() {
    return {
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
          ...(this.options.includeExamples && { example: 25 }),
        },
        department: {
          type: "integer",
          description: "Département recherché (0 si multiple départements)",
          ...(this.options.includeExamples && { example: 37 }),
        },
        lastUpdated: {
          type: "string",
          format: "date-time",
          description: "Timestamp de la dernière mise à jour",
          ...(this.options.includeExamples && {
            example: "2024-03-01T10:30:00.000Z",
          }),
        },
      },
      required: ["tournaments", "total", "department", "lastUpdated"],
    };
  }

  /**
   * Exporte le type TournamentDetailsResponse
   */
  exportTournamentDetailsResponseType() {
    return {
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
          ...(this.options.includeExamples && {
            example: "2024-03-01T10:30:00.000Z",
          }),
        },
      },
      required: ["tournament", "players", "lastUpdated"],
    };
  }

  /**
   * Exporte le type ChessAgendaProps (pour le web component)
   */
  exportChessAgendaPropsType() {
    return {
      type: "object",
      properties: {
        departements: {
          type: "array",
          items: {
            type: "integer",
          },
          description: "Liste des numéros de départements à afficher",
          ...(this.options.includeExamples && { example: [37, 41] }),
        },
        club: {
          type: "string",
          description: "Nom du club pour filtrer les tournois",
          ...(this.options.includeExamples && { example: "Club de Paris" }),
        },
        limit: {
          type: "integer",
          description: "Nombre maximum de tournois à afficher",
          ...(this.options.includeExamples && { example: 10 }),
        },
        showOnlyClub: {
          type: "boolean",
          description:
            "Afficher seulement les tournois où des joueurs du club sont inscrits",
          ...(this.options.includeExamples && { example: false }),
        },
        apiBaseUrl: {
          type: "string",
          format: "uri",
          description: "URL de base de l'API (optionnel)",
          ...(this.options.includeExamples && {
            example: "https://api.example.com",
          }),
        },
      },
      required: ["departements"],
    };
  }

  /**
   * Génère un schéma d'erreur standard
   */
  exportErrorType() {
    return {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          ...(this.options.includeExamples && { example: false }),
        },
        error: {
          type: "string",
          description: "Message d'erreur détaillé",
          ...(this.options.includeExamples && {
            example: "Invalid department parameter",
          }),
        },
        lastUpdated: {
          type: "string",
          format: "date-time",
          description: "Timestamp de l'erreur",
          ...(this.options.includeExamples && {
            example: "2024-03-01T10:30:00.000Z",
          }),
        },
      },
      required: ["success", "error", "lastUpdated"],
    };
  }
}

/**
 * Instance par défaut de l'exportateur de types
 */
export const defaultTypeExporter = new TypeExporter();

/**
 * Fonction utilitaire pour exporter rapidement tous les types
 */
export function exportAllTypes(options?: TypeExporterOptions) {
  const exporter = new TypeExporter(options);
  return exporter.exportAllTypes();
}

/**
 * Fonction utilitaire pour générer un schéma complet OpenAPI
 */
export function generateOpenAPISchema(
  baseUrl: string = "http://localhost:3012"
) {
  const types = defaultTypeExporter.exportAllTypes();

  return {
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
        url: baseUrl,
        description: "Serveur principal",
      },
    ],
    components: {
      schemas: {
        ...types,
        Error: defaultTypeExporter.exportErrorType(),
      },
    },
  };
}
