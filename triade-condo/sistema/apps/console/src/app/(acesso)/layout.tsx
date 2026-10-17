import { TelaAcesso } from "@triade/ui";

// Telas de acesso do Console: a arte da marca ao lado do formulário (DC13).
export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return <TelaAcesso frase="Os condomínios da carteira, a implantação e a equipe num lugar só." sistema="Console TRÍADE">{children}</TelaAcesso>;
}
