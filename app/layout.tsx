
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SessionWrapper from "@/lib/SessionWrapper";
import Providers from "@/components/Providers";

// 🎨 Charte graphique ESPI — Commissioner (sans-serif, texte) + PT Serif (titres)
const commissioner = localFont({
  src: [
    { path: "./fonts/Commissioner-Light.otf", weight: "300", style: "normal" },
    { path: "./fonts/Commissioner-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/Commissioner-Italic.otf", weight: "400", style: "italic" },
    { path: "./fonts/Commissioner-SemiBold.otf", weight: "600", style: "normal" },
    { path: "./fonts/Commissioner-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-commissioner",
  display: "swap", // affiche le texte immédiatement avec la font système, puis swap
});

const ptSerif = localFont({
  src: [
    { path: "./fonts/PTSerif-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/PTSerif-Italic.ttf", weight: "400", style: "italic" },
    { path: "./fonts/PTSerif-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/PTSerif-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-pt-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bulletins",
  description:
    "Convertir des tableaux excels en bulletins de notes. Charger vos fichiers excels contenant les données scolaires et génèrer automatiquement vos bulletins semestriels et annuels au format Word.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${commissioner.variable} ${ptSerif.variable} ${commissioner.className}`}>
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
