import { Marca } from "@triade/ui";

// Página inicial provisória: a fundação (passo 0) não tem telas. As telas chegam depois
// das regras, a partir do passo 1 (DC7).
export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4 py-12">
      <Marca sistema="Plataforma do síndico" />
      <h1 className="text-2xl font-semibold tracking-tight">Plataforma do síndico</h1>
      <p className="text-tinta-suave">Painel do síndico para acompanhar os pedidos dos moradores, com prazos e retornos à vista.</p>
      <p className="rounded-md border border-info-borda bg-info-fundo px-3 py-2 text-info">
        Em construção. As telas chegam a partir do passo 1.
      </p>
    </main>
  );
}
