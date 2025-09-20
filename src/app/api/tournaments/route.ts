import { NextRequest, NextResponse } from "next/server";
import { FFEScraper } from "@/services/ffescraper";
import { ApiResponse, Tournament, TournamentListResponse } from "@/types/chess";

// Cache pour 20 heures (72000 secondes)
export const revalidate = 72000;

/**
 * API pour récupérer la liste des tournois d'échecs avec pagination
 *
 * Paramètres:
 * - department: numéro du département (legacy)
 * - department[]: tableau de départements (recommandé)
 * - limit: nombre maximum de résultats
 * - offset: décalage pour la pagination
 * - next: filtrer les événements futurs uniquement
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const departmentArray = searchParams.getAll("department[]");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const next = searchParams.get("next") === "true";

    let departmentNumbers: number[] = [];

    // Gérer un seul département (format legacy)
    if (department) {
      const departmentNumber = parseInt(department, 10);
      if (isNaN(departmentNumber)) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            data: null,
            error: "Department must be a valid number",
            lastUpdated: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
      departmentNumbers = [departmentNumber];
    }
    // Gérer un tableau de départements (format standard REST)
    else if (departmentArray.length > 0) {
      departmentNumbers = departmentArray.map((dept) => {
        const num = parseInt(dept, 10);
        if (isNaN(num)) {
          throw new Error(`Invalid department number: ${dept}`);
        }
        return num;
      });
    } else {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          error:
            "Department parameter is required (use department=37 or department[]=37&department[]=41)",
          lastUpdated: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const scraper = new FFEScraper();
    const allTournaments: Tournament[] = [];

    // Récupérer les tournois pour chaque département
    for (const dept of departmentNumbers) {
      try {
        const tournaments = await scraper.getTournamentsByDepartment(dept);
        allTournaments.push(...tournaments);
      } catch (error) {
        console.error(
          `Error fetching tournaments for department ${dept}:`,
          error
        );
        // Continuer avec les autres départements même si un échoue
      }
    }

    // Filtrer les événements à venir si next=true
    let filteredTournaments = allTournaments;
    if (next) {
      const now = new Date();
      filteredTournaments = allTournaments.filter((tournament) => {
        const tournamentDate = new Date(tournament.date);
        return tournamentDate >= now;
      });
    }

    // Trier par date (ordre croissant - les plus proches en premier)
    filteredTournaments.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Appliquer la pagination si demandée
    let paginatedTournaments = filteredTournaments;
    if (limit || offset) {
      const limitNum = limit ? parseInt(limit, 10) : filteredTournaments.length;
      const offsetNum = offset ? parseInt(offset, 10) : 0;
      paginatedTournaments = filteredTournaments.slice(
        offsetNum,
        offsetNum + limitNum
      );
    }

    const response: TournamentListResponse = {
      tournaments: paginatedTournaments,
      total: filteredTournaments.length,
      department: departmentNumbers.length === 1 ? departmentNumbers[0] : 0, // 0 pour multiple départements
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json<ApiResponse<TournamentListResponse>>({
      success: true,
      data: response,
      lastUpdated: new Date().toISOString(),
    });
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
