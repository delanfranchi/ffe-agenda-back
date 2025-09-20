// Réexport des types partagés
export * from "../../../_types/index";

// Types spécifiques au backend Next.js
export interface TournamentListParams {
  department: number;
  limit?: number;
  offset?: number;
}

export interface TournamentDetailsParams {
  tournamentId: string;
}
