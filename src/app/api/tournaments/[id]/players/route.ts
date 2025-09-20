import { NextRequest, NextResponse } from "next/server";
import { FFEScraper } from "@/services/ffescraper";
import { ApiResponse, Player } from "@/types/chess";

// Cache pour 14 heures (50400 secondes)
export const revalidate = 50400;

/**
 * API pour récupérer la liste des joueurs d'un tournoi
 *
 * Paramètres:
 * - id: identifiant du tournoi (dans l'URL)
 *
 * Retourne: la liste des joueurs inscrits au tournoi
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;

    if (!tournamentId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          error: "Tournament ID is required",
          lastUpdated: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const scraper = new FFEScraper();
    const players = await scraper.getTournamentPlayers(tournamentId);

    return NextResponse.json<ApiResponse<Player[]>>({
      success: true,
      data: players,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in tournament players API:", error);

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Internal server error",
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
