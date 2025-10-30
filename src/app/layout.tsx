import "./globals.css";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { headers } from "next/headers";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans", // remplace Poppins
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter", // optionnel : fallback harmonieux
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClipRace",
  description: "Plateforme UGC — marques & créateurs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Récupère le nonce transmis par le middleware (x-nonce)
  const nonce = headers().get("x-nonce") || undefined;
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
        {/** Exemple: si vous avez besoin d'un petit script inline contrôlé, appliquez le nonce */}
        {/** <script nonce={nonce} dangerouslySetInnerHTML={{ __html: "/* noop *-/" }} /> */}
      </body>
    </html>
  );
}
