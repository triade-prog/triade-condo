"use client";
// Lista de moradores e a confirmar (MU-02, PT-17): busca por nome, unidade ou telefone, em
// páginas. O que veio da planilha espera o síndico: confirmar vários de uma vez ou recusar
// quem ele não reconhece. Contato a confirmar não acessa nada. O filtro "sem e-mail confirmado"
// mostra quem ainda não recebe por e-mail (CD-13); "sem WhatsApp para comunicados", quem não
// aceitou receber pelo WhatsApp do condomínio (F6.6).

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { mostrarTelefone, nomeDaUnidade, SITUACOES_COMUNICADOS_WHATSAPP, SITUACOES_EMAIL } from "@triade/domain";
import { Aviso, Botao, Carregando, CampoTexto, chamarApi, Chip, ErroCarregar, textoDoErro, Vazio } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { useCarregar } from "../sessao.tsx";
import type { ListaMoradores, MoradorDaLista, Recado } from "../tipos.ts";
import { nomeRelacao, SeloEstado } from "./comum.tsx";

export function ListaContatos({ estado, salvo, buscaInicial = "" }: { estado?: "PENDENTE"; salvo: (r: Recado) => void; buscaInicial?: string }) {
  const [texto, setTexto] = useState(buscaInicial);
  const [busca, setBusca] = useState(buscaInicial);
  const [pagina, setPagina] = useState(1);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [recusar, setRecusar] = useState<MoradorDaLista | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sem, setSem] = useState<"SEM_EMAIL" | "SEM_WHATSAPP" | null>(null);
  const filtro = estado ?? sem ?? undefined;
  const qs = new URLSearchParams({ pagina: String(pagina), ...(busca ? { busca } : {}), ...(filtro ? { estado: filtro } : {}) });
  const carga = useCarregar<ListaMoradores>(`/v1/condominio/moradores?${qs}`);
  const aConfirmar = estado === "PENDENTE";

  function buscar(ev: FormEvent) {
    ev.preventDefault();
    setBusca(texto.trim());
    setPagina(1);
    setMarcados([]);
  }

  async function confirmar(itens: MoradorDaLista[]) {
    setFalha(null);
    setEnviando(true);
    const r = await chamarApi<{ confirmados: number }>("/v1/condominio/vinculos-unidade/confirmar", {
      corpo: { itens: itens.map((i) => ({ id: i.vinculoId, versao: i.versao })) },
    });
    setEnviando(false);
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    setMarcados([]);
    salvo({ tom: "ok", texto: r.dados.confirmados === 1 ? "Contato confirmado. Agora ele fala pela unidade." : `${r.dados.confirmados} contatos confirmados. Agora eles falam pelas unidades.` });
  }

  const formulario = (
    <form onSubmit={buscar} role="search" className="flex flex-wrap items-end gap-2">
      <CampoTexto id="m-busca" rotulo="Buscar por nome, unidade ou telefone" className="min-w-0 flex-1 basis-64" value={texto} maxLength={60}
        onChange={(e) => setTexto(e.target.value)} />
      <Botao type="submit" variante="contorno">Buscar</Botao>
      {estado ? null : (
        <>
          <Chip ativo={sem === "SEM_EMAIL"} icone="email" onClick={() => { setSem((x) => (x === "SEM_EMAIL" ? null : "SEM_EMAIL")); setPagina(1); }}>
            Sem e-mail confirmado{carga.estado === "pronto" && carga.dados.semEmail !== undefined ? ` · ${carga.dados.semEmail}` : ""}
          </Chip>
          {sem === "SEM_WHATSAPP" || (carga.estado === "pronto" && carga.dados.comunicadosWhatsappLigado) ? (
            <Chip ativo={sem === "SEM_WHATSAPP"} icone="whats" onClick={() => { setSem((x) => (x === "SEM_WHATSAPP" ? null : "SEM_WHATSAPP")); setPagina(1); }}>
              Sem WhatsApp para comunicados{carga.estado === "pronto" && carga.dados.semWhatsapp !== undefined ? ` · ${carga.dados.semWhatsapp}` : ""}
            </Chip>
          ) : null}
        </>
      )}
    </form>
  );

  if (carga.estado === "carregando") return <div className="grid gap-4">{formulario}<Carregando rotulo="Carregando os moradores…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{formulario}<ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;

  const d = carga.dados;
  const paginas = Math.max(1, Math.ceil(d.total / d.porPagina));
  const podeMarcar = aConfirmar && d.podeConfirmar;
  const daPagina = d.itens.map((i) => i.vinculoId);
  const todosMarcados = daPagina.length > 0 && daPagina.every((id) => marcados.includes(id));
  const escolhidos = d.itens.filter((i) => marcados.includes(i.vinculoId));

  return (
    <div className="grid gap-4">
      {formulario}
      {aConfirmar ? (
        <Aviso tom="atencao">
          Confira se cada pessoa é mesmo daquela unidade. Contato a confirmar não recebe nada e não acessa nada.
          {d.podeConfirmar ? "" : " Só o síndico confirma."}
        </Aviso>
      ) : null}
      {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
      {d.itens.length === 0 ? (
        <Vazio titulo={busca ? "Ninguém encontrado" : aConfirmar ? "Nenhum contato esperando confirmação" : "Nenhum morador cadastrado"}>
          {busca ? "Confira a busca: nome, unidade ou parte do telefone." : aConfirmar ? "O que vier da planilha aparece aqui para você conferir." : "Inclua contatos pela ficha de cada unidade ou importe a planilha."}
        </Vazio>
      ) : (
        <>
          {podeMarcar ? (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={todosMarcados}
                  onChange={(e) => setMarcados(e.target.checked ? [...new Set([...marcados, ...daPagina])] : marcados.filter((id) => !daPagina.includes(id)))} />
                Marcar todos desta página
              </label>
              <Botao disabled={enviando || escolhidos.length === 0} onClick={() => void confirmar(escolhidos)}>
                {escolhidos.length === 1 ? "Confirmar 1 selecionado" : `Confirmar ${escolhidos.length} selecionados`}
              </Botao>
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-2xl border border-linha bg-superficie">
            <table className="w-full text-sm">
              <caption className="sr-only">{aConfirmar ? "Contatos a confirmar" : "Moradores do condomínio"}</caption>
              <thead className="bg-superficie-2 text-left text-tinta-suave">
                <tr>
                  {podeMarcar ? <th scope="col" className="w-12 px-4 py-2.5"><span className="sr-only">Selecionar</span></th> : null}
                  <th scope="col" className="px-4 py-2.5 font-semibold">Contato</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Unidade</th>
                  {aConfirmar ? null : <th scope="col" className="px-4 py-2.5 font-semibold">Situação</th>}
                  {podeMarcar ? <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {d.itens.map((i) => (
                  <tr key={i.vinculoId} className="border-t border-linha align-top">
                    {podeMarcar ? (
                      <td className="px-4 py-3">
                        <input type="checkbox" className="h-4 w-4 accent-violeta-600" aria-label={`Selecionar ${i.nome}`} checked={marcados.includes(i.vinculoId)}
                          onChange={(e) => setMarcados(e.target.checked ? [...marcados, i.vinculoId] : marcados.filter((x) => x !== i.vinculoId))} />
                      </td>
                    ) : null}
                    <td className="min-w-44 px-4 py-3">
                      <span className="font-medium">{i.nome}</span>
                      <span className="block text-xs text-tinta-suave">
                        {[nomeRelacao(i.relacao), i.principal ? "responsável" : null, mostrarTelefone(i.telefone), i.origem === "PLANILHA" ? "veio da planilha" : null,
                          i.emailSituacao ? SITUACOES_EMAIL[i.emailSituacao].toLowerCase() : null,
                          d.comunicadosWhatsappLigado && i.comunicadosWhatsapp ? `WhatsApp: ${SITUACOES_COMUNICADOS_WHATSAPP[i.comunicadosWhatsapp]}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/moradores/unidade?id=${i.unidadeId}`} className="font-medium text-violeta-600 hover:underline">{nomeDaUnidade(i.bloco, i.andar, i.unidade)}</Link>
                    </td>
                    {aConfirmar ? null : <td className="px-4 py-3"><SeloEstado estado={i.estado} /></td>}
                    {podeMarcar ? (
                      <td className="px-4 py-3 text-right">
                        <Botao variante="discreto" onClick={() => setRecusar(i)} aria-label={`Recusar ${i.nome}`}>Recusar</Botao>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginas > 1 ? (
            <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
              <Botao variante="contorno" disabled={pagina <= 1} onClick={() => { setPagina(pagina - 1); setMarcados([]); }}>Anterior</Botao>
              <span>Página {pagina} de {paginas} · {d.total} contatos</span>
              <Botao variante="contorno" disabled={pagina >= paginas} onClick={() => { setPagina(pagina + 1); setMarcados([]); }}>Próxima</Botao>
            </nav>
          ) : <p className="text-sm text-tinta-suave">{d.total === 1 ? "1 contato" : `${d.total} contatos`}</p>}
        </>
      )}
      <Janela aberto={!!recusar} titulo={recusar ? `Recusar ${recusar.nome}` : "Recusar"} campos={[]} iniciais={{}} textoBotao="Recusar contato"
        explicacao={recusar ? `${recusar.nome} não vai falar por ${nomeDaUnidade(recusar.bloco, recusar.andar, recusar.unidade)}. A recusa fica registrada no histórico.` : undefined}
        aoFechar={() => setRecusar(null)} recarregar={carga.recarregar}
        aoSalvar={async () => {
          const alvo = recusar!;
          const r = await chamarApi(`/v1/condominio/vinculos-unidade/${alvo.vinculoId}/encerrar`, { corpo: { versao: alvo.versao, motivo: "RECUSADO" } });
          if (r.ok) {
            setRecusar(null);
            setMarcados(marcados.filter((x) => x !== alvo.vinculoId));
            salvo({ tom: "ok", texto: `${alvo.nome} recusado em ${nomeDaUnidade(alvo.bloco, alvo.andar, alvo.unidade)}.` });
          }
          return r;
        }} />
    </div>
  );
}
