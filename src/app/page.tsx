export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Chess FFE Agenda - API Backend
          </h1>
          <p className="text-lg text-gray-600">
            API pour récupérer les données des tournois d&apos;échecs de la FFE
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            🚀 API Endpoints
          </h2>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-700">Liste des tournois</h3>
              <code className="text-sm text-gray-600">
                GET /api/tournaments?department[]=37&department[]=41
              </code>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-gray-700">Détails d&apos;un tournoi</h3>
              <code className="text-sm text-gray-600">
                GET /api/tournaments/68600
              </code>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-semibold text-gray-700">Joueurs d&apos;un tournoi</h3>
              <code className="text-sm text-gray-600">
                GET /api/tournaments/68600/players
              </code>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📋 Paramètres disponibles
          </h2>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <strong>department[] :</strong> Paramètre répété pour chaque département (ex: department[]=37&department[]=41&department[]=36)
            </div>
            <div>
              <strong>club :</strong> Nom du club à filtrer (ex: &quot;Echiquier Tourangeau&quot;)
            </div>
            <div>
              <strong>showOnlyClub :</strong> Afficher seulement les tournois avec des joueurs du club (true/false)
            </div>
            <div className="text-green-600 font-medium">
              <strong>Note :</strong> Seuls les événements futurs sont retournés par défaut
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}