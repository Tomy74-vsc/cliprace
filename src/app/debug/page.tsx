export default function DebugPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="p-8">
        <h1 className="text-4xl font-bold mb-8">Debug CSS</h1>
        
        {/* Test Tailwind de base */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Test Tailwind de base</h2>
          <div className="bg-red-500 text-white p-4 rounded-lg mb-4">
            Fond rouge - Tailwind fonctionne
          </div>
          <div className="bg-blue-500 text-white p-4 rounded-lg">
            Fond bleu - Tailwind fonctionne
          </div>
        </div>

        {/* Test styles personnalisés */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Test styles personnalisés</h2>
          <div className="hero-surface p-4 rounded-lg mb-4">
            <p>Test hero-surface (devrait être gris clair)</p>
          </div>
          <div className="feature-card p-4 rounded-lg mb-4">
            <p>Test feature-card (devrait avoir un style spécial)</p>
          </div>
          <div className="text-shadow-hero text-2xl font-bold">
            Test text-shadow-hero (devrait avoir une ombre)
          </div>
        </div>

        {/* Test animations */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Test animations</h2>
          <div className="reveal p-4 bg-green-500 text-white rounded-lg">
            <p>Test reveal (devrait apparaître avec animation)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
