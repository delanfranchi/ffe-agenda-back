import * as cheerio from "cheerio";
import {
  Tournament,
  Player,
  TournamentDetailsResponse,
  ResultsLinks,
} from "@/types/chess";

export class FFEScraper {
  private baseUrl = "https://www.echecs.asso.fr";
  private userAgent = "ChessAgenda/1.0 (https://github.com/chess-agenda)";

  // Cache en mémoire pour les tournois
  private tournamentCache = new Map<
    string,
    { data: Tournament; timestamp: number }
  >();
  private tournamentIdsCache = new Map<
    number,
    { data: string[]; timestamp: number }
  >();

  // TTL du cache (20 heures) - aligné avec la fréquence de mise à jour FFE
  private readonly CACHE_TTL = 20 * 60 * 60 * 1000;

  /**
   * Récupère la liste des tournois pour un département donné
   * Nouvelle approche : extraire les IDs depuis ListeTournois.aspx puis récupérer les détails en parallèle
   */
  async getTournamentsByDepartment(department: number): Promise<Tournament[]> {
    try {
      // 1. Récupérer les IDs des tournois depuis la page du comité (avec cache)
      const tournamentIds = await this.getTournamentIdsFromComite(department);

      // 2. Récupérer les détails de chaque tournoi EN PARALLÈLE (sans joueurs pour optimiser)
      const tournamentPromises = tournamentIds.map(async (tournamentId) => {
        try {
          const tournamentDetails = await this.getTournamentDetails(
            tournamentId,
            false
          );
          const tournament = tournamentDetails.tournament;

          // 3. Filtrer les événements passés de plus de 2 jours
          if (this.isTournamentRecent(tournament)) {
            // Exclure uniquement les joueurs pour alléger la réponse
            // Garder toutes les autres données (adresse, organisateur, prix, etc.)
            const { players, ...tournamentWithoutPlayers } = tournament;
            return tournamentWithoutPlayers;
          }
          return null;
        } catch (error) {
          console.warn(
            `Failed to fetch details for tournament ${tournamentId}:`,
            error
          );
          return null;
        }
      });

      // 4. Attendre toutes les requêtes en parallèle
      const tournamentResults = await Promise.all(tournamentPromises);

      // 5. Filtrer les résultats null
      const tournaments = tournamentResults.filter(
        (tournament): tournament is Tournament => tournament !== null
      );

      return tournaments;
    } catch (error) {
      console.error(
        `Error fetching tournaments for department ${department}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Récupère les détails d'un tournoi spécifique (avec cache)
   */
  async getTournamentDetails(
    tournamentId: string,
    withPlayers: boolean = true
  ): Promise<TournamentDetailsResponse> {
    // Vérifier le cache
    const cached = this.tournamentCache.get(tournamentId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return {
        tournament: cached.data,
        lastUpdated: new Date(cached.timestamp).toISOString(),
      };
    }
    const tournamentUrl = `${this.baseUrl}/FicheTournoi.aspx?Ref=${tournamentId}`;

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

      // Récupérer la liste des joueurs (optionnel)
      let players: Player[] = [];
      if (withPlayers) {
        try {
          players = await this.getTournamentPlayers(tournamentId);
        } catch {
          // Si la récupération des joueurs échoue, continuer sans joueurs
          // Pas de log pour éviter de flooder
        }
      }

      const tournamentWithPlayers = {
        ...tournament,
        players,
      };

      // Mettre en cache (sans joueurs pour la liste)
      const { players: _, ...tournamentForCache } = tournamentWithPlayers;
      this.tournamentCache.set(tournamentId, {
        data: tournamentForCache,
        timestamp: Date.now(),
      });

      return {
        tournament: tournamentWithPlayers,
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
   * Récupère les IDs des tournois depuis la page de liste des tournois du comité (avec cache)
   */
  private async getTournamentIdsFromComite(
    department: number
  ): Promise<string[]> {
    // Vérifier le cache
    const cached = this.tournamentIdsCache.get(department);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const comiteUrl = `${this.baseUrl}/ListeTournois.aspx?Action=TOURNOICOMITE&ComiteRef=${department}`;

    try {
      const response = await fetch(comiteUrl, {
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const tournamentIds = this.parseTournamentIdsFromComite(html);

      // Mettre en cache
      this.tournamentIdsCache.set(department, {
        data: tournamentIds,
        timestamp: Date.now(),
      });

      return tournamentIds;
    } catch (error) {
      console.error(
        `Error fetching tournament list for department ${department}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Parse les IDs des tournois depuis la page de liste des tournois
   */
  private parseTournamentIdsFromComite(html: string): string[] {
    const $ = cheerio.load(html);
    const tournamentIds: string[] = [];

    // Chercher les liens vers les tournois dans la page du comité
    // Format attendu : FicheTournoi.aspx?Ref=12345
    $('a[href*="FicheTournoi.aspx?Ref="]').each((_index, element) => {
      const href = $(element).attr("href");
      if (href) {
        const match = href.match(/FicheTournoi\.aspx\?Ref=(\d+)/);
        if (match && match[1]) {
          const tournamentId = match[1];
          // Éviter les doublons
          if (!tournamentIds.includes(tournamentId)) {
            tournamentIds.push(tournamentId);
          }
        }
      }
    });

    return tournamentIds;
  }

  /**
   * Vérifie si un tournoi est récent (pas passé de plus de 2 jours)
   */
  private isTournamentRecent(tournament: Tournament): boolean {
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);

    // Utiliser la date de fin si disponible, sinon la date de début
    const endDate = tournament.endDate
      ? new Date(tournament.endDate)
      : new Date(tournament.startDate);

    return endDate >= twoDaysAgo;
  }

  /**
   * Récupère uniquement la liste des joueurs d'un tournoi
   */
  async getTournamentPlayers(tournamentId: string): Promise<Player[]> {
    const playersUrl = `${this.baseUrl}/Resultats.aspx?URL=Tournois/Id/${tournamentId}/${tournamentId}&Action=Ls`;

    try {
      const response = await fetch(playersUrl, {
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) {
        // Si la page n'existe pas (404) ou autre erreur, retourner une liste vide
        return [];
      }

      const html = await response.text();
      return this.parsePlayersList(html);
    } catch {
      // Erreur silencieuse, retourner une liste vide
      return [];
    }
  }

  /**
   * Trouve l'année en remontant vers la ligne liste_titre précédente
   */
  private findPreviousYear($currentRow: cheerio.Cheerio): number | undefined {
    let $prevRow = $currentRow.prev();

    while ($prevRow.length > 0) {
      // Si c'est une ligne de titre (mois/année), extraire l'année
      if (
        $prevRow.hasClass("liste_titre") ||
        $prevRow.find("td.liste_titre").length > 0
      ) {
        const titleText = $prevRow.text().trim();
        // Chercher une année dans le texte (format: "mois 20XX")
        return parseInt(titleText.split(" ")[1]);
      }
      $prevRow = $prevRow.prev();
    }

    return undefined;
  }

  /**
   * Parse la liste des tournois depuis la page ListeTournois
   */
  private parseTournamentsList(html: string): Tournament[] {
    const $ = cheerio.load(html);
    const tournaments: Tournament[] = [];

    // Chercher le tableau des tournois
    $("table tr").each((_index, element) => {
      const $row = $(element);

      // Skip les lignes qui ne sont pas des lignes de tournois
      const $cells = $row.find("td");
      if (!($row.hasClass("liste_clair") || $row.hasClass("liste_fonce"))) {
        return;
      }

      // Trouver l'année en remontant vers la ligne liste_titre précédente
      const currentYear = this.findPreviousYear($row);
      if (!currentYear) {
        return;
      }

      // Structure : ID, Ville, Département, Nom (lien), Date, Type, Status1, Status2
      const idCell = $cells.eq(0);
      const cityCell = $cells.eq(1);
      const departmentCell = $cells.eq(2);
      const nameCell = $cells.eq(3);
      const dateCell = $cells.eq(4);
      const typeCell = $cells.eq(5);
      const status1Cell = $cells.eq(6);
      const status2Cell = $cells.eq(7);

      // Extraire l'ID depuis la première colonne
      const tournamentId = idCell.text().trim();

      // Vérifier que l'ID est un nombre valide (pas de pagination ou autres données)
      if (!tournamentId || !/^\d+$/.test(tournamentId)) {
        return;
      }

      // Extraire le nom depuis le lien
      const name = nameCell.find("a").text().trim();
      if (!name) return;

      // Extraire la ville
      const city = cityCell.text().trim();
      if (!city) return;

      // Extraire le département
      const department = parseInt(departmentCell.text().trim()) || 0;
      if (department === 0) return;

      // Extraire la date avec l'année trouvée
      const dateText = dateCell.text().trim();
      const { startDate } = this.parseDateRange(dateText, currentYear);

      // Extraire le type
      const type = typeCell.text().trim();
      if (!type) return;

      // Déterminer le statut
      const status1 = status1Cell.text().trim();
      const status2 = status2Cell.text().trim();
      const status = this.determineStatus(status1, status2);

      // Construire l'URL complète
      const url = `${this.baseUrl}/FicheTournoi.aspx?Ref=${tournamentId}`;

      tournaments.push({
        id: tournamentId,
        name,
        startDate: this.formatDateWithTimezone(startDate),
        location: city,
        department,
        type,
        status,
        url,
      });
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

    // Extraire le nom du tournoi depuis le titre principal
    const name = this.extractTournamentName($);

    // Extraire les dates
    const dateText = this.extractDate($);
    const { startDate, endDate } = this.parseDateRange(dateText);

    // Extraire la localisation
    const location = this.extractLocation($);
    const department = this.extractDepartment($);
    const address = this.extractAddress($);

    // Extraire les informations de compétition
    const type = this.extractType($);
    const status = this.extractStatus($);
    const rounds = this.extractRounds($);
    const timeControl = this.extractTimeControl($);
    const pairingSystem = this.extractPairingSystem($);

    // Extraire les informations d'inscription
    const maxPlayers = this.extractMaxPlayers($);
    const registrationDeadline = this.extractRegistrationDeadline($);
    const seniorFee = this.extractSeniorFee($);
    const juniorFee = this.extractJuniorFee($);

    // Extraire les informations d'organisation
    const organizer = this.extractOrganizer($);
    const referee = this.extractReferee($);
    const contact = this.extractContact($);

    // Extraire les prix détaillés
    const firstPrize = this.extractFirstPrize($);
    const secondPrize = this.extractSecondPrize($);
    const thirdPrize = this.extractThirdPrize($);

    // Extraire les informations Elo
    const eloRapid = this.extractEloRapid($);
    const eloFide = this.extractEloFide($);

    // Extraire les informations supplémentaires
    const announcement = this.extractAnnouncement($);
    const regulationLink = this.extractRegulationLink($);
    const resultsLinks = this.extractResultsLinks($);

    // Construire l'URL
    const url = `${this.baseUrl}/FicheTournoi.aspx?Ref=${tournamentId}`;

    return {
      id: tournamentId,
      name: name || `Tournoi ${tournamentId}`,
      startDate: this.formatDateWithTimezone(startDate),
      endDate: endDate ? this.formatDateWithTimezone(endDate) : undefined,
      location: location || "Non spécifié",
      department: department || 0,
      type: type || "Non spécifié",
      status: status as "registration" | "ongoing" | "finished",
      url,
      maxPlayers,
      registrationDeadline: registrationDeadline
        ? this.formatDateWithTimezone(registrationDeadline)
        : undefined,
      // Nouvelles propriétés étendues
      address,
      rounds,
      timeControl,
      pairingSystem,
      seniorFee,
      juniorFee,
      organizer,
      referee,
      contact,
      firstPrize,
      secondPrize,
      thirdPrize,
      eloRapid,
      eloFide,
      announcement,
      regulationLink,
      resultsLinks,
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

        // Skip placeholder/header entries with generic names
        if (
          fullName === "Nom" ||
          club === "Club" ||
          category === "Cat." ||
          federation === "Fede" ||
          league === "Ligue"
        ) {
          return;
        }

        // Générer un ID unique basé sur le nom complet et l'Elo
        const nameSlug = fullName.toLowerCase().replace(/\s+/g, "-");
        const playerId = `${nameSlug}-${elo}`;

        players.push({
          id: playerId,
          name: fullName,
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
   * Parse une plage de dates depuis le texte
   * Retourne startDate et endDate (endDate seulement si différente de startDate)
   */
  private parseDateRange(
    dateText: string,
    yearHint?: number
  ): { startDate: Date; endDate?: Date } {
    if (!dateText) {
      const fallbackDate = new Date();
      return { startDate: fallbackDate };
    }

    // Format complet avec plage: "dimanche 28 septembre 2025 - dimanche 5 octobre 2025"
    const fullDateRangeFormat =
      /(\w+)\s+(\d{1,2})\s+(\w+)\s+(\d{4})\s*-\s*(\w+)\s+(\d{1,2})\s+(\w+)\s+(\d{4})/;
    const fullDateRangeMatch = dateText.match(fullDateRangeFormat);

    if (fullDateRangeMatch) {
      const startDay = parseInt(fullDateRangeMatch[2]);
      const startMonthText = fullDateRangeMatch[3].toLowerCase();
      const startYear = parseInt(fullDateRangeMatch[4]);
      const startMonth = this.getMonthFromText(startMonthText);

      const endDay = parseInt(fullDateRangeMatch[6]);
      const endMonthText = fullDateRangeMatch[7].toLowerCase();
      const endYear = parseInt(fullDateRangeMatch[8]);
      const endMonth = this.getMonthFromText(endMonthText);

      if (startMonth !== undefined && endMonth !== undefined) {
        const startDate = new Date(startYear, startMonth, startDay);
        const endDate = new Date(endYear, endMonth, endDay);

        // Ne retourner endDate que si elle est différente de startDate
        if (startDate.getTime() !== endDate.getTime()) {
          return { startDate, endDate };
        } else {
          return { startDate };
        }
      }
    }

    // Format français avec plage: "24 avr. - 26 avr." ou "24 avril - 26 avril"
    const frenchRangeFormat = /(\d{1,2})\s+(\w+\.?)\s*-\s*(\d{1,2})\s+(\w+\.?)/;
    const frenchRangeMatch = dateText.match(frenchRangeFormat);

    if (frenchRangeMatch) {
      const startDay = parseInt(frenchRangeMatch[1]);
      const startMonthText = frenchRangeMatch[2].toLowerCase();
      const startMonth = this.getMonthFromText(startMonthText);

      const endDay = parseInt(frenchRangeMatch[3]);
      const endMonthText = frenchRangeMatch[4].toLowerCase();
      const endMonth = this.getMonthFromText(endMonthText);

      if (startMonth !== undefined && endMonth !== undefined) {
        // Utiliser l'année du hint si disponible
        const year = yearHint || new Date().getFullYear();
        const startDate = new Date(year, startMonth, startDay);
        const endDate = new Date(year, endMonth, endDay);

        // Ne retourner endDate que si elle est différente de startDate
        if (startDate.getTime() !== endDate.getTime()) {
          return { startDate, endDate };
        } else {
          return { startDate };
        }
      }
    }

    // Format simple: une seule date
    const singleDate = this.parseDate(dateText, yearHint);
    return { startDate: singleDate };
  }

  /**
   * Formate une date avec le fuseau horaire français (Europe/Paris)
   */
  private formatDateWithTimezone(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    // Déterminer si c'est l'heure d'été (DST) en France
    const isDST = this.isDaylightSavingTime(date);
    const timezoneOffset = isDST ? "+02:00" : "+01:00";

    return `${year}-${month}-${day}T00:00:00${timezoneOffset}`;
  }

  /**
   * Détermine si une date est en heure d'été (DST) en France
   * DST en France : dernier dimanche de mars à dernier dimanche d'octobre
   */
  private isDaylightSavingTime(date: Date): boolean {
    const year = date.getFullYear();

    // Dernier dimanche de mars
    const marchLastSunday = this.getLastSundayOfMonth(year, 2); // mois 2 = mars (0-indexé)

    // Dernier dimanche d'octobre
    const octoberLastSunday = this.getLastSundayOfMonth(year, 9); // mois 9 = octobre (0-indexé)

    return date >= marchLastSunday && date < octoberLastSunday;
  }

  /**
   * Trouve le dernier dimanche d'un mois donné
   */
  private getLastSundayOfMonth(year: number, month: number): Date {
    // Dernier jour du mois
    const lastDay = new Date(year, month + 1, 0);

    // Trouver le dernier dimanche
    const dayOfWeek = lastDay.getDay(); // 0 = dimanche, 1 = lundi, etc.
    const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek; // Si c'est déjà dimanche, on soustrait 0

    return new Date(year, month, lastDay.getDate() - daysToSubtract);
  }

  /**
   * Extrait le numéro du mois depuis le texte français
   */
  private getMonthFromText(monthText: string): number | undefined {
    const monthMap: { [key: string]: number } = {
      "janv.": 0,
      janvier: 0,
      "févr.": 1,
      février: 1,
      mars: 2,
      "avr.": 3,
      avril: 3,
      mai: 4,
      juin: 5,
      "juil.": 6,
      juillet: 6,
      août: 7,
      "sept.": 8,
      septembre: 8,
      "oct.": 9,
      octobre: 9,
      "nov.": 10,
      novembre: 10,
      "déc.": 11,
      décembre: 11,
    };

    return monthMap[monthText.toLowerCase()];
  }

  /**
   * Parse une date depuis le texte (méthode legacy pour compatibilité)
   */
  private parseDate(dateText: string, yearHint?: number): Date {
    if (!dateText) return new Date();

    // Mapping des mois français
    const monthMap: { [key: string]: number } = {
      "janv.": 0,
      janvier: 0,
      "févr.": 1,
      février: 1,
      mars: 2,
      "avr.": 3,
      avril: 3,
      mai: 4,
      juin: 5,
      "juil.": 6,
      juillet: 6,
      août: 7,
      "sept.": 8,
      septembre: 8,
      "oct.": 9,
      octobre: 9,
      "nov.": 10,
      novembre: 10,
      "déc.": 11,
      décembre: 11,
    };

    // Format complet: "dimanche 28 septembre 2025 - dimanche 28 septembre 2025"
    const fullDateFormat = /(\w+)\s+(\d{1,2})\s+(\w+)\s+(\d{4})/;
    const fullDateMatch = dateText.match(fullDateFormat);

    if (fullDateMatch) {
      const day = parseInt(fullDateMatch[2]);
      const monthText = fullDateMatch[3];
      const year = parseInt(fullDateMatch[4]);
      const month = this.getMonthFromText(monthText);

      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }

    // Format français: "24 avr." ou "24 avril"
    const frenchFormat = /(\d{1,2})\s+(\w+\.?)/;
    const frenchMatch = dateText.match(frenchFormat);

    if (frenchMatch) {
      const day = parseInt(frenchMatch[1]);
      const monthText = frenchMatch[2];
      const month = this.getMonthFromText(monthText);

      if (month !== undefined) {
        // Si on a un hint d'année (depuis les lignes de titre), l'utiliser directement
        if (yearHint !== undefined) {
          return new Date(yearHint, month, day);
        }
      }
    }

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
    // Dans la nouvelle structure, les colonnes de statut contiennent "X" ou sont vides
    // Il faut déterminer le statut basé sur la date du tournoi

    // Pour l'instant, on utilise une logique simple basée sur la présence de "X"
    // Dans un vrai système, il faudrait analyser les dates pour déterminer le statut

    // Si les deux colonnes sont vides, c'est probablement en inscription
    if (!status1 && !status2) {
      return "registration";
    }

    // Si il y a des "X", cela pourrait indiquer différents statuts
    // Pour l'instant, on considère que c'est en cours ou terminé selon la date
    return "registration"; // Default - à améliorer avec la logique de date
  }

  // Méthodes d'extraction pour les détails du tournoi
  private extractDate($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const dateElement = $("#ctl00_ContentPlaceHolderMain_LabelDates");
    if (dateElement.length > 0) {
      const text = dateElement.text().trim();
      if (text) {
        return text;
      }
    }

    // Fallback vers les sélecteurs génériques
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

  private extractLocation($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const locationElement = $("#ctl00_ContentPlaceHolderMain_LabelLieu");
    if (locationElement.length > 0) {
      const text = locationElement.text().trim();
      // Extraire la ville depuis "37 - DESCARTES"
      const parts = text.split(" - ");
      if (parts.length > 1) {
        return parts[1].trim();
      }
      return text;
    }

    // Fallback vers les sélecteurs génériques
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

  private extractDepartment($: cheerio.Root): number {
    // Utiliser l'ID spécifique de la FFE
    const locationElement = $("#ctl00_ContentPlaceHolderMain_LabelLieu");
    if (locationElement.length > 0) {
      const text = locationElement.text().trim();
      // Extraire le département depuis "37 - DESCARTES"
      const parts = text.split(" - ");
      if (parts.length > 0) {
        const deptMatch = parts[0].match(/(\d+)/);
        if (deptMatch) {
          return parseInt(deptMatch[1]);
        }
      }
    }

    // Fallback vers les sélecteurs génériques
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

  private extractType($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const typeElement = $("#ctl00_ContentPlaceHolderMain_LabelHomologuePar");
    if (typeElement.length > 0) {
      return typeElement.text().trim();
    }

    // Fallback vers les sélecteurs génériques
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

  private extractStatus($: cheerio.Root): string {
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

  private extractMaxPlayers($: cheerio.Root): number | undefined {
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

  private extractRegistrationDeadline($: cheerio.Root): Date | undefined {
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

  // Nouvelles méthodes d'extraction pour les détails étendus
  private extractTournamentName($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const nameElement = $("#ctl00_ContentPlaceHolderMain_LabelNom");
    if (nameElement.length > 0) {
      return nameElement.text().trim();
    }

    // Fallback vers les sélecteurs génériques
    const titleSelectors = [
      "h1",
      "h2",
      ".title",
      ".tournament-name",
      "table tr:first-child td:first-child",
    ];

    for (const selector of titleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text && text.length > 0) {
          return text;
        }
      }
    }

    return "";
  }

  private extractAddress($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const addressElement = $("#ctl00_ContentPlaceHolderMain_LabelAdresse");
    if (addressElement.length > 0) {
      return addressElement.text().trim();
    }

    // Fallback vers les sélecteurs génériques
    const addressSelectors = [
      "td:contains('Adresse')",
      "th:contains('Adresse')",
    ];

    for (const selector of addressSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          return nextCell.text().trim();
        }
      }
    }

    return "";
  }

  private extractRounds($: cheerio.Root): number | undefined {
    // Utiliser l'ID spécifique de la FFE
    const roundsElement = $("#ctl00_ContentPlaceHolderMain_LabelNbrRondes");
    if (roundsElement.length > 0) {
      const text = roundsElement.text().trim();
      const match = text.match(/(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
    }

    // Fallback
    const roundsSelectors = [
      "td:contains('Nombre de rondes')",
      "th:contains('Nombre de rondes')",
      "td:contains('rondes')",
      "th:contains('rondes')",
    ];

    for (const selector of roundsSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          const text = nextCell.text().trim();
          const match = text.match(/(\d+)/);
          if (match) {
            return parseInt(match[1]);
          }
        }
      }
    }

    return undefined;
  }

  private extractTimeControl($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const timeControlElement = $("#ctl00_ContentPlaceHolderMain_LabelCadence");
    if (timeControlElement.length > 0) {
      return timeControlElement.text().trim();
    }

    // Fallback
    const timeControlSelectors = [
      "td:contains('Cadence')",
      "th:contains('Cadence')",
      "td:contains('Temps')",
      "th:contains('Temps')",
    ];

    for (const selector of timeControlSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          return nextCell.text().trim();
        }
      }
    }

    return "";
  }

  private extractPairingSystem($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const pairingElement = $("#ctl00_ContentPlaceHolderMain_LabelAppariements");
    if (pairingElement.length > 0) {
      return pairingElement.text().trim();
    }

    // Fallback
    const pairingSelectors = [
      "td:contains('Appariements')",
      "th:contains('Appariements')",
      "td:contains('Système')",
      "th:contains('Système')",
    ];

    for (const selector of pairingSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          return nextCell.text().trim();
        }
      }
    }

    return "";
  }

  private extractSeniorFee($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const seniorFeeElement = $(
      "#ctl00_ContentPlaceHolderMain_LabelInscriptionSenior"
    );
    if (seniorFeeElement.length > 0) {
      return seniorFeeElement.text().trim();
    }

    // Fallback
    const feeSelectors = [
      "td:contains('Inscription Senior')",
      "th:contains('Inscription Senior')",
    ];

    for (const selector of feeSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          return nextCell.text().trim();
        }
      }
    }

    return "";
  }

  private extractJuniorFee($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const juniorFeeElement = $(
      "#ctl00_ContentPlaceHolderMain_LabelInscriptionJeune"
    );
    if (juniorFeeElement.length > 0) {
      return juniorFeeElement.text().trim();
    }

    // Fallback
    const feeSelectors = [
      "td:contains('Inscription Jeunes')",
      "th:contains('Inscription Jeunes')",
    ];

    for (const selector of feeSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          return nextCell.text().trim();
        }
      }
    }

    return "";
  }

  private extractOrganizer($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const organizerElement = $(
      "#ctl00_ContentPlaceHolderMain_LabelOrganisateur"
    );
    if (organizerElement.length > 0) {
      return organizerElement.text().trim();
    }

    // Fallback
    const organizerSelectors = [
      "td:contains('Organisateur')",
      "th:contains('Organisateur')",
    ];

    for (const selector of organizerSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          return nextCell.text().trim();
        }
      }
    }

    return "";
  }

  private extractReferee($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const refereeElement = $("#ctl00_ContentPlaceHolderMain_LabelArbitre");
    if (refereeElement.length > 0) {
      return refereeElement.text().trim();
    }

    // Fallback
    const refereeSelectors = [
      "td:contains('Arbitre')",
      "th:contains('Arbitre')",
    ];

    for (const selector of refereeSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          return nextCell.text().trim();
        }
      }
    }

    return "";
  }

