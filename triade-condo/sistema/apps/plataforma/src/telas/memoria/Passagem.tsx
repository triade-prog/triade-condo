"use client";
// Passagem e exportação (DC15, telas-modelo documentos-memoria-*; canvas do novo frontend, quadros
// 97 e 98; CT-02, CT-04): uma parte só, que aparece só para o síndico (decisão C.1 de 22/10/2026).
// O dossiê de passagem de bastão mostra antes o que vai nele hoje e, gerado, abre na própria tela
// para imprimir ou salvar em PDF. A exportação é montada em segundo plano; quando fica pronta,
// chega um aviso no sino. Dossiês gerados e exportações pedidas ficam numa lista só.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { EXPORTACAO_DIAS, mostrarDataCurta, mostrarTamanho, SITUACOES_EXPORTACAO } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Selo, textoDoErro, type ErroApi, type NomeIcone, type Tom,
} from "@triade/ui";
import type { PropsAbaMemoria } from "../documentos/DocumentosEMemoria.tsx";
import { diaDe, diaHora, diaHoraComAno } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { Exportacao, Exportacoes, Manual, Prontuario } from "../tipos.ts";

type Dossies = { id: string; geradoEm: string; autor?: string }[];
const TOM: Record<Exportacao["situacao"], Tom> = { MONTANDO: "andamento", PRONTA: "ok", VENCIDA: "neutro", FALHOU: "erro" };
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function AbaPassagem({ feito, definir }: PropsAbaMemoria) {
  const router = useRouter();
  const { pode } = usePlataforma();
  const dossie = pode("memoria.dossie");
  const exportar = pode("memoria.exportar");
  const dossies = useCarregar<Dossies>(dossie ? "/v1/condominio/memoria/dossies" : null);
  const exportacoes = useCarregar<Exportacoes>(exportar ? "/v1/condominio/memoria/exportacoes" : null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [gerando, setGerando] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const montando = exportacoes.estado === "pronto" && exportacoes.dados.montando;
  const recarregarExportacoes = exportacoes.recarregar;

  async function gerar() {
    setErro(null);
    setGerando(true);
    const r = await chamarApi<{ id: string }>("/v1/condominio/memoria/dossies", { corpo: {} });
    setGerando(false);
    if (!r.ok) return setErro(r.erro);
    router.push(`/documentos/dossie?id=${r.dados.id}&novo=1`);
  }
  useEffect(() => {
    definir({ principal: dossie ? { texto: gerando ? "Gerando…" : "Gerar dossiê", icone: "documento", aoClicar: () => void gerar() } : null, semFlutuante: true });
    // gerar só usa o roteador e os setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossie, gerando, definir]);

  // Enquanto monta, confere de tempos em tempos (abrir a tela também continua a montagem).
  useEffect(() => {
    if (!montando) return;
    const t = setInterval(recarregarExportacoes, 15_000);
    return () => clearInterval(t);
  }, [montando, recarregarExportacoes]);

  async function pedir() {
    setErro(null);
    setPedindo(true);
    const r = await chamarApi("/v1/condominio/memoria/exportacoes", { corpo: {} });
    setPedindo(false);
    if (!r.ok) return setErro(r.erro);
    exportacoes.recarregar();
    feito("Exportação pedida. Ela é montada em segundo plano; quando ficar pronta, chega um aviso no sino.");
  }
  async function baixar(e: Exportacao, numero: number) {
    setErro(null);
    const r = await chamarApi<{ url: string }>(`/v1/condominio/memoria/exportacoes/${e.id}/pacotes/${numero}/link`);
    if (!r.ok) return setErro(r.erro);
    window.location.assign(r.dados.url);
  }

  const historico: { quando: string; dossie?: Dossies[number]; exportacao?: Exportacao }[] = [
    ...(dossies.estado === "pronto" ? dossies.dados.map((d) => ({ quando: d.geradoEm, dossie: d })) : []),
    ...(exportacoes.estado === "pronto" ? exportacoes.dados.exportacoes.map((e) => ({ quando: e.pedidaEm, exportacao: e })) : []),
  ].sort((a, b) => b.quando.localeCompare(a.quando));
  const carregando = dossies.estado === "carregando" || exportacoes.estado === "carregando";

  return (
    <div className="grid gap-5">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {dossie ? (
          <Cartao id="ps-dossie" titulo="Dossiê de passagem de bastão" icone="trocar">
            <p className="t-apoio">Um retrato do condomínio na data em que é gerado, para entregar a quem assume. Nunca traz senha nem dados de moradores além do número da unidade.</p>
            <OQueVai />
            <Botao className="w-full md:hidden" disabled={gerando} onClick={() => void gerar()}><Icone nome="documento" />{gerando ? "Gerando…" : "Gerar dossiê"}</Botao>
            <p className="t-apoio max-md:hidden">O dossiê abre aqui mesmo, com Imprimir ou salvar em PDF.</p>
          </Cartao>
        ) : null}
        <div className="grid gap-5">
          {exportar ? (
            <Cartao id="ps-exportar" titulo="Exportar tudo" icone="baixar">
              <p className="t-apoio">Um ZIP com planilhas (CSV) e os dados completos (JSON) de cada parte. Fotos, PDFs e documentos vão em pacotes separados.</p>
              <Aviso tom="atencao" titulo="Tem dados pessoais dos moradores">Guarde com cuidado. O pedido fica no histórico e a TRÍADE vê que houve exportação.</Aviso>
              <div className="flex flex-wrap items-center gap-3">
                <Botao variante="contorno" className="max-md:w-full" onClick={() => void pedir()} disabled={pedindo || (exportacoes.estado === "pronto" && !exportacoes.dados.podePedir)}>
                  <Icone nome="baixar" />{pedindo ? "Pedindo…" : "Pedir exportação"}
                </Botao>
                {exportacoes.estado === "pronto" && exportacoes.dados.motivo === "MONTANDO" ? <span className="t-apoio">Uma exportação está sendo montada.</span> : null}
                {exportacoes.estado === "pronto" && exportacoes.dados.motivo === "UMA_POR_DIA" ? <span className="t-apoio">Só uma exportação por dia. Use a de hoje.</span> : null}
              </div>
              <p className="t-apoio">Uma por dia. Exportar não muda nada nem tira o condomínio da plataforma. Os links valem {EXPORTACAO_DIAS} dias.</p>
            </Cartao>
          ) : null}
          <Cartao id="ps-historico" titulo="Gerados e pedidos" icone="relogio">
            {carregando ? <Carregando linhas={2} rotulo="Carregando o histórico…" /> : null}
            {dossies.estado === "erro" ? <ErroCarregar erro={dossies.erro} texto={dossies.texto} tentarDeNovo={dossies.recarregar} oQue="os dossiês" /> : null}
            {exportacoes.estado === "erro" ? <ErroCarregar erro={exportacoes.erro} texto={exportacoes.texto} tentarDeNovo={exportacoes.recarregar} oQue="as exportações" /> : null}
            {!carregando && !historico.length ? <p className="t-apoio">Nada gerado nem pedido ainda.</p> : null}
            {historico.length ? (
              <ul className="grid divide-y divide-linha">
                {historico.map((h) => h.dossie ? (
                  <li key={h.dossie.id} className="flex items-center gap-3 py-3">
                    <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="documento" /></span>
                    <span className="grid min-w-0 flex-1">
                      <span className="font-medium">Dossiê de {diaHoraComAno(h.dossie.geradoEm)}</span>
                      {h.dossie.autor ? <span className="t-apoio">Gerado por {h.dossie.autor}</span> : null}
                    </span>
                    <Link href={`/documentos/dossie?id=${h.dossie.id}`} aria-label={`Abrir o dossiê de ${diaHoraComAno(h.dossie.geradoEm)}`} className={classeBotao("contorno", "", "m")}>Abrir</Link>
                  </li>
                ) : h.exportacao ? <LinhaExportacao key={h.exportacao.id} e={h.exportacao} baixar={baixar} /> : null)}
              </ul>
            ) : null}
          </Cartao>
        </div>
      </div>
      <p className="t-apoio">A troca de síndico em si (conferir a documentação, encerrar acessos e dar acesso ao novo) é feita pela TRÍADE. Cada geração e cada pedido ficam no histórico.</p>
    </div>
  );
}

function Cartao({ id, titulo, icone, children }: { id: string; titulo: string; icone: NomeIcone; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
      <h2 id={id} className="flex items-center gap-2.5 t-titulo-cartao">
        <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>{titulo}
      </h2>
      {children}
    </section>
  );
}

/** O que vai no dossiê hoje, com os números que já estão no painel, no prontuário e no manual. */
function OQueVai() {
  const { painel } = usePlataforma();
  const prontuario = useCarregar<Prontuario>("/v1/condominio/memoria/prontuario");
  const manual = useCarregar<Manual>("/v1/condominio/memoria/manual");
  const p = prontuario.estado === "pronto" ? prontuario.dados : null;
  const r = painel.memoria?.prontuario;
  const hoje = diaDe(new Date().toISOString());
  const pendencias = [
    painel.pedidos ? plural(painel.pedidos.ativos, "pedido aberto", "pedidos abertos") : null,
    ...(p ? p.itens.filter((i) => i.situacao === "VENCEU").map((i) => `${i.nome} venceu`) : []),
    r?.falta ? `${plural(r.falta, "item falta", "itens faltam")} no prontuário` : null,
  ].filter(Boolean);
  const vencendo = p?.contratos?.vencendo[0];
  const dias = (ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
  const linhas: { icone: NomeIcone; tom: string; titulo: string; apoio: string }[] = [
    { icone: "alerta", tom: pendencias.length ? "erro" : "ok", titulo: "Pendências", apoio: pendencias.length ? pendencias.join(" · ") : "Nada pendente hoje" },
    {
      icone: "ferramenta", tom: "violeta", titulo: "Prestadores e contratos",
      apoio: p?.contratos ? [plural(p.contratos.total, "contrato", "contratos"), vencendo ? `${vencendo.prestador} vence em ${dias(vencendo.ate)} dias` : null].filter(Boolean).join(" · ") : "Os prestadores, com o contrato de cada um",
    },
    { icone: "documento", tom: "violeta", titulo: "Documentos", apoio: p ? `${plural(p.documentos.length, "em vigor", "em vigor")}, com a versão de cada um` : "Os em vigor, com a versão de cada um" },
    {
      icone: "calendario", tom: "violeta", titulo: "Manutenção e agenda",
      apoio: p?.preventivas ? `${plural(p.preventivas.ativas, "preventiva", "preventivas")}${p.preventivas.atrasadas ? `, ${plural(p.preventivas.atrasadas, "atrasada", "atrasadas")}` : ""} · os compromissos dos próximos 30 dias` : "O programa de manutenção e os próximos compromissos",
    },
    { icone: "convivio", tom: "violeta", titulo: "Combinados e decisões", apoio: "O que foi anotado na linha do tempo" },
    { icone: "chave", tom: "violeta", titulo: "Quem tem acesso hoje", apoio: "As pessoas da gestão, com o papel e a data de entrada" },
    { icone: "casa", tom: "violeta", titulo: "Manual do prédio", apoio: manual.estado === "pronto" ? (manual.dados.secoes.length ? plural(manual.dados.secoes.length, "seção", "seções") : "Nenhuma seção escrita ainda") : "As seções escritas" },
  ];
  return (
    <div className="grid gap-1">
      <h3 className="t-rotulo pt-1">O que vai no dossiê hoje</h3>
      <ul className="grid divide-y divide-linha">
        {linhas.map((l) => (
          <li key={l.titulo} className="flex items-center gap-3 py-2.5">
            <span className="ladrilho" data-tom={l.tom} aria-hidden="true"><Icone nome={l.icone} /></span>
            <span className="grid min-w-0"><span className="font-medium">{l.titulo}</span><span className="t-apoio">{l.apoio}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinhaExportacao({ e, baixar }: { e: Exportacao; baixar: (e: Exportacao, n: number) => Promise<void> }) {
  const apoio = [e.autor ? `Pedida por ${e.autor}` : null, e.situacao === "PRONTA" && e.expiraEm ? `vale até ${mostrarDataCurta(diaDe(e.expiraEm))}` : null].filter(Boolean).join(" · ");
  return (
    <li className="grid gap-2 py-3">
      <span className="flex items-center gap-3">
        <span className="ladrilho" data-tom={e.situacao === "PRONTA" ? "ok" : e.situacao === "FALHOU" ? "erro" : "neutro"} aria-hidden="true"><Icone nome="baixar" /></span>
        <span className="grid min-w-0 flex-1">
          <span className="font-medium">Exportação de {mostrarDataCurta(diaDe(e.pedidaEm))}</span>
          {apoio ? <span className="t-apoio">{apoio}</span> : null}
        </span>
        <Selo tom={TOM[e.situacao]}>{SITUACOES_EXPORTACAO[e.situacao]}</Selo>
      </span>
      {e.situacao === "MONTANDO" ? (
        <span className="t-apoio pl-12">{e.partes.filter((p) => p.situacao === "PRONTA").length} de {e.partes.length} pacotes prontos. Pode sair desta tela: o aviso chega no sino.</span>
      ) : null}
      {e.situacao === "FALHOU" ? <span className="pl-12 text-sm text-erro">{e.erro} Peça de novo.</span> : null}
      {e.situacao === "PRONTA" ? (
        <span className="flex flex-wrap gap-2 pl-12">
          {e.partes.map((p) => (
            <Botao key={p.numero} variante="contorno" tamanho="m" onClick={() => void baixar(e, p.numero)}>
              <Icone nome="baixar" />
              {p.tipo === "DADOS" ? "Dados" : `Arquivos ${p.numero - 1} de ${e.partes.length - 1}`}
              {p.tamanho ? ` (${mostrarTamanho(p.tamanho)})` : ""}
            </Botao>
          ))}
          {e.expiraEm ? <span className="t-apoio w-full">Os links valem até {diaHora(e.expiraEm)}.</span> : null}
        </span>
      ) : null}
    </li>
  );
}
