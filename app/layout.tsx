import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Marginalia — read the hard papers",
  description:
    "Drop in a paper, highlight any passage, and get the notation, the intuition, and the step explained in the margin.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${newsreader.variable} ${plexMono.variable} grain antialiased`}
      >
        <script
          // Apply the saved theme before first paint to avoid a light flash.
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("marginalia-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
