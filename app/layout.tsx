import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navigation from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SmartBudgetAI - Dein persönlicher Finanzcoach",
  description: "Intelligente Ausgabenanalyse mit KI-gestützter Impulserkennung und Sparzielen",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50`}>
        <Navigation />
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900">{children}</main>
      </body>
    </html>
  );
}
