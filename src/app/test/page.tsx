export default function TestPage() {
  return (
    <div className="min-h-screen bg-red-500 text-white p-8">
      <h1 className="text-4xl font-bold">Test CSS</h1>
      <p className="text-lg mt-4">Si vous voyez ce texte en blanc sur fond rouge, Tailwind fonctionne.</p>
      <div className="mt-8 p-4 bg-blue-500 rounded-lg">
        <p>Ce bloc devrait être bleu avec des coins arrondis.</p>
      </div>
    </div>
  );
}
