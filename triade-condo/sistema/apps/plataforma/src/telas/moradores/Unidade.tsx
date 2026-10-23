"use client";
// Ficha da unidade (MU-01, MU-03, MU-04, MU-07, MU-08, MU-10): a ocupação da unidade e as
// pessoas ativas, com as marcações (responsável, proprietário, mora aqui), a ligação, o
// parentesco, desde quando ocupam, o telefone e os comunicados; confirmar ou recusar o que está a confirmar; a mudança;
// quem saiu, com o período de ocupação e o motivo, e a remoção dos dados pessoais de quem saiu (PT-11).
// Unidade com inquilino e sem proprietário no cadastro pede o proprietário (MU-01). A situação
// da unidade: à venda e para alugar, em chaves que gravam na hora, só na Plataforma (MU-11).
// Garagens e veículos (MU-06). O endereço abre direto uma janela ou parte (?abrir=incluir|mudanca,
// #garagens). Os comunicados pelo WhatsApp de cada contato (F6.6, CD-02): só a situação, sem
// botão; só o morador muda, pelo WhatsApp. DC15 (telas-modelo moradores-ficha-*): os avisos no
// topo, as partes em cartões, um só botão principal (Incluir pessoa); Editar unidade e
// Registrar mudança em Mais ações; Editar, Recusar e Encerrar no menu de cada pessoa.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatarData, mostrarDataSemHora, mostrarTelefone, nomeDaUnidade, ORIGENS_ACEITE_WHATSAPP, SITUACOES_COMUNICADOS_WHATSAPP, SITUACOES_EMAIL,
} from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Icone, Iniciais, Interruptor, Selo, textoDoErro, Vazio } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ContatoAnterior, ContatoDaUnidade, Recado, UnidadeDetalhe } from "../tipos.ts";
import { CartaoFicha, LadrilhoUnidade, MenuAcoes, nomeMotivo, SeloEstado, type ItemMenu } from "./comum.tsx";
import { GaragensDaUnidade } from "./Garagens.tsx";
import { descreverVinculo, LinhaOcupacao } from "./Vinculo.tsx";
import { EditarContato, EditarUnidade, Encerrar, IncluirContato, RegistrarMudanca } from "./JanelasUnidade.tsx";

type JanelaAberta =
  | { tipo: "incluir"; relacao?: string }
  | { tipo: "mudanca" | "unidade" }
  | { tipo: "editar" | "encerrar" | "recusar"; contato: ContatoDaUnidade }
  | { tipo: "remover"; anterior: ContatoAnterior };

/** "Comunicados no WhatsApp: aceitou em 20/10/2026, na conversa". */
function comunicadosNoWhatsapp(c: ContatoDaUnidade): string | null {
  if (!c.comunicadosWhatsapp) return null;
  const em = c.comunicadosWhatsappEm && c.comunicadosWhatsapp !== "SEM_RESPOSTA" ? ` em ${formatarData(c.comunicadosWhatsappEm)}` : "";
  const origem = c.comunicadosWhatsappOrigem && c.comunicadosWhatsapp === "ACEITOU" ? `, ${ORIGENS_ACEITE_WHATSAPP[c.comunicadosWhatsappOrigem]}` : "";
  return `Comunicados no WhatsApp: ${SITUACOES_COMUNICADOS_WHATSAPP[c.comunicadosWhatsapp]}${em}${origem}`;
}

function detalhes(c: ContatoDaUnidade, whatsappLigado: boolean): string {
  return [
    ...descreverVinculo(c).resto,
    mostrarTelefone(c.telefone),
    c.recebeComunicados ? "recebe comunicados" : "não recebe comunicados",
    c.emailSituacao ? SITUACOES_EMAIL[c.emailSituacao].toLowerCase() : null,
    whatsappLigado || (c.comunicadosWhatsapp && c.comunicadosWhatsapp !== "SEM_RESPOSTA") ? comunicadosNoWhatsapp(c) : null,
    c.origem === "PLANILHA" ? "veio da planilha" : null,
    c.outrasUnidades.length ? `também em ${c.outrasUnidades.join(", ")}` : null,
  ].filter(Boolean).join(" · ");
}

/** "ocupou de 10/01/2023 a 28/02/2025"; sem entrada, "saiu em 28/02/2025". */
function periodo(a: ContatoAnterior): string {
  const saida = a.dataSaida ? mostrarDataSemHora(a.dataSaida) : formatarData(a.encerradoEm);
  return a.ocupaDesde ? `ocupou de ${mostrarDataSemHora(a.ocupaDesde)} a ${saida}` : `saiu em ${saida}`;
}

