"use client";
// Ficha da unidade (MU-01, MU-03, MU-04, MU-07, MU-08, MU-10): a ocupação da unidade e as
// pessoas ativas, com as marcações (responsável, proprietário, mora aqui), a ligação, o
// parentesco, desde quando ocupam, o telefone e os comunicados; confirmar ou recusar o que está a confirmar; a mudança;
// quem saiu, com o período de ocupação e o motivo, e a remoção dos dados pessoais de quem saiu (PT-11).
// Unidade com inquilino e sem proprietário no cadastro pede o proprietário (MU-01). A situação
// da unidade: à venda e para alugar, só na Plataforma (MU-11). Garagens e veículos (MU-06),
// e os atalhos do menu da lista de unidades pelo endereço (?abrir=incluir|mudanca, #garagens).
// Os comunicados pelo WhatsApp de cada contato (F6.6, CD-02): só a situação, sem botão; só o
// morador muda, pelo WhatsApp.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatarData, mostrarDataSemHora, mostrarTelefone, nomeDaUnidade, ORIGENS_ACEITE_WHATSAPP, SITUACOES_COMUNICADOS_WHATSAPP, SITUACOES_EMAIL,
} from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Selo, textoDoErro, Vazio } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ContatoAnterior, ContatoDaUnidade, Recado, UnidadeDetalhe } from "../tipos.ts";
import { Caixa, nomeMotivo, SeloEstado } from "./comum.tsx";
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
  const voltar = <Link href="/moradores" className="text-sm font-medium text-violeta-600 hover:underline">Voltar às unidades</Link>;

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="text-[28px] font-normal tracking-tight">Unidade</h1><Vazio titulo="Unidade não encontrada" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando a unidade…" />;
  if (carga.estado === "erro") {
    return <div className="grid gap-3">{voltar}<h1 className="text-[28px] font-normal tracking-tight">Unidade</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
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

  return (
    <div className="grid gap-5">
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-[28px] font-normal tracking-tight">
            {nome}{u.ativa ? null : <Selo tom="neutro">Desativada</Selo>}
          </h1>
          <p className="mt-1 text-tinta-suave">Quem fala por esta unidade. Só a pessoa confirmada vale.</p>
        </div>
        {d.podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <Botao variante="contorno" onClick={() => setJanela({ tipo: "unidade" })}>Editar unidade</Botao>
            {u.ativa ? (
              <>
                <Botao variante="contorno" onClick={() => setJanela({ tipo: "mudanca" })}>Registrar mudança</Botao>
                <Botao onClick={() => setJanela({ tipo: "incluir" })}>+ Pessoa</Botao>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <LinhaOcupacao ocupacao={d.ocupacao} />
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
      {d.faltaProprietario ? (
        <Aviso tom="atencao">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Esta unidade tem inquilino e o proprietário do imóvel não está no cadastro. Para controle, inclua o proprietário, mesmo que não more aqui.</span>
            {edita ? <Botao variante="contorno" onClick={() => setJanela({ tipo: "incluir", relacao: "PROPRIETARIO" })}>Incluir proprietário</Botao> : null}
          </span>
        </Aviso>
      ) : null}

      {edita || u.aVendaDesde || u.paraAlugarDesde ? (
        <section aria-labelledby="t-situacao" className="grid gap-2 rounded-2xl border border-linha bg-superficie p-4">
          <h2 id="t-situacao" className="text-lg font-medium">Situação da unidade</h2>
          {edita ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Caixa id="u-a-venda" rotulo="À venda" ajuda={u.aVendaDesde ? `desde ${mostrarDataSemHora(u.aVendaDesde)}` : undefined}
                marcada={Boolean(u.aVendaDesde)} aoMudar={(v) => void marcar({ aVenda: v, paraAlugar: Boolean(u.paraAlugarDesde) })} />
              <Caixa id="u-para-alugar" rotulo="Para alugar" ajuda={u.paraAlugarDesde ? `desde ${mostrarDataSemHora(u.paraAlugarDesde)}` : undefined}
                marcada={Boolean(u.paraAlugarDesde)} aoMudar={(v) => void marcar({ aVenda: Boolean(u.aVendaDesde), paraAlugar: v })} />
            </div>
          ) : (
            <p className="flex flex-wrap gap-2 text-sm">
              {u.aVendaDesde ? <Selo tom="info">À venda desde {mostrarDataSemHora(u.aVendaDesde)}</Selo> : null}
              {u.paraAlugarDesde ? <Selo tom="info">Para alugar desde {mostrarDataSemHora(u.paraAlugarDesde)}</Selo> : null}
            </p>
          )}
          <p className="text-xs text-tinta-suave">
            Para se preparar para a troca de morador: mudança, cadastro novo e vistoria. Cada mudança fica no histórico da unidade. A marca aparece só aqui, nunca no mural nem para os moradores.
          </p>
        </section>
      ) : null}

      {d.contatos.length === 0 ? (
        <Vazio titulo="Ninguém cadastrado nesta unidade" acao={edita ? <Botao onClick={() => setJanela({ tipo: "incluir" })}>+ Pessoa</Botao> : undefined}>
          Inclua quem mora ou responde pela unidade: proprietário, inquilino, familiar.
        </Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-linha bg-superficie">
          <table className="w-full text-sm">
            <caption className="sr-only">Pessoas de {nome}</caption>
            <thead className="bg-superficie-2 text-left text-tinta-suave">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Pessoa</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Situação</th>
                {d.podeEditar || d.podeConfirmar ? <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {d.contatos.map((c) => (
                <tr key={c.vinculoId} className="border-t border-linha align-top">
                  <td className="min-w-52 px-4 py-3">
                    <span className="font-medium">{c.nome}</span>
                    {descreverVinculo(c).marcas ? <span className="block text-xs font-semibold">{descreverVinculo(c).marcas}</span> : null}
                    <span className="block text-xs text-tinta-suave">{detalhes(c, d.comunicadosWhatsappLigado === true)}</span>
                  </td>
                  <td className="px-4 py-3"><SeloEstado estado={c.estado} /></td>
                  {d.podeEditar || d.podeConfirmar ? (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {c.estado === "PENDENTE" && d.podeConfirmar ? (
                        <>
                          <Botao variante="discreto" onClick={() => void confirmar(c)} aria-label={`Confirmar ${c.nome}`}>Confirmar</Botao>
                          <Botao variante="discreto" onClick={() => setJanela({ tipo: "recusar", contato: c })} aria-label={`Recusar ${c.nome}`}>Recusar</Botao>
                        </>
                      ) : null}
                      {d.podeEditar ? (
                        <Botao variante="discreto" onClick={() => setJanela({ tipo: "editar", contato: c })} aria-label={`Editar ${c.nome}`}>Editar</Botao>
                      ) : null}
                      {d.podeEditar && c.estado === "CONFIRMADO" ? (
                        <Botao variante="discreto" onClick={() => setJanela({ tipo: "encerrar", contato: c })} aria-label={`Encerrar o vínculo de ${c.nome}`}>Encerrar</Botao>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {compartilham.length ? (
        <Aviso tom="atencao">
          O telefone de {compartilham.map((c) => c.nome).join(" e ")} também está em outro contato do condomínio. Se for da mesma família, tudo certo.
          Se o número mudou de dono, encerre o vínculo antigo. O telefone sozinho não prova quem é.
        </Aviso>
      ) : null}

      <GaragensDaUnidade unidadeId={u.id} nomeUnidade={nome} vagas={d.vagas ?? []} veiculos={d.veiculos ?? []} contatos={d.contatos}
        edita={edita} salvo={salvo} recarregar={carga.recarregar} />

      {d.anteriores.length ? (
        <section aria-labelledby="t-anteriores" className="grid gap-2">
          <h2 id="t-anteriores" className="text-lg font-medium">Anteriores</h2>
          <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
            {d.anteriores.map((a) => (
              <li key={a.vinculoId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{a.dadosRemovidos ? "Dados removidos" : a.nome}</span>
                  <span className="block text-xs text-tinta-suave">
                    {[descreverVinculo(a).marcas, ...descreverVinculo({ ...a, ocupaDesde: null }).resto].filter(Boolean).join(" · ")}
                    {" · "}{periodo(a)} · {nomeMotivo(a.motivo).toLowerCase()}
                  </span>
                </span>
                {d.podeEditar && a.semVinculoAtivo && !a.dadosRemovidos ? (
                  <Botao variante="discreto" onClick={() => setJanela({ tipo: "remover", anterior: a })} aria-label={`Remover os dados de ${a.nome}`}>Remover dados</Botao>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-tinta-suave">Remover dados apaga nome e telefone de quem não está mais em nenhuma unidade. O histórico continua, sem os dados pessoais.</p>
        </section>
      ) : null}

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
