"use client";
// Troca de síndico (CT-01): feita pela TRÍADE, nunca só porque alguém pediu. Registra quem pediu,
// por qual canal e o que foi conferido; o novo síndico entra por convite, com conta própria; ao
// confirmar, o anterior sai na hora e a autoria dele continua. As pessoas autorizadas por ele são
// revistas com o novo síndico, não tiradas sozinhas.

import { useState, type FormEvent } from "react";
import { CANAIS_SUPORTE, formatarData } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, textoDoErro, type ErroApi } from "@triade/ui";
import type { Ficha } from "./tipos.ts";

type Sindico = Ficha["sindicos"][number];

const PASSOS = ["Quem pediu", "Documentação conferida", "Novo síndico", "Confirmar"] as const;

export function TrocaSindico({ ficha, sindico, aoFechar, aoTrocar }: {
  ficha: Ficha; sindico: Sindico; aoFechar: () => void; aoTrocar: (r: { autorizados: { nome: string }[]; contaNova: boolean }) => void;
}) {
  const [passo, setPasso] = useState(0);
  const [pedidoPor, setPedidoPor] = useState("");
  const [canal, setCanal] = useState("WHATSAPP");
  const [conferido, setConferido] = useState<string[]>(["", ""]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const itens = conferido.map((c) => c.trim()).filter(Boolean);

  const prontoNoPasso = [pedidoPor.trim().length >= 2, itens.length > 0, nome.trim().length > 0 && email.includes("@"), true][passo];

  async function confirmar(ev: FormEvent) {
    ev.preventDefault();
    if (passo < PASSOS.length - 1) {
      if (prontoNoPasso) setPasso(passo + 1);
      return;
    }
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ autorizados: { nome: string }[]; contaNova: boolean }>(`/v1/clientes/${ficha.condominio.id}/troca-sindico`, {
      corpo: { vinculoId: sindico.vinculoId, versao: sindico.versao, pedidoPor, canal, conferido: itens, nome, email },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoTrocar(r.dados);
  }

  const campos = camposComErro(erro);
  return (
    <Dialogo aberto titulo={`Troca de síndico · ${ficha.condominio.nome}`} aoFechar={aoFechar}>
      <form onSubmit={confirmar} noValidate className="grid gap-4">
        <ol className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-tinta-suave" aria-label="Passos da troca">
          {PASSOS.map((p, i) => (
            <li key={p} aria-current={i === passo ? "step" : undefined} className={i === passo ? "font-semibold text-violeta-700" : ""}>{i + 1} · {p}</li>
          ))}
        </ol>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}

        {passo === 0 ? (
          <>
            <CampoTexto id="tr-pedido" rotulo="Quem pediu" required maxLength={120} value={pedidoPor} onChange={(e) => setPedidoPor(e.target.value)}
              ajuda="Ex.: conselheira Rita, em nome do conselho." erro={campos.includes("pedidoPor") ? "Diga quem pediu a troca." : null} />
            <CampoSelecao id="tr-canal" rotulo="Por qual canal chegou" value={canal} onChange={(e) => setCanal(e.target.value)}
              opcoes={Object.entries(CANAIS_SUPORTE).map(([valor, texto]) => ({ valor, texto }))} />
          </>
        ) : null}

        {passo === 1 ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">O que foi conferido</legend>
            {conferido.map((c, i) => (
              <CampoTexto key={i} id={`tr-conf-${i}`} rotulo={`Item ${i + 1}`} opcional={i > 0} maxLength={200} value={c}
                onChange={(e) => setConferido(conferido.map((x, j) => (j === i ? e.target.value : x)))}
                ajuda={i === 0 ? "Ex.: ata da AGE de 12/10/2026 com a eleição; identidade do novo síndico conferida por vídeo." : undefined} />
            ))}
            {conferido.length < 6 ? <Botao variante="discreto" tamanho="m" className="justify-self-start" onClick={() => setConferido([...conferido, ""])}>+ Mais um item</Botao> : null}
            <p className="text-sm text-tinta-suave">Ata não é exigida em todo caso. O Console registra o que foi conferido, não guarda cópia; o arquivo fica com o condomínio, em Documentos, se o síndico quiser guardar.</p>
            {campos.includes("conferido") ? <p className="text-xs text-erro">Registre de 1 a 6 itens conferidos.</p> : null}
          </fieldset>
        ) : null}

        {passo === 2 ? (
          <>
            <CampoTexto id="tr-nome" rotulo="Nome do novo síndico" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
              erro={campos.includes("nome") ? "Escreva o nome." : null} />
            <CampoTexto id="tr-email" rotulo="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              erro={campos.includes("email") ? "Confira o e-mail." : null} />
            <p className="text-sm text-tinta-suave">Ganha conta própria pelo convite. O acesso do síndico atual nunca é passado para outra pessoa.</p>
          </>
        ) : null}

        {passo === 3 ? (
          <div className="grid gap-2">
            <p className="font-medium">Ao confirmar</p>
            <ul className="grid list-disc gap-1 pl-5 text-sm">
              <li>{sindico.nome} deixa de ser síndico e sai na hora (as sessões abertas param de valer).</li>
              <li>Tudo o que {sindico.nome} fez desde {formatarData(sindico.desde)} continua com o nome e a data.</li>
              <li>{nome || "O novo síndico"} recebe o convite em {email || "seu e-mail"}.</li>
              <li>As pessoas autorizadas por {sindico.nome} ficam para revisar com o novo síndico.</li>
            </ul>
            <Aviso tom="atencao">Pedido de {pedidoPor} por {CANAIS_SUPORTE[canal as keyof typeof CANAIS_SUPORTE]}. Conferido: {itens.join("; ")}.</Aviso>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={() => (passo === 0 ? aoFechar() : setPasso(passo - 1))}>Voltar</Botao>
          {passo < PASSOS.length - 1
            ? <Botao type="submit" disabled={!prontoNoPasso}>Continuar</Botao>
            : <Botao type="submit" variante="perigo" disabled={enviando}>{enviando ? "Trocando…" : "Confirmar a troca"}</Botao>}
        </div>
      </form>
    </Dialogo>
  );
}
