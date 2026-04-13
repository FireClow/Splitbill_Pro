import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"] });
const heading = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Patungin",
  description: "Split bills with less awkwardness",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${manrope.className} ${heading.className}`}>
        {children}
      </body>
    </html>
  );
}
