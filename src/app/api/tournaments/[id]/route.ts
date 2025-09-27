import { NextRequest, NextResponse } from "next/server";
import { FFEScraper } from "@/services/ffescraper";
import { ApiResponse, TournamentDetailsResponse } from "@/types/chess";

// Instance unique du scraper pour maintenir le Set pastEventsIds
let scraperInstance: FFEScraper | null = null;

// Cache pour 10 heures (36000 secondes)
export const revalidate = 36000;

/**
 * API pour récupérer les détails d'un tournoi spécifique
 *
 * Paramètres:
 * - id: identifiant du tournoi (dans l'URL)
 *
 * Retourne: les informations détaillées du tournoi avec la liste des joueurs
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;

    if (!tournamentId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: "Tournament ID is required",
          lastUpdated: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Utiliser l'instance unique pour maintenir le Set pastEventsIds
    if (!scraperInstance) {
      scraperInstance = new FFEScraper();
    }
    const scraper = scraperInstance;

    const tournamentDetails = await scraper.getTournamentDetails(tournamentId);

    const apiResponse = NextResponse.json<
      ApiResponse<TournamentDetailsResponse>
    >({
      success: true,
      data: tournamentDetails,
      lastUpdated: new Date().toISOString(),
    });

    // Ajouter des headers de cache HTTP
    apiResponse.headers.set(
      "Cache-Control",
      "public, s-maxage=36000, stale-while-revalidate=144000"
    );
    apiResponse.headers.set("CDN-Cache-Control", "public, s-maxage=36000");
    apiResponse.headers.set(
      "Vercel-CDN-Cache-Control",
      "public, s-maxage=36000"
    );

    return apiResponse;
  } catch (error) {
    console.error("Error in tournament details API:", error);

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
