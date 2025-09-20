import { NextRequest, NextResponse } from "next/server";
import { FFEScraper } from "@/services/ffescraper";
import {
  ApiResponse,
  Tournament,
  TournamentListResponse,
  TournamentListParams,
} from "@/types/chess";

// Cache pour 20 heures (72000 secondes)
export const revalidate = 72000;

/**
 * @swagger
 * /api/tournaments:
 *   get:
 *     summary: Récupère la liste des tournois d'échecs avec pagination
 *     description: Retourne la liste des tournois d'échecs pour les départements spécifiés, avec support de la pagination et filtrage par événements futurs
 *     tags:
 *       - Tournaments
 *     parameters:
 *       - $ref: '#/components/parameters/Department'
 *       - $ref: '#/components/parameters/DepartmentArray'
 *       - $ref: '#/components/parameters/Limit'
 *       - $ref: '#/components/parameters/Offset'
 *       - $ref: '#/components/parameters/Next'
 *     responses:
 *       200:
 *         description: Liste des tournois récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TournamentListResponse'
 *             example:
 *               success: true
 *               data:
 *                 tournaments:
 *                   - id: "12345"
 *                     name: "Open de Paris 2024"
 *                     date: "2024-03-15T00:00:00.000Z"
 *                     location: "Paris"
 *                     department: 75
 *                     type: "tournoi"
 *                     status: "registration"
 *                     url: "https://www.echecs.asso.fr/FicheTournoi.aspx?Ref=12345"
 *                 total: 25
 *                 department: 37
 *                 lastUpdated: "2024-03-01T10:30:00.000Z"
 *               lastUpdated: "2024-03-01T10:30:00.000Z"
 *       400:
 *         description: Paramètres de requête invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "Department parameter is required"
 *               lastUpdated: "2024-03-01T10:30:00.000Z"
 *       500:
 *         description: Erreur interne du serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "Internal server error"
 *               lastUpdated: "2024-03-01T10:30:00.000Z"
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
