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
      try {
        players = await this.getTournamentPlayers(tournamentId);
      } catch {
        // Si la récupération des joueurs échoue, continuer sans joueurs
        // Pas de log pour éviter de flooder
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
   * Parse la liste des tournois depuis la page ListeTournois
   */
  private parseTournamentsList(html: string): Tournament[] {
    const $ = cheerio.load(html);
    const tournaments: Tournament[] = [];
    let currentYear = new Date().getFullYear(); // Année par défaut

    // Chercher le tableau des tournois
    $("table tr").each((_index, element) => {
      const $row = $(element);

      // Si c'est une ligne de titre (mois/année), extraire l'année
      if (
        $row.hasClass("liste_titre") ||
        $row.find("td.liste_titre").length > 0
      ) {
        const titleText = $row.text().trim();
        // Chercher une année dans le texte (format: "mois 20XX")
        const yearMatch = titleText.match(/(20\d{2})/);
        if (yearMatch) {
          currentYear = parseInt(yearMatch[1]);
        }
        return;
      }

      // Skip les lignes vides ou avec moins de cellules
      const $cells = $row.find("td");
      if ($cells.length < 8) {
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

      // Extraire la date avec l'année courante
      const dateText = dateCell.text().trim();
      const date = this.parseDate(dateText, currentYear);

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
        date: date.toISOString(),
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
    const date = this.parseDate(dateText);
    const endDate = this.extractEndDate($);

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
    const currentPlayers = this.extractCurrentPlayers($);
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
   * Parse une date depuis le texte
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

    // Format français: "24 avr." ou "24 avril"
    const frenchFormat = /(\d{1,2})\s+(\w+\.?)/;
    const frenchMatch = dateText.match(frenchFormat);

    if (frenchMatch) {
      const day = parseInt(frenchMatch[1]);
      const monthText = frenchMatch[2].toLowerCase();
      const month = monthMap[monthText];

      if (month !== undefined) {
        // Si on a un hint d'année (depuis les lignes de titre), l'utiliser directement
        if (yearHint !== undefined) {
          return new Date(yearHint, month, day);
        }

        // Sinon, utiliser la logique de fallback pour déterminer l'année
        const currentYear = new Date().getFullYear();
        let year = currentYear;
        let calculatedDate = new Date(year, month, day);

        // Si la date est trop loin dans le passé (plus de 2 ans),
        // c'est probablement un tournoi de l'année précédente
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(currentYear - 2);

        if (calculatedDate < twoYearsAgo) {
          year = currentYear - 1;
          calculatedDate = new Date(year, month, day);
        }

        // Si la date est encore trop loin dans le passé (plus de 2 ans),
        // c'est peut-être encore plus ancien
        if (calculatedDate < twoYearsAgo) {
          year = currentYear - 2;
          calculatedDate = new Date(year, month, day);
        }

        // Si la date est dans le futur lointain (plus de 2 ans),
        // c'est probablement pour l'année suivante
        const twoYearsFromNow = new Date();
        twoYearsFromNow.setFullYear(currentYear + 2);

        if (calculatedDate > twoYearsFromNow) {
          year = currentYear + 1;
          calculatedDate = new Date(year, month, day);
        }

        return calculatedDate;
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

  private extractLocation($: cheerio.Root): string {
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

  private extractCurrentPlayers($: cheerio.Root): number | undefined {
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

  private extractEndDate($: cheerio.Root): Date | undefined {
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
          resultsLinks[key] = this.baseUrl + "/" + href;
        }
      }
    });

    return resultsLinks;
  }
}
