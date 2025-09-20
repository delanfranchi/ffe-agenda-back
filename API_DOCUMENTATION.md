# Documentation API - FFE Chess Agenda

## Vue d'ensemble

L'API FFE Chess Agenda permet de récupérer les informations sur les tournois d'échecs organisés par la Fédération Française d'Échecs (FFE).

## Endpoints disponibles

### 1. Liste des tournois (Agenda)

**GET** `/api/agenda`

Récupère la liste des tournois d'échecs pour les départements spécifiés.

#### Paramètres de requête

- `department[]` (obligatoire) : Numéros des départements (peut être répété)
- `club` (optionnel) : Nom du club pour filtrer les tournois
- `showOnlyClub` (optionnel) : Afficher seulement les tournois où des joueurs du club sont inscrits (boolean)
- `limit` (optionnel) : Nombre maximum de résultats à retourner (1-100)
- `next` (optionnel) : Filtrer pour ne retourner que les événements à venir (boolean)

#### Exemples

```bash
# Tournois pour le département 37 (Indre-et-Loire)
GET /api/agenda?department[]=37

# Tournois pour plusieurs départements
GET /api/agenda?department[]=37&department[]=41

# Tournois futurs limités à 10 résultats
GET /api/agenda?department[]=37&next=true&limit=10

# Tournois avec des joueurs d'un club spécifique
GET /api/agenda?department[]=37&club=Club%20de%20Tours&showOnlyClub=true
```

### 2. Liste des tournois avec pagination

**GET** `/api/tournaments`

Récupère la liste des tournois avec support de la pagination.

#### Paramètres de requête

- `department` (obligatoire) : Numéro du département (format legacy)
- `department[]` (obligatoire) : Numéros des départements (peut être répété)
- `limit` (optionnel) : Nombre maximum de résultats à retourner
- `offset` (optionnel) : Nombre de résultats à ignorer (pour la pagination)
- `next` (optionnel) : Filtrer pour ne retourner que les événements à venir (boolean)

#### Exemples

```bash
# Premier lot de 20 tournois
GET /api/tournaments?department[]=37&limit=20&offset=0

# Tournois futurs avec pagination
GET /api/tournaments?department[]=37&next=true&limit=10&offset=20
```

### 3. Détails d'un tournoi

**GET** `/api/tournaments/{id}`

Récupère les informations détaillées d'un tournoi spécifique.

#### Paramètres de chemin

- `id` (obligatoire) : Identifiant unique du tournoi

#### Exemple

```bash
GET /api/tournaments/12345
```

### 4. Joueurs d'un tournoi

**GET** `/api/tournaments/{id}/players`

Récupère la liste des joueurs inscrits à un tournoi.

#### Paramètres de chemin

- `id` (obligatoire) : Identifiant unique du tournoi

#### Exemple

```bash
GET /api/tournaments/12345/players
```

## Structure des réponses

Toutes les réponses suivent le format standard :

```json
{
  "success": boolean,
  "data": object | array | null,
  "error": string | null,
  "lastUpdated": string
}
```

### Types de données

#### Tournament

```json
{
  "id": "string",
  "name": "string",
  "date": "string (ISO date)",
  "endDate": "string (ISO date) | undefined",
  "location": "string",
  "department": number,
  "type": "string",
  "status": "registration | ongoing | finished",
  "maxPlayers": "number | undefined",
  "currentPlayers": "number | undefined",
  "registrationDeadline": "string (ISO date) | undefined",
  "url": "string (URI)",
  "players": "Player[] | undefined"
}
```

#### Player

```json
{
  "id": "string",
  "name": "string",
  "firstName": "string",
  "club": "string",
  "elo": number,
  "category": "string",
  "isRegistered": boolean
}
```

## Documentation interactive

### Interface Swagger

Une documentation interactive est disponible à l'adresse : `/docs`

Cette interface permet de :
- Tester les endpoints directement depuis le navigateur
- Voir les schémas de données en détail
- Comprendre les paramètres requis et optionnels

### Spécification OpenAPI

La spécification OpenAPI complète est disponible à l'adresse : `/api/docs`

Cette spécification peut être utilisée pour :
- Générer des clients SDK
- Intégrer avec des outils de développement
- Valider les réponses de l'API

## Gestion du cache

L'API utilise un système de cache pour optimiser les performances :

- **Liste des tournois** : Cache de 20 heures (72000 secondes)
- **Détails des tournois** : Cache de 14 heures (50400 secondes)
- **Joueurs des tournois** : Cache de 14 heures (50400 secondes)

## Gestion des erreurs

### Codes de statut HTTP

- `200` : Succès
- `400` : Paramètres de requête invalides
- `500` : Erreur interne du serveur

### Format des erreurs

```json
{
  "success": false,
  "error": "Description de l'erreur",
  "lastUpdated": "2024-03-01T10:30:00.000Z"
}
```

## Exemples d'utilisation

### JavaScript/TypeScript

```typescript
// Récupérer les tournois du département 37
const response = await fetch('/api/agenda?department[]=37');
const data = await response.json();

if (data.success) {
  console.log('Tournois trouvés:', data.data.length);
  data.data.forEach(tournament => {
    console.log(`${tournament.name} - ${tournament.location} - ${tournament.date}`);
  });
} else {
  console.error('Erreur:', data.error);
}
```

### cURL

```bash
# Récupérer les tournois futurs du département 37
curl "http://localhost:3012/api/agenda?department[]=37&next=true&limit=5"

# Récupérer les détails d'un tournoi
curl "http://localhost:3012/api/tournaments/12345"

# Récupérer les joueurs d'un tournoi
curl "http://localhost:3012/api/tournaments/12345/players"
```

## Génération de la documentation

Pour régénérer la documentation OpenAPI :

```bash
npm run generate:openapi
```

Cette commande génère un fichier `openapi.json` à la racine du projet.

## Développement

### Ajout de nouveaux endpoints

1. Créer la route dans `src/app/api/`
2. Ajouter la documentation Swagger avec les commentaires JSDoc
3. Mettre à jour les types dans `src/types/chess.ts` si nécessaire
4. Régénérer la documentation OpenAPI

### Modification des types

1. Modifier les types dans `src/types/chess.ts` ou `src/_types/index.ts`
2. Mettre à jour les schémas OpenAPI dans `src/lib/swagger.ts`
3. Régénérer la documentation OpenAPI

## Support

Pour toute question ou problème, consultez :
- La documentation interactive sur `/docs`
- La spécification OpenAPI sur `/api/docs`
- Le code source sur GitHub
