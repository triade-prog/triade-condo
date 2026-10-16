import { Marca } from "@triade/ui";

// Telas de acesso: caixa central sobre o fundo neutro, com a marca da Plataforma.
export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center bg-superficie-2 px-4 py-10">
      <div className="grid w-full max-w-sm gap-6 rounded-xl border border-linha bg-superficie p-6 shadow-sm">
        <Marca sistema="Plataforma do síndico" />
        {children}
      </div>
    </main>
  );
}
