import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClipRace — Concours viraux, vues réelles, récompenses",
  description:
    "Lancez des concours UGC d'affluences. Les marques gagnent en visibilité et les créateurs sont récompensées. Pour marques et créateurs. Classement basé sur le nombre de vues réelles",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${poppins.variable} font-sans antialiased bg-white text-zinc-900`}>
        {children}
      </body>
    </html>
  );
}
