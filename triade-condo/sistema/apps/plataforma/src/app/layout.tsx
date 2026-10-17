import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Plataforma do síndico · TRÍADE Condo", template: "%s · Plataforma do síndico" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { colorScheme: "light" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Lê o cabeçalho do proxy: a página fica dinâmica e o Next aplica o nonce aos scripts.
  await headers();
  return (
    <html lang="pt-BR" data-app="plataforma">
      <body>{children}</body>
    </html>
  );
}
