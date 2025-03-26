import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Poppins } from "next/font/google";
import "./globals.css";

const Providers = dynamic(() => import("@/components/Providers"), { ssr: false });
const SessionWrapper = dynamic(() => import("@/lib/SessionWrapper"), { ssr: false });

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "UploadsBulletins",
  description:
    "Convertir des tableaux excels en bulletins de notes. Charger vos fichiers excels contenant les données scolaires et génèrer automatiquement vos bulletins semestriels et annuels au format Word.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={poppins.className}>
        <SessionWrapper>
          <main className="flex flex-col min-h-[calc(100vh-3.5rem-1px)]">
            <div className="flex-1 flex flex-col h-full">
              <Providers>{children}</Providers>
            </div>
          </main>
        </SessionWrapper>
      </body>
    </html>
  );
}
