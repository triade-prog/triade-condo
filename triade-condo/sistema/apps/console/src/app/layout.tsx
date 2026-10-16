import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Console TRÍADE · TRÍADE Condo", template: "%s · Console TRÍADE" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { colorScheme: "light dark" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Lê o cabeçalho do proxy: a página fica dinâmica e o Next aplica o nonce aos scripts.
  await headers();
  return (
    <html lang="pt-BR" data-app="console">
      <body>{children}</body>
    </html>
  );
}
