import { Marca } from "@triade/ui";

// Telas de acesso: caixa central sobre o fundo neutro, com a marca do Console.
export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center bg-lateral px-4 py-10">
      <div className="grid w-full max-w-sm gap-6 rounded-xl border border-linha bg-superficie p-6 shadow-sm">
        <Marca sistema="Console TRÍADE" />
        {children}
      </div>
    </main>
  );
}
