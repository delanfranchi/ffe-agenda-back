#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Nettoyage du cache...\n');

// Fonction pour supprimer récursivement un dossier
function removeDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`✅ Supprimé: ${dirPath}`);
            return true;
        } catch (error) {
            console.log(`❌ Erreur lors de la suppression de ${dirPath}:`, error.message);
            return false;
        }
    } else {
        console.log(`ℹ️  Dossier inexistant: ${dirPath}`);
        return true;
    }
}

// Fonction pour supprimer un fichier
function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`✅ Supprimé: ${filePath}`);
            return true;
        } catch (error) {
            console.log(`❌ Erreur lors de la suppression de ${filePath}:`, error.message);
            return false;
        }
    } else {
        console.log(`ℹ️  Fichier inexistant: ${filePath}`);
        return true;
    }
}

let success = true;

// 1. Supprimer le dossier .next (cache Next.js)
success &= removeDirectory(path.join(process.cwd(), '.next'));

// 2. Supprimer le dossier .vercel (cache Vercel)
success &= removeDirectory(path.join(process.cwd(), '.vercel'));

// 3. Supprimer node_modules/.cache si il existe
success &= removeDirectory(path.join(process.cwd(), 'node_modules', '.cache'));

// 4. Supprimer les fichiers de cache TypeScript
success &= removeDirectory(path.join(process.cwd(), '.tsbuildinfo'));

// 5. Supprimer les fichiers de cache ESLint
success &= removeDirectory(path.join(process.cwd(), '.eslintcache'));

// 6. Supprimer les fichiers de cache Turbopack
success &= removeDirectory(path.join(process.cwd(), '.turbo'));

// 7. Nettoyer le cache Node.js
try {
    // Vider le cache require
    Object.keys(require.cache).forEach(key => {
        delete require.cache[key];
    });
    console.log('✅ Cache Node.js vidé');
} catch (error) {
    console.log('❌ Erreur lors du nettoyage du cache Node.js:', error.message);
    success = false;
}

console.log('\n' + '='.repeat(50));

if (success) {
    console.log('🎉 Cache nettoyé avec succès !');
    console.log('\n💡 Conseils :');
    console.log('   • Redémarrez le serveur de développement avec: npm run dev');
    console.log('   • Les données seront re-récupérées depuis la FFE');
    console.log('   • Les nouvelles modifications du scraper seront prises en compte');
} else {
    console.log('⚠️  Nettoyage partiel - certaines erreurs sont survenues');
    console.log('   Vérifiez les messages ci-dessus pour plus de détails');
}

process.exit(success ? 0 : 1);