  private extractContact($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const contactElement = $("#ctl00_ContentPlaceHolderMain_LabelContact");
    if (contactElement.length > 0) {
      return contactElement.text().trim();
    }

    // Fallback
    const contactSelectors = [
      "td:contains('Contact')",
      "th:contains('Contact')",
    ];

    for (const selector of contactSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          return nextCell.text().trim();
        }
      }
    }

    return "";
  }

  private extractEloRapid($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const eloRapidElement = $("#ctl00_ContentPlaceHolderMain_LabelEloRapide");
    if (eloRapidElement.length > 0) {
      return eloRapidElement.text().trim();
    }

    // Fallback
    const eloSelectors = [
      "td:contains('Prise en compte Elo Rapide')",
      "th:contains('Prise en compte Elo Rapide')",
    ];

    for (const selector of eloSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          return nextCell.text().trim();
        }
      }
    }

    return "";
  }

  private extractEloFide($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const eloFideElement = $("#ctl00_ContentPlaceHolderMain_LabelEloFide");
    if (eloFideElement.length > 0) {
      return eloFideElement.text().trim();
    }

    // Fallback
    const eloSelectors = [
      "td:contains('Prise en compte Elo FIDE')",
      "th:contains('Prise en compte Elo FIDE')",
    ];

    for (const selector of eloSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const nextCell = element.next();
        if (nextCell.length > 0) {
          return nextCell.text().trim();
        }
      }
    }

    return "";
  }

  // Nouvelles méthodes pour les prix détaillés et informations supplémentaires
  private extractFirstPrize($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const firstPrizeElement = $("#ctl00_ContentPlaceHolderMain_LabelPrix1");
    if (firstPrizeElement.length > 0) {
      return firstPrizeElement.text().trim();
    }

    return "";
  }

  private extractSecondPrize($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const secondPrizeElement = $("#ctl00_ContentPlaceHolderMain_LabelPrix2");
    if (secondPrizeElement.length > 0) {
      return secondPrizeElement.text().trim();
    }

    return "";
  }

  private extractThirdPrize($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const thirdPrizeElement = $("#ctl00_ContentPlaceHolderMain_LabelPrix3");
    if (thirdPrizeElement.length > 0) {
      return thirdPrizeElement.text().trim();
    }

    return "";
  }

  private extractAnnouncement($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const announcementElement = $("#ctl00_ContentPlaceHolderMain_LabelAnnonce");
    if (announcementElement.length > 0) {
      return announcementElement.text().trim();
    }

    return "";
  }

  private extractRegulationLink($: cheerio.Root): string {
    // Utiliser l'ID spécifique de la FFE
    const regulationLinkElement = $("#ctl00_ContentPlaceHolderMain_LinkRI");
    if (regulationLinkElement.length > 0) {
      const href = regulationLinkElement.attr("href");
      if (href) {
        return this.baseUrl + "/" + href;
      }
    }

    return "";
  }

  private extractResultsLinks($: cheerio.Root): ResultsLinks {
    const resultsLinks: ResultsLinks = {};

    // Extraire tous les liens de résultats
    const resultSelectors = [
      {
        key: "players",
        selector: "[href*='Action=Ls']",
      },
      {
        key: "grid",
        selector: "[href*='Action=Berger']",
      },
      {
        key: "ranking",
        selector: "[href*='Action=Cl']",
      },
      {
        key: "fide",
        selector: "[href*='Action=Fide']",
      },
      {
        key: "stats",
        selector: "[href*='Action=Stats']",
      },
    ];

    // Ajouter les rondes dynamiquement (Rd1 à Rd7)
    for (let i = 1; i <= 10; i++) {
      const roundKey = `round${i}`;
      const twoDigits = String(i).padStart(2, "0");
      const roundSelector = `[href*='Action=Rd${twoDigits}']`;
      resultSelectors.push({ key: roundKey, selector: roundSelector });
    }

    resultSelectors.forEach(({ key, selector }) => {
      const element = $(selector);
      if (element.length > 0) {
        const href = element.attr("href");
        if (href) {
          resultsLinks[key as keyof ResultsLinks] = this.baseUrl + "/" + href;
        }
      }
    });

    return resultsLinks;
  }
}
