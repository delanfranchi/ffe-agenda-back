# Chess FFE Agenda - Backend API

API backend pour récupérer les données des tournois d'échecs de la Fédération Française d'Échecs (FFE).

## 🏗️ Architecture

### Backend API (Next.js) - Port 3012
- **Technologies** : Next.js 15, TypeScript, Cheerio
- **Fonction** : Scraping des données FFE et exposition via API REST
- **Cache** : Next.js revalidate (1 heure)

## 🚀 Développement

```bash
# Démarrer l'API backend
npm run dev

# L'API sera disponible sur http://localhost:3012
```

### Tests
```bash
# Tester le scraping FFE
npm run test:scraping
```

## 📋 API Endpoints

- `GET /api/tournaments?department[]=37&department[]=41` - Liste des tournois (événements futurs uniquement)
- `GET /api/tournaments/68600` - Détails d'un tournoi
- `GET /api/tournaments/68600/players` - Joueurs d'un tournoi

## 📁 Structure du projet

```
chess-agenda-club2/
├── _types/                 # Types partagés entre frontend et backend
│   └── index.ts
├── src/                    # Backend Next.js
│   ├── app/
│   │   ├── api/           # Routes API
│   │   └── page.tsx       # Page d'accueil API
│   ├── services/          # Services de scraping
│   └── types/             # Types (réexport de _types + spécifiques)
└── scripts/               # Scripts utilitaires
```

## 🔗 Partage des types

Les types sont définis dans `_types/index.ts` et peuvent être importés par :
- **Backend Next.js** : `import { Tournament } from '@/types/chess'`
- **Frontend webcomponent** : `import { Tournament } from '../_types/index'`

## 🚀 Déploiement

```bash
# Déployer sur Vercel
npm run deploy
```

Le backend sera déployé sur Vercel et pourra être utilisé par n'importe quel frontend (webcomponent, React, Vue, etc.) en pointant vers l'API déployée.