import type { Metadata } from "next";
import { Luckiest_Guy, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const luckiest = Luckiest_Guy({
  variable: "--font-luckiest",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Detective Conan Voice Bowtie",
  description:
    "A Detective Conan-inspired bowtie that captures speech and plays back a dubbed translation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} ${luckiest.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
