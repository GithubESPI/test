import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import ButtonsProvider from "@/components/ButtonProvider";
import Link from "next/link";
import Image from "next/image";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/home");

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Gauche — formulaire */}
      <div className="flex flex-col items-center justify-center px-8 py-12 bg-white">
        <div className="w-full max-w-sm flex flex-col items-center gap-8">
          {/* Logo charte ESPI */}
          <div className="flex flex-col items-center gap-4">
            <Image src="/images/espi-logo.png" alt="ESPI" width={180} height={75} className="h-16 w-auto" priority />
            <div className="text-center">
              <h1 className="text-xl font-semibold text-gray-900 font-serif">Bulletins scolaires</h1>
              <p className="text-sm text-gray-500 mt-1">Connectez-vous avec votre compte ESPI</p>
            </div>
          </div>

          {/* Bouton connexion */}
          <div className="w-full">
            <ButtonsProvider />
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-400 text-center">
            En continuant, vous acceptez notre{" "}
            <Link
              href="https://groupe-espi.fr/politique-de-confidentialite/"
              target="_blank"
              className="text-gray-500 hover:underline"
            >
              Politique de confidentialité
            </Link>
          </p>
        </div>
      </div>

      {/* Droite — motif Élévation de la charte ESPI */}
      <div
        className="hidden lg:flex items-center justify-center bg-[#004976] bg-cover bg-center"
        style={{ backgroundImage: "url('/images/espi-motif-bleu.png')" }}
      >
        <Image src="/images/espi-logo-blanc.png" alt="ESPI" width={280} height={116} className="w-52 h-auto drop-shadow-md" priority />
      </div>
    </main>
  );
}