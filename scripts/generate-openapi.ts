#!/usr/bin/env tsx

import { writeFileSync } from "fs";
import { join } from "path";
import { getSwaggerSpec } from "../src/lib/swagger";

/**
 * Script pour générer automatiquement le schéma OpenAPI
 * Usage: npm run generate:openapi
 */

async function generateOpenAPIFile() {
  console.log("🔄 Génération du schéma OpenAPI...");

  try {
    // Générer le schéma OpenAPI
    const schema = await getSwaggerSpec();

    // Écrire le fichier
    const outputPath = join(process.cwd(), "openapi.json");
    writeFileSync(outputPath, JSON.stringify(schema, null, 2));

    console.log("✅ Schéma OpenAPI généré avec succès !");
    console.log(`📄 Fichier créé : ${outputPath}`);
    console.log("🌐 Documentation disponible sur : /docs");
    console.log("📋 API spec disponible sur : /api/docs");

    return schema;
  } catch (error) {
    console.error("❌ Erreur lors de la génération du schéma OpenAPI:", error);
    process.exit(1);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  generateOpenAPIFile().catch(console.error);
}

export { generateOpenAPIFile };
