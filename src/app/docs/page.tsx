'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <ApiReferenceReact
        configuration={{
          url: '/api/docs',
          theme: 'default',
          layout: 'modern',
          hideDownloadButton: false,
          hideTryItPanel: false,
          hideServers: false,
          hideModels: false,
          hideSchema: false,
          hideAuthentication: true,
          customCss: `
            .scalar-app {
              --scalar-font: 'Inter', system-ui, sans-serif;
            }
            .scalar-header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .scalar-brand {
              color: white;
            }
          `,
          metaData: {
            title: 'FFE Chess Agenda API',
            description: 'API pour récupérer les informations sur les tournois d\'échecs FFE',
            contact: {
              name: 'Chess Agenda',
              url: 'https://github.com/chess-agenda',
            },
            license: {
              name: 'MIT',
              url: 'https://opensource.org/licenses/MIT',
            },
          },
        }}
      />
    </div>
  );
}
