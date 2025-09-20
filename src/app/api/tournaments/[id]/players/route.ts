import { NextRequest, NextResponse } from "next/server";
import { FFEScraper } from "@/services/ffescraper";
import { ApiResponse, Player } from "@/types/chess";

// Cache pour 14 heures (50400 secondes)
export const revalidate = 50400;

/**
 * @swagger
 * /api/tournaments/{id}/players:
 *   get:
 *     summary: Récupère la liste des joueurs d'un tournoi
 *     description: Retourne la liste des joueurs inscrits à un tournoi d'échecs spécifique
 *     tags:
 *       - Players
 *     parameters:
 *       - $ref: '#/components/parameters/TournamentId'
 *     responses:
 *       200:
 *         description: Liste des joueurs récupérée avec succès
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
 *                         $ref: '#/components/schemas/Player'
 *             example:
 *               success: true
 *               data:
 *                 - id: "jean-dupont"
 *                   name: "Dupont"
 *                   firstName: "Jean"
 *                   club: "Club d'Echecs de Paris"
 *                   elo: 1650
 *                   category: "A"
 *                   isRegistered: true
 *                 - id: "marie-martin"
 *                   name: "Martin"
 *                   firstName: "Marie"
 *                   club: "Club d'Echecs de Lyon"
 *                   elo: 1420
 *                   category: "B"
 *                   isRegistered: true
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
