"use client";

import CallToAction from "@/components/CallToAction";
import FAQSection from "@/components/FAQSection";
import StepsSections from "@/components/StepsSections";
import dynamic from "next/dynamic";

const DynamicReviews = dynamic(() => import("@/components/Reviews"), {
  ssr: false,
});

export default function Page() {
  return (
    <div className="overflow-hidden">
      <div className="relative">
        <div className="w-full lg:h-full absolute bg-opacity-0 backdrop-blur-3xl"></div>
        <div className="container pt-[90px] lg:relative lg:min-h-[490px] lg:pt-[160px] lg:pb-10 lg:flex lg:flex-col lg:justify-center lg:items-center">
          <div className="relative w-full flex justify-center">
            <h1 className="text-neutral-ink-900 mb-8 text-center lg:text-center H30B tlg:H56B !leading-normal">
              Générer vos bulletins scolaires
            </h1>
          </div>
          <div className="text-neutral-600 relative text-center tlg:text-left T16R tlg:T20R">
            {" "}
            Simplifiez la gestion et la distribution des bulletins scolaires semestriels des
            apprenants, <br /> avec notre application innovante.
          </div>
          <CallToAction />
        </div>
      </div>

      <section className="lg:pt-24 lg:pb-[120px]" id="utilisation">
        <div className="container">
          <div className="lg:max-w-[60%] mx-auto">
            <h2 className="text-center lg:text-4xl text-2xl font-bold leading-10">
              Comment <span className="inline-block leading-normal text-primary-50"> générer</span>{" "}
              des bulletins pour les apprenants ?
            </h2>
          </div>
          <StepsSections />
        </div>
      </section>

      <section>
        <h2 className="text-center lg:text-4xl text-2xl font-bold leading-10">
          Voici quelques{" "}
          <span className="inline-block leading-normal text-primary-50"> modèles</span> de bulletins
        </h2>
        <DynamicReviews />
      </section>

      <section
        className="py-10 tlg:py-[120px] bg-gradient-to-r from-third-50 to-primary-50 snap-block"
        id="faq"
      >
        <div className="container flex lg:flex-rowflex-col lg:gap-[112px]">
          <div className="mb-6 lg:mb-12tlg:w-1/2">
            <h2 className="text-white text-2xl lg:text-4xl font-bold lg:leading-[46px]">
              Questions fréquemment
              <br /> posées
            </h2>
            <p className="text-white text-sm tlg:text-xl font-medium tlg:leading-7 leading-tight mt-6">
              Si vous êtes bloqué quelquepart, nous sommes là pour vous aider !
            </p>
          </div>
          <FAQSection />
        </div>
      </section>
    </div>
  );
}
