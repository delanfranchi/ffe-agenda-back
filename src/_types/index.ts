// Types partagés entre le backend Next.js et le webcomponent Lit

export interface ResultsLinks {
  players?: string;
  grid?: string;
  ranking?: string;
  fide?: string;
  stats?: string;
  round1?: string;
  round2?: string;
  round3?: string;
  round4?: string;
  round5?: string;
  round6?: string;
  round7?: string;
  round8?: string;
  round9?: string;
  round10?: string;
}
export interface Tournament {
  id: string;
  name: string;
  startDate: string; // ISO format - date de début
  endDate?: string; // ISO format - date de fin (seulement si différente de startDate)
  location: string;
  department: number;
  type: string;
  status: "registration" | "ongoing" | "finished";
  url: string;
  players?: Player[];
  maxPlayers?: number;
  registrationDeadline?: string; // ISO format
  // Nouvelles propriétés étendues
  address?: string;
  rounds?: number;
  timeControl?: string;
  pairingSystem?: string;
  seniorFee?: string;
  juniorFee?: string;
  organizer?: string;
  referee?: string;
  contact?: string;
  // Prix détaillés
  firstPrize?: string;
  secondPrize?: string;
  thirdPrize?: string;
  eloRapid?: string;
  eloFide?: string;
  // Informations supplémentaires
  announcement?: string;
  regulationLink?: string;
  resultsLinks?: ResultsLinks;
}

export interface Player {
  id: string;
  name: string;
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
