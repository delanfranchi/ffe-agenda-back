import { NextRequest, NextResponse } from "next/server";
import { FFEScraper } from "@/services/ffescraper";
import { ApiResponse, TournamentDetailsResponse } from "@/types/chess";

// Cache pour 14 heures (50400 secondes)
export const revalidate = 50400;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id;

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

    const scraper = new FFEScraper();
    const tournamentDetails = await scraper.getTournamentDetails(tournamentId);

    return NextResponse.json<ApiResponse<TournamentDetailsResponse>>({
      success: true,
      data: tournamentDetails,
      lastUpdated: new Date().toISOString(),
    });
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
