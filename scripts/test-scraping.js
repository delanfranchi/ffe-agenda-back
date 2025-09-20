#!/usr/bin/env node

// Test simple du scraping FFE
async function testScraping() {
    console.log('🧪 Testing FFE scraping...\n');

    try {
        // Test 1: Vérifier que l'URL de la FFE est accessible
        console.log('📋 Test 1: Vérification de l\'accessibilité du site FFE');
        const testUrl = 'https://www.echecs.asso.fr/ListeTournois.aspx?Action=TOURNOICOMITE&ComiteRef=37';
        console.log(`URL: ${testUrl}`);

        const response = await fetch(testUrl, {
            headers: {
                'User-Agent': 'ChessAgenda/1.0 (https://github.com/chess-agenda)'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        console.log(`✅ Site accessible - ${html.length} caractères reçus`);

        // Vérifier la présence de certains éléments
        if (html.includes('ListeTournois') || html.includes('tournoi')) {
            console.log('✅ Contenu de tournois détecté');
        } else {
            console.log('⚠️  Contenu de tournois non détecté - structure peut-être différente');
        }

        // Test 2: Vérifier une page de détail de tournoi
        console.log('\n🔍 Test 2: Vérification d\'une page de détail');
        const detailUrl = 'https://www.echecs.asso.fr/FicheTournoi.aspx?Ref=68600';
        console.log(`URL: ${detailUrl}`);

        const detailResponse = await fetch(detailUrl, {
            headers: {
                'User-Agent': 'ChessAgenda/1.0 (https://github.com/chess-agenda)'
            }
        });

        if (detailResponse.ok) {
            const detailHtml = await detailResponse.text();
            console.log(`✅ Page de détail accessible - ${detailHtml.length} caractères reçus`);

            if (detailHtml.includes('FicheTournoi') || detailHtml.includes('tournoi')) {
                console.log('✅ Contenu de détail de tournoi détecté');
            }
        } else {
            console.log(`⚠️  Page de détail non accessible - status: ${detailResponse.status}`);
        }

        // Test 3: Vérifier une page de résultats
        console.log('\n👥 Test 3: Vérification d\'une page de résultats');
        const resultsUrl = 'https://www.echecs.asso.fr/Resultats.aspx?URL=Tournois/Id/68600/68600&Action=Ls';
        console.log(`URL: ${resultsUrl}`);

        const resultsResponse = await fetch(resultsUrl, {
            headers: {
                'User-Agent': 'ChessAgenda/1.0 (https://github.com/chess-agenda)'
            }
        });

        if (resultsResponse.ok) {
            const resultsHtml = await resultsResponse.text();
            console.log(`✅ Page de résultats accessible - ${resultsHtml.length} caractères reçus`);

            if (resultsHtml.includes('Resultats') || resultsHtml.includes('joueur')) {
                console.log('✅ Contenu de résultats détecté');
            }
        } else {
            console.log(`⚠️  Page de résultats non accessible - status: ${resultsResponse.status}`);
        }

        console.log('\n🎉 Tests de connectivité terminés!');
        console.log('\n📝 Prochaines étapes:');
        console.log('   1. Analyser la structure HTML des pages pour adapter les sélecteurs');
        console.log('   2. Tester le scraping avec cheerio');
        console.log('   3. Implémenter la logique de parsing des données');

    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Exécuter les tests
testScraping();