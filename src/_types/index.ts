// Types partagés entre le backend Next.js et le webcomponent Lit

export interface Tournament {
  id: string;
  name: string;
  date: string; // ISO format
  endDate?: string; // ISO format
  location: string;
  department: number;
  type: string;
  status: "registration" | "ongoing" | "finished";
  url: string;
  players?: Player[];
  maxPlayers?: number;
  currentPlayers?: number;
  registrationDeadline?: string; // ISO format
}

export interface Player {
  id: string;
  name: string;
  firstName: string;
  club: string;
  elo: number;
  category: string;
  federation?: string;
  league?: string;
  isRegistered: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T | null;
  error?: string;
  lastUpdated: string;
}

export interface TournamentListResponse {
  tournaments: Tournament[];
  total: number;
  department: number;
  lastUpdated: string;
}

export interface TournamentDetailsResponse {
  tournament: Tournament;
  lastUpdated: string;
}

// Types pour le web component
export interface ChessAgendaProps {
  departements: number[];
  club?: string;
  limit?: number;
  showOnlyClub?: boolean;
  apiBaseUrl?: string;
}
