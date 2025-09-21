// Réexport des types partagés
export * from "../_types/index";

// Types spécifiques au backend Next.js
export interface TournamentListParams {
  departments: number[];
}

export interface TournamentDetailsParams {
  tournamentId: string;
}
