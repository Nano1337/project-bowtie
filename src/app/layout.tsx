import type { Metadata } from "next";
import { Baloo_2, Fredoka } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bowtie Dubbing Lab",
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
      <body className={`${fredoka.variable} ${baloo.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
