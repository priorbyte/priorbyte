import type { Metadata, Viewport } from 'next';
import { Anton, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { BRAND, COLORS } from '@priorbyte/shared/brand';
import './globals.css';

// Cyber-Academic's three-font system: Anton for all-caps headlines, JetBrains
// Mono for body/data (the "diagnostic terminal" read), Space Grotesk for nav
// and small functional labels.
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton', display: 'swap' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.oneLiner,
};

export const viewport: Viewport = {
  themeColor: COLORS.background,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Material Symbols — used throughout the Cyber-Academic nav/icons.
            The no-page-custom-font rule is a Pages Router holdover; a <head>
            link in the App Router's root layout is the correct place for
            this, not the anti-pattern the rule is written to catch. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
