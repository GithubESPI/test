import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import ButtonsProvider from "@/components/ButtonProvider";
import Link from "next/link";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/home");

  return (
    <main className="min-h-screen grid">
      {/* Gauche — formulaire */}
      <div className="flex flex-col items-center justify-center px-8 py-12 bg-white">
        <div className="w-full max-w-sm flex flex-col items-center gap-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#156082] to-[#003349] flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-gray-900">Bulletins scolaires</h1>
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

      {/* Droite — illustration */}
    </main>
  );
}