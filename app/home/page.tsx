"use client";

import Hero from "@/components/Hero";
import Templates from "@/components/Templates";
import Support from "@/components/support";

export default function Home() {
  return (
    <main className="bg-slate-50 grainy-light min-h-screen bg-gradient-to-b from-white to-gray-50">
      <section className="max-w-6xl mx-auto px-4 py-20 md:py-[130px] opacity-0 translate-y-5 animate-fadeInUp delay-0">
        <Hero />
      </section>

      <Templates className="opacity-0 translate-y-5 animate-fadeInUp delay-200" />
      <Support className="opacity-0 translate-y-5 animate-fadeInUp delay-400" />
    </main>
  );
}
