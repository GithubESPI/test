"use client";

import ButtonsProvider from "@/components/ButtonProvider";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Page() {
  const [isMobile, setIsMobile] = useState(false);

  // Détecter si l'appareil est mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Vérifier au chargement
    checkIfMobile();

    // Ajouter un écouteur pour redimensionnement
    window.addEventListener("resize", checkIfMobile);

    // Nettoyer l'écouteur
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  return (
    <main className="relative min-h-screen w-full bg-white">
      {/* Split background - montré uniquement sur desktop */}
      {!isMobile && (
        <div className="absolute inset-0 flex md:flex">
          <div className="w-1/2 bg-white"></div>
          <div className="w-1/2 relative overflow-hidden">
            <Image
              src="/images/background-img.png"
              alt="background"
              fill
              className="object-cover object-[10%_center]"
            />
            <div className="absolute inset-0 bg-blue-800/40"></div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row h-full min-h-screen relative z-10">
        {/* Zone du formulaire */}
        <div className="w-full md:w-1/2 flex items-center justify-center py-8 px-4">
          <div className="w-full max-w-md">
            {/* Logo */}
            <div className="flex justify-center mb-10">
              <Image
                src="/images/logo.png"
                alt="ESPI logo"
                width={160}
                height={40}
                className="h-auto"
              />
            </div>

            {/* Titre */}
            <h1 className="text-2xl font-medium text-center mb-8">
              Connectez-vous à l&apos;application des bulletins
            </h1>

            {/* Bouton Authentification */}
            <ButtonsProvider />
          </div>
          {/* Footer en bas de la page */}
          <div className="absolute bottom-4 w-full flex justify-center px-4 z-10">
            <p className="text-xs text-gray-500 max-w-md">
              En continuant, vous acceptez notre{" "}
              <Link
                href="https://groupe-espi.fr/politique-de-confidentialite/"
                target="_blank"
                className="text-gray-700 hover:underline"
              >
                Politique de confidentialité
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Zone d'illustration (desktop uniquement) */}
        <div className="hidden md:flex w-1/2 bg-white relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <Image
              src="/images/background-img.png"
              alt="background"
              fill
              className="object-cover object-[10%_center]"
              priority
              quality={100}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