export function Unidade() {
  const endereco = useSearchParams();
  const id = endereco.get("id");
  const abrir = endereco.get("abrir");
  const { atualizar } = usePlataforma();
  const carga = useCarregar<UnidadeDetalhe>(id ? `/v1/condominio/unidades/${id}` : null);
  const [recado, setRecado] = useState<Recado>(null);
  const [janela, setJanela] = useState<JanelaAberta | null>(abrir === "incluir" ? { tipo: "incluir" } : abrir === "mudanca" ? { tipo: "mudanca" } : null);
  useEffect(() => {
    if (carga.estado === "pronto" && window.location.hash === "#garagens") document.getElementById("garagens")?.scrollIntoView();
  }, [carga.estado]);
  const [falha, setFalha] = useState<string | null>(null);
  const fechar = () => setJanela(null);
  const voltar = <Link href="/moradores" className="inline-flex items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Moradores e unidades</Link>;

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela font-normal tracking-tight">Unidade</h1><Vazio titulo="Unidade não encontrada" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando a unidade…" />;
  if (carga.estado === "erro") {
    return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela font-normal tracking-tight">Unidade</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  }

  const d = carga.dados;
  const u = d.unidade;
  const nome = nomeDaUnidade(u.bloco, u.andar, u.identificacao);
  const salvo = (r: Recado) => { fechar(); setRecado(r); setFalha(null); carga.recarregar(); atualizar(); };
  const compartilham = d.contatos.filter((c) => c.telefoneCompartilhado);
  const edita = d.podeEditar && u.ativa;

  async function marcar(m: { aVenda: boolean; paraAlugar: boolean }) {
    const r = await chamarApi(`/v1/condominio/unidades/${u.id}/situacao`, { corpo: { versao: u.versao, ...m } });
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    const marcas = [m.aVenda ? "à venda" : null, m.paraAlugar ? "para alugar" : null].filter(Boolean);
    salvo({ tom: "ok", texto: marcas.length ? `${nome} marcada ${marcas.join(" e ")}.` : `${nome} sem marca de venda ou aluguel.` });
  }

  async function confirmar(c: ContatoDaUnidade) {
    const r = await chamarApi("/v1/condominio/vinculos-unidade/confirmar", { corpo: { itens: [{ id: c.vinculoId, versao: c.versao }] } });
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    salvo({ tom: "ok", texto: `${c.nome} confirmado. Agora fala pela unidade.` });
  }

  const incluir = edita ? <Botao onClick={() => setJanela({ tipo: "incluir" })}><Icone nome="pessoa-mais" />Incluir pessoa</Botao> : null;
  const mais: ItemMenu[] = d.podeEditar ? [
    { texto: "Editar unidade", icone: "editar", acao: () => setJanela({ tipo: "unidade" }) },
    ...(u.ativa ? [{ texto: "Registrar mudança", icone: "mudanca" as const, acao: () => setJanela({ tipo: "mudanca" }) }] : []),
  ] : [];
  const marcado = { aVenda: Boolean(u.aVendaDesde), paraAlugar: Boolean(u.paraAlugarDesde) };

  return (
    <div className="grid gap-5 max-md:pb-16">
      {voltar}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <LadrilhoUnidade texto={u.identificacao} grande />
          <div className="grid min-w-0 gap-1">
            <h1 className="t-titulo-tela flex flex-wrap items-center gap-2">{nome}{u.ativa ? null : <Selo tom="neutro">Desativada</Selo>}</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <LinhaOcupacao ocupacao={d.ocupacao} />
              {u.aVendaDesde ? <Selo tom="info">À venda</Selo> : null}
              {u.paraAlugarDesde ? <Selo tom="info">Para alugar</Selo> : null}
              <span className="t-apoio">Quem fala por esta unidade. Só a pessoa confirmada vale.</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <MenuAcoes rotulo="Mais ações" texto="Mais ações" itens={mais} />
          {incluir ? <span className="max-md:hidden">{incluir}</span> : null}
        </div>
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
      {d.faltaProprietario || compartilham.length ? (
        <div className="grid gap-2.5">
          {d.faltaProprietario ? (
            <Aviso tom="atencao" titulo="Falta o proprietário">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>Esta unidade tem inquilino e o proprietário do imóvel não está no cadastro. Para controle, inclua o proprietário, mesmo que não more aqui.</span>
                {edita ? <Botao variante="contorno" tamanho="m" onClick={() => setJanela({ tipo: "incluir", relacao: "PROPRIETARIO" })}>Incluir proprietário</Botao> : null}
              </span>
            </Aviso>
          ) : null}
          {compartilham.length ? (
            <Aviso tom="info" titulo="Telefone repetido">
              O telefone de {compartilham.map((c) => c.nome).join(" e ")} também está em outro contato do condomínio. Se for da mesma família, tudo certo.
              Se o número mudou de dono, encerre o vínculo antigo. O telefone sozinho não prova quem é.
            </Aviso>
          ) : null}
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <CartaoFicha id="pessoas" titulo="Pessoas da unidade" icone="pessoas">
            {d.contatos.length === 0 ? (
              <Vazio titulo="Ninguém cadastrado nesta unidade" icone="pessoas" acao={incluir ?? undefined}>
                Inclua quem mora ou responde pela unidade: proprietário, inquilino, familiar.
              </Vazio>
            ) : (
              <ul aria-label={`Pessoas de ${nome}`} className="grid">
                {d.contatos.map((c) => {
                  const marcas = descreverVinculo(c).marcas;
                  const itens: ItemMenu[] = [
                    ...(d.podeEditar ? [{ texto: "Editar", icone: "editar" as const, rotulo: `Editar ${c.nome}`, acao: () => setJanela({ tipo: "editar", contato: c }) }] : []),
                    ...(c.estado === "PENDENTE" && d.podeConfirmar ? [{ texto: "Recusar…", icone: "fechar" as const, perigo: true, rotulo: `Recusar ${c.nome}`, acao: () => setJanela({ tipo: "recusar", contato: c }) }] : []),
                    ...(d.podeEditar && c.estado === "CONFIRMADO" ? [{ texto: "Encerrar o vínculo…", icone: "sair" as const, perigo: true, rotulo: `Encerrar o vínculo de ${c.nome}`, acao: () => setJanela({ tipo: "encerrar", contato: c }) }] : []),
                  ];
                  return (
                    <li key={c.vinculoId} className="flex items-start gap-3 border-t border-linha py-3.5 first:border-t-0 first:pt-1">
                      <Iniciais nome={c.nome} className="h-10 w-10" />
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{c.nome}</span><SeloEstado estado={c.estado} /></span>
                        {marcas ? <span className="t-apoio font-medium">{marcas}</span> : null}
                        <span className="t-apoio">{detalhes(c, d.comunicadosWhatsappLigado === true)}</span>
                        {c.estado === "PENDENTE" && d.podeConfirmar ? (
                          <span className="pt-2 md:hidden"><Botao variante="contorno" tamanho="m" className="w-full" onClick={() => void confirmar(c)} aria-label={`Confirmar ${c.nome}`}><Icone nome="check" />Confirmar</Botao></span>
                        ) : null}
                      </div>
                      <span className="flex shrink-0 items-center gap-1">
                        {c.estado === "PENDENTE" && d.podeConfirmar ? (
                          <span className="max-md:hidden"><Botao variante="contorno" tamanho="m" onClick={() => void confirmar(c)} aria-label={`Confirmar ${c.nome}`}><Icone nome="check" />Confirmar</Botao></span>
                        ) : null}
                        <MenuAcoes rotulo={`Ações de ${c.nome}`} itens={itens} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CartaoFicha>

          {d.anteriores.length ? (
            <CartaoFicha id="anteriores" titulo="Anteriores" icone="relogio">
              <ul className="grid">
                {d.anteriores.map((a) => (
                  <li key={a.vinculoId} className="flex flex-wrap items-center justify-between gap-2 border-t border-linha py-3 t-texto first:border-t-0 first:pt-1">
                    <span>
                      <span className="font-medium">{a.dadosRemovidos ? "Dados removidos" : a.nome}</span>
                      <span className="block t-apoio text-tinta-suave">
                        {[descreverVinculo(a).marcas, ...descreverVinculo({ ...a, ocupaDesde: null }).resto].filter(Boolean).join(" · ")}
                        {" · "}{periodo(a)} · {nomeMotivo(a.motivo).toLowerCase()}
                      </span>
                    </span>
                    {d.podeEditar && a.semVinculoAtivo && !a.dadosRemovidos ? (
                      <Botao variante="discreto" tamanho="m" onClick={() => setJanela({ tipo: "remover", anterior: a })} aria-label={`Remover os dados de ${a.nome}`}>Remover dados</Botao>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="t-apoio">Remover dados apaga nome e telefone de quem não está mais em nenhuma unidade. O histórico continua, sem os dados pessoais.</p>
            </CartaoFicha>
          ) : null}
        </div>

        <div className="grid gap-5">
          {edita || u.aVendaDesde || u.paraAlugarDesde ? (
            <CartaoFicha id="situacao" titulo="Situação da unidade" icone="predio">
              {edita ? (
                <div className="grid gap-2">
                  <Interruptor id="u-a-venda" rotulo="À venda" ajuda={u.aVendaDesde ? `desde ${mostrarDataSemHora(u.aVendaDesde)}` : undefined}
                    marcado={marcado.aVenda} aoMudar={(v) => void marcar({ ...marcado, aVenda: v })} />
                  <Interruptor id="u-para-alugar" rotulo="Para alugar" ajuda={u.paraAlugarDesde ? `desde ${mostrarDataSemHora(u.paraAlugarDesde)}` : undefined}
                    marcado={marcado.paraAlugar} aoMudar={(v) => void marcar({ ...marcado, paraAlugar: v })} />
                </div>
              ) : (
                <p className="flex flex-wrap gap-2 t-texto">
                  {u.aVendaDesde ? <Selo tom="info">À venda desde {mostrarDataSemHora(u.aVendaDesde)}</Selo> : null}
                  {u.paraAlugarDesde ? <Selo tom="info">Para alugar desde {mostrarDataSemHora(u.paraAlugarDesde)}</Selo> : null}
                </p>
              )}
              <p className="t-apoio">
                {edita ? "Grava na hora. " : ""}Para se preparar para a troca de morador: mudança, cadastro novo e vistoria. A marca aparece só aqui, nunca no mural nem para os moradores.
              </p>
            </CartaoFicha>
          ) : null}
          <GaragensDaUnidade unidadeId={u.id} nomeUnidade={nome} vagas={d.vagas ?? []} veiculos={d.veiculos ?? []} contatos={d.contatos}
            edita={edita} salvo={salvo} recarregar={carga.recarregar} />
        </div>
      </div>
      {incluir ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{incluir}</div> : null}

      <IncluirContato aberto={janela?.tipo === "incluir"} unidade={d} relacaoInicial={janela?.tipo === "incluir" ? janela.relacao : undefined} aoFechar={fechar} salvo={salvo} />
      <RegistrarMudanca aberto={janela?.tipo === "mudanca"} unidade={d} aoFechar={fechar} salvo={salvo} recarregar={carga.recarregar} />
      <EditarUnidade aberto={janela?.tipo === "unidade"} unidade={d} aoFechar={fechar} salvo={salvo} recarregar={carga.recarregar} />
      <EditarContato contato={janela?.tipo === "editar" ? janela.contato : null} emailLigado={d.emailLigado} aoFechar={fechar} salvo={salvo} recarregar={carga.recarregar}
        responsavel={((r) => (r ? { nome: r.nome, mora: r.mora } : null))(d.contatos.find((c) => c.principal))} />
      <Encerrar contato={janela?.tipo === "encerrar" ? janela.contato : null} nomeUnidade={nome} aoFechar={fechar} salvo={salvo} recarregar={carga.recarregar} />
      <Janela aberto={janela?.tipo === "recusar"} titulo={janela?.tipo === "recusar" ? `Recusar ${janela.contato.nome}` : "Recusar"} campos={[]} iniciais={{}}
        textoBotao="Recusar contato" explicacao={`Esta pessoa não vai falar por ${nome}. A recusa fica registrada no histórico.`}
        aoFechar={fechar} recarregar={carga.recarregar}
        aoSalvar={async () => {
          const c = (janela as { contato: ContatoDaUnidade }).contato;
          const r = await chamarApi(`/v1/condominio/vinculos-unidade/${c.vinculoId}/encerrar`, { corpo: { versao: c.versao, motivo: "RECUSADO" } });
          if (r.ok) salvo({ tom: "ok", texto: `${c.nome} recusado nesta unidade.` });
          return r;
        }} />
      <Janela aberto={janela?.tipo === "remover"} titulo={janela?.tipo === "remover" ? `Remover os dados de ${janela.anterior.nome}` : "Remover dados"} campos={[]} iniciais={{}}
        textoBotao="Remover dados" explicacao="Nome e telefone saem de vez e não dá para desfazer. O histórico continua, sem os dados pessoais. Se a pessoa voltar, cadastre de novo."
        aoFechar={fechar} recarregar={carga.recarregar}
        aoSalvar={async () => {
          const a = (janela as { anterior: ContatoAnterior }).anterior;
          const r = await chamarApi(`/v1/condominio/contatos/${a.contatoId}/remover-dados`, { corpo: { versao: a.contatoVersao } });
          if (r.ok) salvo({ tom: "ok", texto: "Dados pessoais removidos." });
          return r;
        }} />
    </div>
  );
}
