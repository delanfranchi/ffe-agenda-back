#!/usr/bin/env node

/**
 * Script de déploiement pour Vercel
 * Prépare et déploie le projet complet (Backend + Webcomponent)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Déploiement Chess FFE Agenda sur Vercel...\n');

// Vérifier que Vercel CLI est installé
function checkVercelCLI() {
    try {
        execSync('vercel --version', { stdio: 'pipe' });
        console.log('✅ Vercel CLI détecté');
        return true;
    } catch (error) {
        console.log('❌ Vercel CLI non installé');
        console.log('💡 Installez-le avec: npm i -g vercel');
        return false;
    }
}

// Créer un fichier de configuration pour le déploiement
function createDeployConfig() {
    const config = {
        name: 'chess-ffe-agenda',
        version: '1.0.0',
        description: 'Chess FFE Agenda - Webcomponent pour les tournois d\'échecs FFE',
        main: 'next.config.ts',
        scripts: {
            build: 'next build',
            start: 'next start'
        },
        dependencies: {
            'next': '15.5.3',
            'lit': '^3.3.1',
            'cheerio': '^1.1.2'
        }
    };

    const configPath = path.join(__dirname, '..', 'deploy-package.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('📄 Configuration de déploiement créée');
    return configPath;
}

// Créer un README pour le déploiement
function createDeployReadme() {
    const readme = `# Chess FFE Agenda - Webcomponent

## 🎯 Description
Web component réutilisable pour afficher l'agenda des tournois d'échecs de la Fédération Française d'Échecs (FFE).

## 🚀 Déploiement
Ce projet se déploie automatiquement sur Vercel avec :
- **Backend API** : Routes Next.js pour le scraping FFE
- **Webcomponent** : Composant Lit intégré
- **Cache intelligent** : 1 heure de cache sur toutes les routes

## 📦 Utilisation du Webcomponent

### 1. Inclure le script
\`\`\`html
<script type="module" src="https://votre-domaine.vercel.app/_next/static/chunks/src_components_chess-agenda_ts.js"></script>
\`\`\`

### 2. Utiliser le composant
\`\`\`html
<chess-agenda 
  departements="[37,41,36]" 
  club="Echiquier Tourangeau"
  limit="5"
  showOnlyClub="true">
</chess-agenda>
\`\`\`

## 🔧 API Endpoints
- \`GET /api/tournaments?department[]=37&next=true\` - Liste des tournois
- \`GET /api/tournaments/[id]\` - Détails d'un tournoi
- \`GET /api/tournaments/[id]/players\` - Joueurs d'un tournoi
- \`GET /api/agenda?departements=[37]&next=true\` - Agenda filtré

## ⚡ Performance
- Cache Next.js : 1 heure (revalidate = 3600)
- Filtrage côté serveur : \`next=true\` pour les événements à venir
- Tri automatique par date croissante

## 🌐 URLs de déploiement
- **Page principale** : https://votre-domaine.vercel.app/
- **Page webcomponent** : https://votre-domaine.vercel.app/webcomponent
- **API** : https://votre-domaine.vercel.app/api/
`;

    const readmePath = path.join(__dirname, '..', 'DEPLOY.md');
    fs.writeFileSync(readmePath, readme);
    console.log('📄 README de déploiement créé');
    return readmePath;
}

// Fonction principale
async function main() {
    console.log('1️⃣ Vérification des prérequis...');
    if (!checkVercelCLI()) {
        process.exit(1);
    }

    console.log('\n2️⃣ Préparation du déploiement...');
    createDeployConfig();
    createDeployReadme();

    console.log('\n3️⃣ Instructions de déploiement:');
    console.log('   📦 Un seul build déploie tout (Backend + Webcomponent)');
    console.log('   🌐 Vercel héberge automatiquement:');
    console.log('      - API Backend: https://votre-domaine.vercel.app/api/');
    console.log('      - Webcomponent: https://votre-domaine.vercel.app/_next/static/chunks/src_components_chess-agenda_ts.js');
    console.log('      - Page de démo: https://votre-domaine.vercel.app/webcomponent');

    console.log('\n4️⃣ Commandes de déploiement:');
    console.log('   vercel login                    # Se connecter à Vercel');
    console.log('   vercel --prod                   # Déployer en production');
    console.log('   vercel domains add votre-domaine.com  # Ajouter un domaine personnalisé');

    console.log('\n5️⃣ Avantages de cette architecture:');
    console.log('   ✅ Un seul déploiement pour tout');
    console.log('   ✅ Cache intelligent intégré');
    console.log('   ✅ CDN global de Vercel');
    console.log('   ✅ Scaling automatique');
    console.log('   ✅ HTTPS automatique');

    console.log('\n6️⃣ Utilisation après déploiement:');
    console.log('   🔗 Intégrez le webcomponent sur n\'importe quel site:');
    console.log('   <script src="https://votre-domaine.vercel.app/_next/static/chunks/src_components_chess-agenda_ts.js"></script>');
    console.log('   <chess-agenda departements="[37]" limit="5"></chess-agenda>');

    console.log('\n✅ Prêt pour le déploiement !');
    console.log('   Lancez: vercel --prod');
}

main().catch(console.error);
