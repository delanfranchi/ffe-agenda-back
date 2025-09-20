import * as cheerio from "cheerio";
import {
  Tournament,
  Player,
  TournamentListResponse,
  TournamentDetailsResponse,
} from "@/types/chess";

export class FFEScraper {
  private baseUrl = "https://www.echecs.asso.fr";
  private userAgent = "ChessAgenda/1.0 (https://github.com/chess-agenda)";

  /**
   * Récupère la liste des tournois pour un département donné
   */
  async getTournamentsByDepartment(department: number): Promise<Tournament[]> {
    const url = `${this.baseUrl}/ListeTournois.aspx?Action=TOURNOICOMITE&ComiteRef=${department}`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
        },
        next: { revalidate: 72000 }, // Cache 20 heures pour la liste des tournois
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const tournaments: Tournament[] = [];

      // Sélecteur pour les lignes de tournois selon la structure réelle
      $("table tr").each((index, element) => {
        const $row = $(element);
        const $cells = $row.find("td");

        // Ignorer les lignes de titre (liste_titre) et les lignes vides
        if ($row.hasClass("liste_titre") || $cells.length < 8) {
          return;
        }

        // Structure réelle : ID, Ville, Département, Nom (lien), Date, Type, Status1, Status2
        if ($cells.length >= 8) {
          const idCell = $cells.eq(0);
          const cityCell = $cells.eq(1);
          const departmentCell = $cells.eq(2);
          const nameCell = $cells.eq(3);
          const dateCell = $cells.eq(4);
          const typeCell = $cells.eq(5);
          const status1Cell = $cells.eq(6);
          const status2Cell = $cells.eq(7);

          const nameLink = nameCell.find("a");
          const tournamentId = this.extractTournamentId(
            nameLink.attr("href") || ""
          );

          if (tournamentId) {
            tournaments.push({
              id: tournamentId,
              name: nameLink.text().trim(),
              date: this.parseFrenchDate(dateCell.text().trim()),
              location: cityCell.text().trim(),
              department,
              type: typeCell.text().trim(),
              status: this.parseStatusFromCells(status1Cell, status2Cell),
              url: `${this.baseUrl}/FicheTournoi.aspx?Ref=${tournamentId}`,
            });
          }
        }
      });

