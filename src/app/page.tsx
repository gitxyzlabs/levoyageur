// src/app/page.tsx
import AuthSection from '@/components/AuthSection';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-white px-4">
      <h1 className="text-5xl md:text-6xl font-serif font-bold text-amber-900 mb-4 text-center">
        Le Voyageur
      </h1>
      <p className="text-xl text-amber-700 mb-12 text-center max-w-md">
        Curated travel guides with insider ratings
      </p>

      <AuthSection />

      {/* Temporary direct link to map for testing */}
      <a
        href="/map"
        className="mt-12 inline-block bg-amber-600 hover:bg-amber-700 text-white font-semibold py-4 px-8 rounded-xl shadow-lg transition"
      >
        Open Map (Test Mode) →
      </a>
    </main>
  );
}