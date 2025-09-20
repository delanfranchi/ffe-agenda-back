import * as cheerio from "cheerio";
import { Tournament, Player, TournamentDetailsResponse } from "@/types/chess";

export class FFEScraper {
  private baseUrl = "https://www.echecs.asso.fr";
  private userAgent = "ChessAgenda/1.0 (https://github.com/chess-agenda)";

  /**
   * Récupère la liste des tournois pour un département donné
   */
  async getTournamentsByDepartment(department: number): Promise<Tournament[]> {
    const url = `${this.baseUrl}/Agenda.aspx?Dept=${department}`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      return this.parseTournamentsList(html);
    } catch (error) {
      console.error(
        `Error fetching tournaments for department ${department}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Récupère les détails d'un tournoi spécifique
   */
  async getTournamentDetails(
    tournamentId: string
  ): Promise<TournamentDetailsResponse> {
    const tournamentUrl = `${this.baseUrl}/FicheTournoi.aspx?Ref=${tournamentId}`;
    const playersUrl = `${this.baseUrl}/ListeInscrits.aspx?Ref=${tournamentId}`;

    try {
      // Récupérer les détails du tournoi
      const tournamentResponse = await fetch(tournamentUrl, {
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      if (!tournamentResponse.ok) {
        throw new Error(`HTTP error! status: ${tournamentResponse.status}`);
      }

      const tournamentHtml = await tournamentResponse.text();
      const tournament = await this.parseTournamentDetails(
        tournamentHtml,
        tournamentId
      );

      // Récupérer la liste des joueurs
      const playersResponse = await fetch(playersUrl, {
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      let players: Player[] = [];
      if (playersResponse.ok) {
        const playersHtml = await playersResponse.text();
        players = this.parsePlayersList(playersHtml);
      }

      return {
        tournament: {
          ...tournament,
          players,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `Error fetching tournament details for ${tournamentId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Récupère uniquement la liste des joueurs d'un tournoi
   */
  async getTournamentPlayers(tournamentId: string): Promise<Player[]> {
    const playersUrl = `${this.baseUrl}/ListeInscrits.aspx?Ref=${tournamentId}`;

    try {
      const response = await fetch(playersUrl, {
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      return this.parsePlayersList(html);
    } catch (error) {
      console.error(
        `Error fetching players for tournament ${tournamentId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Parse la liste des tournois depuis la page agenda
   */
  private parseTournamentsList(html: string): Tournament[] {
    const $ = cheerio.load(html);
    const tournaments: Tournament[] = [];

    // Chercher le tableau des tournois
    $("table tr").each((index, element) => {
      if (index === 0) return; // Skip header row

      const $row = $(element);
      const $cells = $row.find("td");

      // Structure réelle : ID, Ville, Département, Nom (lien), Date, Type, Status1, Status2
      if ($cells.length >= 8) {
        const cityCell = $cells.eq(1);
        const nameCell = $cells.eq(3);
        const dateCell = $cells.eq(4);
        const typeCell = $cells.eq(5);
        const status1Cell = $cells.eq(6);
        const status2Cell = $cells.eq(7);

        // Extraire l'ID depuis le lien du nom
        const nameLink = nameCell.find("a").attr("href");
        const tournamentId = nameLink ? nameLink.match(/Ref=(\d+)/)?.[1] : null;

        if (!tournamentId) return;

        // Extraire le nom
        const name = nameCell.text().trim();

        // Extraire la ville
        const city = cityCell.text().trim();

        // Extraire le département depuis la ville ou une autre source
        const departmentMatch = city.match(/\((\d+)\)/);
        const department = departmentMatch ? parseInt(departmentMatch[1]) : 0;

        // Extraire la date
        const dateText = dateCell.text().trim();
        const date = this.parseDate(dateText);

        // Extraire le type
        const type = typeCell.text().trim();

        // Déterminer le statut
        const status1 = status1Cell.text().trim();
        const status2 = status2Cell.text().trim();
        const status = this.determineStatus(status1, status2);

        // Construire l'URL complète
        const url = `${this.baseUrl}/FicheTournoi.aspx?Ref=${tournamentId}`;

        tournaments.push({
          id: tournamentId,
          name,
          date: date.toISOString(),
          location: city,
          department,
          type,
          status,
          url,
        });
      }
    });

    return tournaments;
  }

  /**
   * Parse les détails d'un tournoi depuis sa page de détail
   */
  private async parseTournamentDetails(
    html: string,
    tournamentId: string
  ): Promise<Tournament> {
    const $ = cheerio.load(html);

    // Extraire le nom du tournoi
    const name = $("h1, h2, .title, .tournament-name").first().text().trim();

    // Extraire la date
    const dateText = this.extractDate($);
    const date = this.parseDate(dateText);

    // Extraire la ville
    const location = this.extractLocation($);

    // Extraire le département
    const department = this.extractDepartment($);

    // Extraire le type
    const type = this.extractType($);

    // Déterminer le statut
    const status = this.extractStatus($);

    // Extraire les informations supplémentaires
    const maxPlayers = this.extractMaxPlayers($);
    const currentPlayers = this.extractCurrentPlayers($);
    const registrationDeadline = this.extractRegistrationDeadline($);
    const endDate = this.extractEndDate($);

    // Construire l'URL
    const url = `${this.baseUrl}/FicheTournoi.aspx?Ref=${tournamentId}`;

    return {
      id: tournamentId,
      name: name || `Tournoi ${tournamentId}`,
      date: date.toISOString(),
      endDate: endDate?.toISOString(),
      location: location || "Non spécifié",
      department: department || 0,
      type: type || "Non spécifié",
      status: status as "registration" | "ongoing" | "finished",
      url,
      maxPlayers,
      currentPlayers,
      registrationDeadline: registrationDeadline?.toISOString(),
    };
  }

  /**
   * Parse la liste des joueurs depuis la page des inscrits
   */
  private parsePlayersList(html: string): Player[] {
    const $ = cheerio.load(html);
    const players: Player[] = [];

    // Chercher le tableau des joueurs
    $("table tr").each((index, element) => {
      if (index === 0) return; // Skip header row

      const $row = $(element);
      const $cells = $row.find("td");

      // Structure réelle : Nr, (vide), Nom, Rapide, Cat., Fede, Ligue, Club
      if ($cells.length >= 8) {
        const nameCell = $cells.eq(2);
        const eloCell = $cells.eq(3);
        const categoryCell = $cells.eq(4);
        const federationCell = $cells.eq(5);
        const leagueCell = $cells.eq(6);
        const clubCell = $cells.eq(7);

        // Extraire le nom complet
        const fullName = nameCell.text().trim();
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        // Extraire l'Elo
        const eloText = eloCell.text().trim();
        const elo = eloText ? parseInt(eloText) || 0 : 0;

        // Extraire la catégorie
        const category = categoryCell.text().trim();

        // Extraire la fédération
        const federation = federationCell.text().trim();

        // Extraire la ligue
        const league = leagueCell.text().trim();

        // Extraire le club
        const club = clubCell.text().trim();

        // Générer un ID unique
        const playerId =
          `${lastName.toLowerCase()}-${firstName.toLowerCase()}`.replace(
            /\s+/g,
            "-"
          );

        players.push({
          id: playerId,
          name: lastName,
          firstName,
          club: club,
          elo,
          category: category,
          federation: federation,
          league: league,
          isRegistered: true,
        });
      }
    });

    return players;
  }

  /**
   * Parse une date depuis le texte
   */
  private parseDate(dateText: string): Date {
    if (!dateText) return new Date();

    // Essayer différents formats de date
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = dateText.match(format);
      if (match) {
        let year, month, day;
        if (format === formats[0]) {
          // DD/MM/YYYY
          [, day, month, year] = match;
        } else if (format === formats[1]) {
          // YYYY-MM-DD
          [, year, month, day] = match;
        } else {
          // DD-MM-YYYY
          [, day, month, year] = match;
        }
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    }

    // Fallback: essayer de parser avec Date.parse
    const parsed = Date.parse(dateText);
    if (!isNaN(parsed)) {
      return new Date(parsed);
    }

    return new Date();
  }

  /**
   * Détermine le statut du tournoi
   */
  private determineStatus(
    status1: string,
    status2: string
  ): "registration" | "ongoing" | "finished" {
    const status1Lower = status1.toLowerCase();
    const status2Lower = status2.toLowerCase();

    if (
      status1Lower.includes("inscription") ||
      status2Lower.includes("inscription")
    ) {
      return "registration";
    }
    if (
      status1Lower.includes("en cours") ||
      status2Lower.includes("en cours")
    ) {
      return "ongoing";
    }
    if (status1Lower.includes("terminé") || status2Lower.includes("terminé")) {
      return "finished";
    }

    return "registration"; // Default
  }

  // Méthodes d'extraction pour les détails du tournoi
  private extractDate($: cheerio.CheerioAPI): string {
    // Chercher la date dans différents endroits possibles
    const dateSelectors = [
      ".date",
      ".tournament-date",
      ".date-debut",
      ".date-début",
      "[class*='date']",
      "td:contains('Date')",
      "th:contains('Date')",
      "td:contains('Début')",
      "th:contains('Début')",
      "td:contains('Du')",
      "th:contains('Du')",
    ];

    for (const selector of dateSelectors) {
      const dateElement = $(selector);
      if (dateElement.length > 0) {
        const text = dateElement.text().trim();
        if (text) {
          return text;
        }
      }
    }

    return "";
  }

  private extractLocation($: cheerio.CheerioAPI): string {
    const locationSelectors = [
      ".location",
      ".ville",
      ".city",
      "td:contains('Ville')",
      "th:contains('Ville')",
    ];

    for (const selector of locationSelectors) {
      const locationElement = $(selector);
      if (locationElement.length > 0) {
        return locationElement.text().trim();
      }
    }

    return "";
  }

  private extractDepartment($: cheerio.CheerioAPI): number {
    const departmentSelectors = [
      ".department",
      ".dept",
      "td:contains('Département')",
      "th:contains('Département')",
    ];

    for (const selector of departmentSelectors) {
      const deptElement = $(selector);
      if (deptElement.length > 0) {
        const text = deptElement.text().trim();
        const match = text.match(/(\d+)/);
        if (match) {
          return parseInt(match[1]);
        }
      }
    }

    return 0;
  }

  private extractType($: cheerio.CheerioAPI): string {
    const typeSelectors = [
      ".type",
      ".tournament-type",
      "td:contains('Type')",
      "th:contains('Type')",
    ];

    for (const selector of typeSelectors) {
      const typeElement = $(selector);
      if (typeElement.length > 0) {
        return typeElement.text().trim();
      }
    }

    return "";
  }

  private extractStatus($: cheerio.CheerioAPI): string {
    const statusSelectors = [
      ".status",
      ".statut",
      "td:contains('Statut')",
      "th:contains('Statut')",
    ];

    for (const selector of statusSelectors) {
      const statusElement = $(selector);
      if (statusElement.length > 0) {
        const text = statusElement.text().trim().toLowerCase();
        if (text.includes("inscription")) return "registration";
        if (text.includes("en cours")) return "ongoing";
        if (text.includes("terminé")) return "finished";
      }
    }

    return "registration";
  }

  private extractMaxPlayers($: cheerio.CheerioAPI): number | undefined {
    const maxPlayersSelectors = [
      ".max-players",
      ".max-joueurs",
      ".capacite",
      ".places",
      "td:contains('Max')",
      "th:contains('Max')",
      "td:contains('maximum')",
      "th:contains('maximum')",
      "td:contains('places')",
      "th:contains('places')",
      "td:contains('capacité')",
      "th:contains('capacité')",
    ];

    for (const selector of maxPlayersSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        const match = text.match(/(\d+)/);
        if (match) {
          return parseInt(match[1]);
        }
      }
    }

    return undefined;
  }

  private extractCurrentPlayers($: cheerio.CheerioAPI): number | undefined {
    const currentPlayersSelectors = [
      ".current-players",
      ".joueurs-inscrits",
      ".inscrits",
      "td:contains('inscrit')",
      "th:contains('inscrit')",
      "td:contains('participant')",
      "th:contains('participant')",
    ];

    for (const selector of currentPlayersSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        const match = text.match(/(\d+)/);
        if (match) {
          return parseInt(match[1]);
        }
      }
    }

    return undefined;
  }

  private extractRegistrationDeadline($: cheerio.CheerioAPI): Date | undefined {
    const deadlineSelectors = [
      ".registration-deadline",
      ".date-limite",
      ".limite-inscription",
      "td:contains('limite')",
      "th:contains('limite')",
      "td:contains('clôture')",
      "th:contains('clôture')",
      "td:contains('avant')",
    ];

    for (const selector of deadlineSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        const date = this.parseDate(text);
        if (date && date.getTime() !== new Date().getTime()) {
          return date;
        }
      }
    }

    return undefined;
  }

  private extractEndDate($: cheerio.CheerioAPI): Date | undefined {
    const endDateSelectors = [
      ".end-date",
      ".date-fin",
      ".fin",
      "td:contains('Fin')",
      "th:contains('Fin')",
      "td:contains('jusqu')",
      "td:contains('au')",
    ];

    for (const selector of endDateSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        const date = this.parseDate(text);
        if (date && date.getTime() !== new Date().getTime()) {
          return date;
        }
      }
    }

    return undefined;
  }
}