      return tournaments;
    } catch (error) {
      console.error(
        `Error scraping tournaments for department ${department}:`,
        error
      );
      throw new Error(
        `Failed to fetch tournaments for department ${department}`
      );
    }
  }

  /**
   * Récupère les détails d'un tournoi spécifique
   */
  async getTournamentDetails(
    tournamentId: string
  ): Promise<TournamentDetailsResponse> {
    const url = `${this.baseUrl}/FicheTournoi.aspx?Ref=${tournamentId}`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
        },
        next: { revalidate: 50400 }, // Cache 14 heures pour les détails
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extraction des détails du tournoi
      const tournament: Tournament = {
        id: tournamentId,
        name: this.extractTournamentName($),
        date: this.extractTournamentDate($),
        endDate: this.extractTournamentEndDate($),
        location: this.extractTournamentLocation($),
        department: this.extractTournamentDepartment($),
        type: "tournoi",
        status: this.extractTournamentStatus($),
        maxPlayers: this.extractMaxPlayers($),
        currentPlayers: this.extractCurrentPlayers($),
        registrationDeadline: this.extractRegistrationDeadline($),
        url,
      };

      // Récupération des joueurs
      const players = await this.getTournamentPlayers(tournamentId);

      return {
        tournament,
        players,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `Error scraping tournament details for ${tournamentId}:`,
        error
      );
      throw new Error(`Failed to fetch tournament details for ${tournamentId}`);
    }
  }

  /**
   * Récupère la liste des joueurs d'un tournoi
   */
  async getTournamentPlayers(tournamentId: string): Promise<Player[]> {
    const url = `${this.baseUrl}/Resultats.aspx?URL=Tournois/Id/${tournamentId}/${tournamentId}&Action=Ls`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
        },
        next: { revalidate: 50400 }, // Cache 14 heures pour les détails
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const players: Player[] = [];

      // Sélecteur pour les lignes de joueurs selon la structure réelle
      $("table tr").each((index, element) => {
        const $row = $(element);
        const $cells = $row.find("td");

        // Ignorer les lignes de titre et d'en-tête
        if (
          $row.hasClass("papi_titre") ||
          $row.hasClass("papi_liste_t") ||
          $cells.length < 8
        ) {
          return;
        }

        // Structure réelle : Nr, (vide), Nom, Rapide, Cat., Fede, Ligue, Club
        if ($cells.length >= 8) {
          const nrCell = $cells.eq(0);
          const nameCell = $cells.eq(2);
          const eloCell = $cells.eq(3);
          const categoryCell = $cells.eq(4);
          const clubCell = $cells.eq(7);

          const fullName = nameCell.text().trim();
          const [firstName, ...lastNameParts] = fullName.split(" ");
          const lastName = lastNameParts.join(" ");

          players.push({
            id: this.generatePlayerId(fullName),
            name: lastName,
            firstName,
            club: clubCell.text().trim(),
            elo: this.parseEloFromRapide(eloCell.text().trim()),
            category: categoryCell.text().trim(),
            isRegistered: true,
          });
        }
      });

      return players;
    } catch (error) {
      console.error(
        `Error scraping players for tournament ${tournamentId}:`,
        error
      );
      return []; // Retourner un tableau vide en cas d'erreur
    }
  }

  // Méthodes utilitaires privées
  private extractTournamentId(href: string): string | null {
    const match = href.match(/Ref=(\d+)/);
    return match ? match[1] : null;
  }

  private parseFrenchDate(dateStr: string): string {
    // Parser les dates françaises avec toutes les abréviations possibles
    const months: { [key: string]: string } = {
      // Janvier
      "janv.": "01",
      "jan.": "01",
      jan: "01",
      janvier: "01",
      // Février
      "févr.": "02",
      "fév.": "02",
      fév: "02",
      février: "02",
      "fevr.": "02",
      "fev.": "02",
      fev: "02",
      fevrier: "02",
      // Mars
      mars: "03",
      "mar.": "03",
      mar: "03",
      // Avril
      "avr.": "04",
      avr: "04",
      avril: "04",
      "av.": "04",
      av: "04",
      // Mai
      mai: "05",
      "ma.": "05",
      ma: "05",
      // Juin
      juin: "06",
      "jun.": "06",
      jun: "06",
      // Juillet
      "juil.": "07",
      juil: "07",
      juillet: "07",
      "jul.": "07",
      jul: "07",
      // Août
      août: "08",
      aout: "08",
      "août.": "08",
      "aout.": "08",
      "ao.": "08",
      ao: "08",
      // Septembre
      "sept.": "09",
      sept: "09",
      septembre: "09",
      "sep.": "09",
      sep: "09",
      // Octobre
      "oct.": "10",
      oct: "10",
      octobre: "10",
      // Novembre
      "nov.": "11",
      nov: "11",
      novembre: "11",
      // Décembre
      "déc.": "12",
      déc: "12",
      décembre: "12",
      "dec.": "12",
      dec: "12",
      decembre: "12",
    };

    // Extraire le jour et le mois
    const match = dateStr.match(/(\d+)\s+(\w+)/);
    if (match) {
      const day = match[1].padStart(2, "0");
      const monthKey = match[2].toLowerCase();
      const month = months[monthKey];

      if (month) {
        // Utiliser l'année courante ou l'année suivante si on est en fin d'année
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        // Si le mois du tournoi est antérieur au mois actuel, c'est probablement l'année suivante
        const year =
          parseInt(month) < currentMonth ? currentYear + 1 : currentYear;

        // Retourner en format ISO complet avec timezone France
        return `${year}-${month}-${day}T00:00:00.000Z`;
      }
    }

    // Fallback pour les autres formats
    return this.parseDate(dateStr);
  }

  private parseDate(dateStr: string): string {
    // Convertir la date française en format ISO
    // Format attendu: "DD/MM/YYYY" ou "DD/MM/YYYY - DD/MM/YYYY"
    const parts = dateStr.split(" - ");
    const startDate = parts[0];

    // Conversion simple DD/MM/YYYY vers YYYY-MM-DD
    const [day, month, year] = startDate.split("/");
    if (day && month && year) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    return dateStr;
  }

  private parseStatusFromCells(
    status1Cell: cheerio.Cheerio<cheerio.Element>,
    status2Cell: cheerio.Cheerio<cheerio.Element>
  ): "registration" | "ongoing" | "finished" {
    // Analyser les cellules de statut (X = inscription fermée, autre = inscription ouverte)
    const status1 = status1Cell.text().trim();
    const status2 = status2Cell.text().trim();

    // Si les deux cellules ont "X", le tournoi est terminé
    if (status1 === "X" && status2 === "X") {
      return "finished";
    }

    // Si une seule cellule a "X", le tournoi est en cours
    if (status1 === "X" || status2 === "X") {
      return "ongoing";
    }

    // Sinon, inscription ouverte
    return "registration";
  }

  private parseStatus(
    statusStr: string
  ): "registration" | "ongoing" | "finished" {
    const status = statusStr.toLowerCase();
    if (status.includes("inscription")) return "registration";
    if (status.includes("en cours") || status.includes("débuté"))
      return "ongoing";
    if (status.includes("terminé") || status.includes("fini"))
      return "finished";
    return "registration"; // Par défaut
  }

  private parseEloFromRapide(rapideStr: string): number {
    // Parser "1769 F" ou "1450 N" - extraire le nombre avant la lettre
    const match = rapideStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private parseElo(eloStr: string): number {
    const match = eloStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private generatePlayerId(fullName: string): string {
    return fullName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  // Méthodes d'extraction pour les détails de tournoi selon la structure réelle
  private extractTournamentName($: cheerio.CheerioAPI): string {
    return (
      $("#ctl00_ContentPlaceHolderMain_LabelNom").text().trim() ||
      "Tournoi sans nom"
    );
  }

  private extractTournamentDate($: cheerio.CheerioAPI): string {
    const datesText = $("#ctl00_ContentPlaceHolderMain_LabelDates")
      .text()
      .trim();
    if (datesText) {
      // Parser "dimanche 05 octobre 2025 - dimanche 05 octobre 2025"
      const match = datesText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
      if (match) {
        const day = match[1].padStart(2, "0");
        const month = this.getMonthNumber(match[2]);
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
    }
    return new Date().toISOString().split("T")[0];
  }

  private extractTournamentEndDate($: cheerio.CheerioAPI): string | undefined {
    const datesText = $("#ctl00_ContentPlaceHolderMain_LabelDates")
      .text()
      .trim();
    if (datesText && datesText.includes(" - ")) {
      // Parser la date de fin si différente de la date de début
      const parts = datesText.split(" - ");
      if (parts.length === 2) {
        const endDateMatch = parts[1].match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
        if (endDateMatch) {
          const day = endDateMatch[1].padStart(2, "0");
          const month = this.getMonthNumber(endDateMatch[2]);
          const year = endDateMatch[3];
          return `${year}-${month}-${day}`;
        }
      }
    }
    return undefined;
  }

  private extractTournamentLocation($: cheerio.CheerioAPI): string {
    const lieuText = $("#ctl00_ContentPlaceHolderMain_LabelLieu").text().trim();
    if (lieuText) {
      // Extraire la ville depuis "37 - TOURS"
      const parts = lieuText.split(" - ");
      return parts.length > 1 ? parts[1].trim() : lieuText;
    }
    return "Lieu non spécifié";
  }

  private extractTournamentDepartment($: cheerio.CheerioAPI): number {
    const lieuText = $("#ctl00_ContentPlaceHolderMain_LabelLieu").text().trim();
    if (lieuText) {
      // Extraire le département depuis "37 - TOURS"
      const parts = lieuText.split(" - ");
      const dept = parseInt(parts[0], 10);
      return isNaN(dept) ? 0 : dept;
    }
    return 0;
  }

  private extractTournamentStatus(
    $: cheerio.CheerioAPI
  ): "registration" | "ongoing" | "finished" {
    // Vérifier s'il y a des liens de résultats disponibles
    const hasResults = $("a[href*='Resultats.aspx']").length > 0;
    if (hasResults) {
      // Si des résultats sont disponibles, le tournoi est probablement terminé ou en cours
      return "ongoing"; // On pourrait être plus précis en analysant les liens disponibles
    }
    return "registration";
  }

  private extractMaxPlayers($: cheerio.CheerioAPI): number | undefined {
    // Chercher dans l'annonce des informations sur le nombre de joueurs
    const annonce = $("#ctl00_ContentPlaceHolderMain_LabelAnnonce").text();
    const match = annonce.match(/limité aux (\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return undefined;
  }

  private extractCurrentPlayers($: cheerio.CheerioAPI): number | undefined {
    // Cette information n'est pas directement disponible sur la page de détail
    // Elle sera récupérée via la page des joueurs
    return undefined;
  }

  private extractRegistrationDeadline(
    $: cheerio.CheerioAPI
  ): string | undefined {
    // Cette information n'est pas directement visible dans la structure fournie
    // Elle pourrait être dans l'annonce ou nécessiter un parsing plus complexe
    return undefined;
  }

  private getMonthNumber(monthName: string): string {
    const months: { [key: string]: string } = {
      janvier: "01",
      février: "02",
      mars: "03",
      avril: "04",
      mai: "05",
      juin: "06",
      juillet: "07",
      août: "08",
      septembre: "09",
      octobre: "10",
      novembre: "11",
      décembre: "12",
    };
    return months[monthName.toLowerCase()] || "01";
  }
}
