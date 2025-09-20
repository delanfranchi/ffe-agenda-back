import { NextRequest, NextResponse } from "next/server";
import { FFEScraper } from "@/services/ffescraper";
import { ApiResponse, TournamentDetailsResponse } from "@/types/chess";

// Cache pour 14 heures (50400 secondes)
export const revalidate = 50400;

/**
 * @swagger
 * /api/tournaments/{id}:
 *   get:
 *     summary: Récupère les détails d'un tournoi spécifique
 *     description: Retourne les informations détaillées d'un tournoi d'échecs, y compris la liste des joueurs inscrits
 *     tags:
 *       - Tournaments
 *     parameters:
 *       - $ref: '#/components/parameters/TournamentId'
 *     responses:
 *       200:
 *         description: Détails du tournoi récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TournamentDetailsResponse'
 *             example:
 *               success: true
 *               data:
 *                 tournament:
 *                   id: "12345"
 *                   name: "Open de Paris 2024"
 *                   date: "2024-03-15T00:00:00.000Z"
 *                   endDate: "2024-03-17T00:00:00.000Z"
 *                   location: "Paris"
 *                   department: 75
 *                   type: "tournoi"
 *                   status: "registration"
 *                   maxPlayers: 64
 *                   currentPlayers: 32
 *                   url: "https://www.echecs.asso.fr/FicheTournoi.aspx?Ref=12345"
 *                 players:
 *                   - id: "jean-dupont"
 *                     name: "Dupont"
 *                     firstName: "Jean"
 *                     club: "Club d'Echecs de Paris"
 *                     elo: 1650
 *                     category: "A"
 *                     isRegistered: true
 *                 lastUpdated: "2024-03-01T10:30:00.000Z"
 *               lastUpdated: "2024-03-01T10:30:00.000Z"
 *       400:
 *         description: ID de tournoi manquant ou invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "Tournament ID is required"
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
