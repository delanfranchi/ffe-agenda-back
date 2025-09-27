import { NextRequest, NextResponse } from "next/server";
import { FFEScraper } from "@/services/ffescraper";
import { ApiResponse, Tournament, TournamentListResponse } from "@/types/chess";

// Instance unique du scraper pour maintenir le Set pastEventsIds
let scraperInstance: FFEScraper | null = null;

// Cache pour 20 heures (72000 secondes) - aligné avec la fréquence de mise à jour FFE
export const revalidate = 72000;

/**
 * API pour récupérer la liste des tournois d'échecs
 *
 * Paramètres:
 * - department[]: tableau de départements
 *
 * Note: Seuls les événements futurs sont retournés par défaut
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentArray = searchParams.getAll("department[]");

    if (departmentArray.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          error:
            "Department parameter is required (use department[]=37&department[]=41)",
          lastUpdated: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const departmentNumbers = departmentArray.map((dept) => {
      const num = parseInt(dept, 10);
      if (isNaN(num)) {
        throw new Error(`Invalid department number: ${dept}`);
      }
      return num;
    });

    // Utiliser l'instance unique pour maintenir le Set pastEventsIds
    if (!scraperInstance) {
      scraperInstance = new FFEScraper();
    }
    const scraper = scraperInstance;

    // Récupérer les tournois pour chaque département en parallèle
    const tournamentPromises = departmentNumbers.map((dept) =>
      scraper.getTournamentsByDepartment(dept)
    );
    const tournamentResults = await Promise.allSettled(tournamentPromises);

    const allTournaments: Tournament[] = [];
    tournamentResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        allTournaments.push(...result.value);
      } else {
        console.error(
          `Error fetching tournaments for department ${departmentNumbers[index]}:`,
          result.reason
        );
        // Continuer avec les autres départements même si un échoue
      }
    });

    // Filtrer les événements à venir (toujours actif)
    const now = new Date();
    const filteredTournaments = allTournaments.filter((tournament) => {
      const tournamentDate = new Date(tournament.startDate);
      return tournamentDate >= now;
    });

    // Trier par date (ordre croissant - les plus proches en premier)
    filteredTournaments.sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const response: TournamentListResponse = {
      tournaments: filteredTournaments,
      total: filteredTournaments.length,
      department: departmentNumbers.length === 1 ? departmentNumbers[0] : 0, // 0 pour multiple départements
      lastUpdated: new Date().toISOString(),
    };

    const apiResponse = NextResponse.json<ApiResponse<TournamentListResponse>>({
      success: true,
      data: response,
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
    console.error("Error in tournaments API:", error);

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
