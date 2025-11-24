import "./style/globals.css";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { ToastContextProvider } from "@/hooks/use-toast-context";
import type { ReactNode } from "react";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClipRace",
  description: "Plateforme UGC pour marques & créateurs",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastContextProvider>{children}</ToastContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
