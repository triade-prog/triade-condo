import { TelaAcesso } from "@triade/ui";

// Telas de acesso da Plataforma: a arte da marca ao lado do formulário (DC13).
export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return <TelaAcesso frase="Os pedidos do condomínio, os retornos aos moradores e os avisos num lugar só." sistema="Plataforma do síndico">{children}</TelaAcesso>;
}
