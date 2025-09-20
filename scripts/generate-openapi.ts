#!/usr/bin/env tsx

import { writeFileSync } from "fs";
import { join } from "path";
import { generateOpenAPISchema } from "../src/lib/type-exporter";

/**
 * Script pour générer automatiquement le schéma OpenAPI
 * Usage: npm run generate:openapi
 */

function generateOpenAPIFile() {
  console.log("🔄 Génération du schéma OpenAPI...");

  try {
    // Générer le schéma OpenAPI
    const schema = generateOpenAPISchema(
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3012"
    );

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
  generateOpenAPIFile();
}

export { generateOpenAPIFile };
