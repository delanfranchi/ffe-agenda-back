import { NextRequest, NextResponse } from "next/server";
import { FFEScraper } from "@/services/ffescraper";
import { ApiResponse, Tournament, ChessAgendaProps } from "@/types/chess";

// Cache pour 14 heures (50400 secondes)
export const revalidate = 50400;

/**
 * @swagger
 * /api/agenda:
 *   get:
 *     summary: Récupère la liste des tournois d'échecs
 *     description: Retourne la liste des tournois d'échecs pour les départements spécifiés, avec possibilité de filtrage par club et événements futurs
 *     tags:
 *       - Agenda
 *     parameters:
 *       - $ref: '#/components/parameters/DepartmentArray'
 *       - $ref: '#/components/parameters/Limit'
 *       - $ref: '#/components/parameters/Club'
 *       - $ref: '#/components/parameters/ShowOnlyClub'
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
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Tournament'
 *             example:
 *               success: true
 *               data:
 *                 - id: "68608"
 *                   name: "Tournoi Vétérans + 55 ans N°4 2025 - 2026"
 *                   date: "2026-04-24T00:00:00.000Z"
 *                   location: "TOURS"
 *                   department: 37
 *                   type: "CVL"
 *                   status: "registration"
 *                   url: "https://www.echecs.asso.fr/FicheTournoi.aspx?Ref=68608"
 *               lastUpdated: "2025-09-20T08:04:23.941Z"
 *       400:
 *         description: Paramètres de requête invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "department[] parameter is required"
 *               lastUpdated: "2025-09-20T08:04:23.941Z"
 *       500:
 *         description: Erreur interne du serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "Internal server error"
 *               lastUpdated: "2025-09-20T08:04:23.941Z"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departements = searchParams.getAll("department[]");
    const club = searchParams.get("club");
    const limit = searchParams.get("limit");
    const showOnlyClub = searchParams.get("showOnlyClub") === "true";
    const next = searchParams.get("next") === "true";

    if (!departements || departements.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: "department[] parameter is required",
          lastUpdated: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Parse les départements
    let departmentNumbers: number[];
    try {
      departmentNumbers = departements
        .map((d) => parseInt(d, 10))
        .filter((n) => !isNaN(n));
      if (departmentNumbers.length === 0) {
        throw new Error("No valid department numbers found");
      }
    } catch (error) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: "Invalid department[] format. Expected array of numbers.",
          lastUpdated: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const scraper = new FFEScraper();
    const allTournaments: Tournament[] = [];

    // Récupérer les tournois pour chaque département
    for (const department of departmentNumbers) {
      try {
        const tournaments = await scraper.getTournamentsByDepartment(
          department
        );
        allTournaments.push(...tournaments);
      } catch (error) {
        console.error(
          `Error fetching tournaments for department ${department}:`,
          error
        );
        // Continuer avec les autres départements même si un échoue
      }
    }

    // Filtrer les événements à venir si next=true
    let filteredTournaments = allTournaments;
    if (next) {
      const now = new Date();
      // Réinitialiser l'heure à 00:00:00 pour être plus tolérant avec les événements du jour
      now.setHours(0, 0, 0, 0);

      filteredTournaments = allTournaments.filter((tournament) => {
        const tournamentDate = new Date(tournament.date);
        // Réinitialiser l'heure à 00:00:00 pour la comparaison
        tournamentDate.setHours(0, 0, 0, 0);
        return tournamentDate >= now;
      });
    }

    // Trier par date (ordre croissant - les plus proches en premier)
    filteredTournaments.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Filtrer par club si spécifié
    let clubFilteredTournaments = filteredTournaments;
    if (club && showOnlyClub) {
      // Pour filtrer par club, on doit récupérer les détails de chaque tournoi
      // et vérifier s'il y a des joueurs du club
      const clubTournaments: Tournament[] = [];

      for (const tournament of filteredTournaments) {
        try {
          const details = await scraper.getTournamentDetails(tournament.id);
          const hasClubPlayers = details.players.some((player) =>
            player.club.toLowerCase().includes(club.toLowerCase())
          );

          if (hasClubPlayers) {
            clubTournaments.push({
              ...tournament,
              players: details.players,
            });
          }
        } catch (error) {
          console.error(
            `Error checking club players for tournament ${tournament.id}:`,
            error
          );
        }
      }

      clubFilteredTournaments = clubTournaments;
    }

    // Appliquer la limite si spécifiée
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum)) {
        clubFilteredTournaments = clubFilteredTournaments.slice(0, limitNum);
      }
    }

    return NextResponse.json<ApiResponse<Tournament[]>>({
      success: true,
      data: clubFilteredTournaments,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in agenda API:", error);

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
