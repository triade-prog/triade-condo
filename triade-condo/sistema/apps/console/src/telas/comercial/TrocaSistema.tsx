"use client";
// Troca de sistema (quadro 345, aprovado; CM-29): do contrato assinado até o prédio usando. A linha
// do tempo (30 e 15 dias antes, o dia, a primeira semana e 45 dias depois), a carta à empresa
// anterior, que a síndica assina e manda (a TRÍADE não fala pelo condomínio), o que falta receber e
// a planilha-modelo com o mínimo para começar. Ao virar cliente, o que falta vira pendência da
// implantação (PI-04).

import { useParams } from "next/navigation";
import { useState } from "react";
import { PLANILHA_TROCA, planilhaTrocaCsv } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Icone, Selo, textoDoErro, Vazio } from "@triade/ui";
import { Cartao, Voltar } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { ROTAS_COMERCIAL } from "./comum.tsx";
import { atualizarListaDaCarta, ROTAS_CLIENTE, textoPassoTroca, textoRecebidos, type ItemTroca, type RespostaTroca, type Troca } from "./cliente.ts";
import { JanelaCartaTroca, JanelaTroca } from "./janelasCliente.tsx";
import type { FichaInteressado } from "./tipos.ts";

/** A planilha-modelo sai do mesmo texto do domínio que a api-console serve (planilhaTrocaCsv). */
function baixarPlanilha() {
  const url = URL.createObjectURL(new Blob([planilhaTrocaCsv()], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = PLANILHA_TROCA.arquivo;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TrocaSistema() {
  const { id } = useParams<{ id: string }>();
  const ficha = useCarregar<FichaInteressado>(ROTAS_COMERCIAL.interessado(id));
  const carga = useCarregar<RespostaTroca>(ROTAS_CLIENTE.troca(id));
  const [janela, setJanela] = useState<"editar" | "carta" | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const nome = ficha.estado === "pronto" ? ficha.dados.condominio : "Voltar à ficha";
  const voltar = <Voltar href={`/comercial/${id}`} texto={nome} />;
  if (carga.estado === "carregando") return <div className="grid gap-4">{voltar}<Carregando rotulo="Abrindo a troca de sistema…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{voltar}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const d = carga.dados;
  const t = d.troca ?? null;
  const pronto = (texto: string) => { setJanela(null); setAviso({ tom: "ok", texto }); carga.recarregar(); };
  const whatsapp = ficha.estado === "pronto" && ficha.dados.temWhatsapp ? ficha.dados.whatsapp : undefined;

  async function marcar(troca: Troca, n: number, recebido: boolean) {
    const itens: ItemTroca[] = troca.itens.map((x, k) => (k === n ? { ...x, recebido } : x));
    setAviso(null);
    setSalvando(true);
    const r = await chamarApi<Troca>(ROTAS_CLIENTE.troca(id), {
      metodo: "PUT",
      corpo: { versao: troca.versao, empresaAnterior: troca.empresaAnterior, dataTroca: troca.dataTroca, itens, carta: atualizarListaDaCarta(troca.carta, itens) },
    });
    setSalvando(false);
    if (!r.ok) {
      setAviso({ tom: "erro", texto: textoDoErro(r.erro) });
      if (r.erro.codigo === "VERSION_CONFLICT") carga.recarregar();
      return;
    }
    pronto(recebido ? `${troca.itens[n]!.texto}: recebido. A carta já não pede este item.` : `${troca.itens[n]!.texto}: volta a faltar.`);
  }

  return (
    <div className="grid gap-5">
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="t-titulo-tela">Troca de sistema</h1>
          <p className="t-apoio">Do contrato assinado até o prédio usando. Tudo aqui segue para a implantação.</p>
        </div>
        <div className="flex flex-wrap gap-2 max-md:grid max-md:w-full">
          <Botao variante="contorno" onClick={baixarPlanilha}><Icone nome="baixar" />Baixar a planilha-modelo</Botao>
          {t && d.podeEditar ? <Botao onClick={() => setJanela("carta")}><Icone nome="documento" />Mandar a carta para a síndica</Botao> : null}
        </div>
      </div>
      {aviso ? <Aviso tom={aviso.tom} papel={aviso.tom === "erro" ? "alert" : "status"}>{aviso.texto}</Aviso> : null}

      {!t ? (
        <Vazio titulo="A troca de sistema ainda não começou" icone="trocar"
          acao={d.podeEditar ? <Botao onClick={() => setJanela("editar")}><Icone nome="mais" />Começar a troca de sistema</Botao> : undefined}>
          {d.podeEditar
            ? `Diga de qual sistema ou empresa o prédio sai${d.sistemaAtual ? ` (hoje usa ${d.sistemaAtual})` : ""} e o dia da troca. A carta sai pronta, em nome de quem aceitou.`
            : "A equipe do Comercial começa a troca quando o síndico disser de onde sai e quando."}
        </Vazio>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-5">
            <Cartao id="troca-linha" titulo="Linha do tempo" icone="calendario">
              <ol className="grid" aria-label="Linha do tempo da troca">
                {t.linhaDoTempo.map((p) => {
                  const s = textoPassoTroca(p, t);
                  return (
                    <li key={p.chave} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 border-t border-linha py-3 first:border-t-0 max-md:grid-cols-[minmax(0,1fr)_auto]">
                      <span className="t-texto font-semibold">{p.quando}</span>
                      <span className="t-texto max-md:col-span-2 max-md:row-start-2">{p.texto}</span>
                      <span className="max-md:col-start-2 max-md:row-start-1"><Selo tom={s.tom}>{s.texto}</Selo></span>
                    </li>
                  );
                })}
              </ol>
            </Cartao>
            <Cartao id="troca-carta" titulo="Carta à empresa anterior" icone="documento"
              acao={d.podeEditar ? <Botao variante="discreto" onClick={() => setJanela("editar")}><Icone nome="editar" />Editar</Botao> : undefined}>
              <p className="rounded-xl border border-linha bg-fundo p-4 t-texto whitespace-pre-wrap [overflow-wrap:anywhere]">{t.carta}</p>
              <p className="t-apoio">
                {t.cartaEnviadaEm
                  ? `Mandada para a síndica em ${t.cartaEnviadaEm.slice(0, 10).split("-").reverse().join("/")}${t.cartaEnviadaPor ? ` por ${t.cartaEnviadaPor.nome}` : ""}. Ela assina e manda à ${t.empresaAnterior}.`
                  : "A síndica assina e manda a carta; a TRÍADE não fala pelo condomínio."}
              </p>
            </Cartao>
          </div>
          <Cartao id="troca-falta" titulo="O que falta receber" icone="lista" acao={<Selo tom={t.faltam ? "atencao" : "ok"}>{textoRecebidos(t.itens)}</Selo>}>
            <fieldset className="grid" disabled={!d.podeEditar || salvando}>
              <legend className="sr-only">Marque o que já chegou da empresa anterior</legend>
              {t.itens.map((x, n) => (
                <label key={`${x.texto}-${n}`} className="flex min-h-11 cursor-pointer items-start gap-3 border-t border-linha py-3 first:border-t-0">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" checked={x.recebido} onChange={(e) => void marcar(t, n, e.target.checked)} />
                  <span className="grid gap-0.5">
                    <span className="t-texto">{x.texto}</span>
                    <span className="t-apoio">{x.recebido ? "Recebido" : `A pedir à ${t.empresaAnterior}`}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="t-apoio">Mínimo para começar: unidades e moradores; o resto entra depois sem travar a entrega. Ao virar cliente, o que falta vira pendência da implantação.</p>
          </Cartao>
        </div>
      )}

      {janela === "editar" ? <JanelaTroca interessadoId={id} dados={d} aoFechar={() => setJanela(null)} feito={() => pronto(t ? "Troca de sistema salva." : "Troca de sistema começada, com a carta pronta.")} /> : null}
      {janela === "carta" && t ? (
        <JanelaCartaTroca interessadoId={id} troca={t} whatsapp={whatsapp} aoFechar={() => setJanela(null)} feito={() => pronto("Carta registrada como mandada para a síndica.")} />
      ) : null}
    </div>
  );
}
