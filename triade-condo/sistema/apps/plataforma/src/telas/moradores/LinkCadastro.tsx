"use client";
// Link de cadastro (F3.10; MU-09; quadros 216-221): o síndico cria um link para uma unidade ou
// para o prédio todo, escolhe o que pedir e por quantos dias vale, e manda pelo próprio WhatsApp.
// Quem preenche entra em A confirmar com o selo Pelo link. Nada vale antes de aprovar: Conferir
// abre o que a pessoa mandou para corrigir, tirar o que não serve e aprovar, ou recusar com o
// motivo (os dados são apagados e no histórico fica só que um cadastro foi recusado). O endereço
// só aparece na hora de criar: o banco guarda só o resumo do código.

import { useState } from "react";
import {
  ESPECIES, LIGACOES_CADASTRO_SINDICO, MOTIVOS_RECUSA_CADASTRO, mostrarAniversario, mostrarPlaca, mostrarTelefone, PARENTESCOS_FAMILIAR, PEDIDOS_LINK, TIPOS_VEICULO,
  VALIDADES_LINK, type LigacaoCadastro, type MotivoRecusaCadastro, type PedidoLink,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Iniciais, textoDoErro,
  type ErroApi,
} from "@triade/ui";
import { dia, diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { CadastroLink, LinkCadastro, LinksCadastro, Recado } from "../tipos.ts";
import { Escolha } from "./comum.tsx";
import { JanelaForm } from "./FamiliaPets.tsx";

const PEDIDOS = Object.keys(PEDIDOS_LINK) as PedidoLink[];
const PEDE_DE_INICIO: PedidoLink[] = ["LIGACAO", "EMAIL", "ANIVERSARIO", "FAMILIA", "PETS"];

/** "7 dias, até 30/10". */
function validade(dias: number): string {
  const ate = new Date(Date.now() + dias * 86_400_000).toISOString();
  return `${dias === 1 ? "1 dia" : `${dias} dias`}, até ${dia(ate)}`;
}

/** O endereço que a pessoa abre: o mesmo domínio do painel. */
export function enderecoDoLink(codigo: string): string {
  return `${window.location.origin}/cadastro/${codigo}`;
}

function LinhaLink({ l, aoEncerrar }: { l: LinkCadastro; aoEncerrar?: () => void }) {
  const envios = l.envios === 0 ? "ninguém preencheu ainda" : `${l.envios === 1 ? "1 cadastro" : `${l.envios} cadastros`}${l.aConferir ? `, ${l.aConferir} a conferir` : ""}`;
  return (
    <li className="flex items-center gap-3 border-t border-linha py-3 first:border-t-0">
      <span className="ladrilho h-8 w-8 rounded-[10px]" aria-hidden="true"><Icone nome="link" className="h-4 w-4" /></span>
      <span className="grid min-w-0 flex-1">
        <span className="t-texto font-medium">{l.unidade ?? "Prédio todo"}{l.criadoPor ? ` · criado por ${l.criadoPor}` : ""} em {dia(l.criadoEm)}</span>
        <span className="t-apoio">Vale até {dia(l.expiraEm)} · {envios}</span>
      </span>
      {aoEncerrar ? <Botao variante="discreto" tamanho="m" onClick={aoEncerrar} aria-label={`Encerrar o link criado em ${dia(l.criadoEm)}`}>Encerrar</Botao> : null}
    </li>
  );
}

/** Criar o link e, depois, copiar e compartilhar. Com unidade nula, nasce para o prédio todo. */
export function JanelaLinkCadastro({ unidade, aoFechar, salvo }: { unidade: { id: string; nome: string } | null; aoFechar: () => void; salvo: (r: Recado) => void }) {
  const carga = useCarregar<LinksCadastro>(`/v1/condominio/links-cadastro${unidade ? `?unidade=${unidade.id}` : ""}`);
  const [paraUnidade, setParaUnidade] = useState(unidade !== null);
  const [pede, setPede] = useState<PedidoLink[]>(PEDE_DE_INICIO);
  const [dias, setDias] = useState(7);
  const [criado, setCriado] = useState<LinkCadastro | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const titulo = "Link de cadastro";

  async function criar() {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<LinkCadastro>("/v1/condominio/links-cadastro", { corpo: { unidadeId: paraUnidade && unidade ? unidade.id : null, pede, dias } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setCriado(r.dados);
    carga.recarregar();
  }

  async function encerrar(l: LinkCadastro) {
    setErro(null);
    const r = await chamarApi(`/v1/condominio/links-cadastro/${l.id}/encerrar`, { corpo: { versao: l.versao } });
    if (!r.ok) return setErro(r.erro);
    if (criado?.id === l.id) setCriado(null);
    carga.recarregar();
    salvo({ tom: "ok", texto: "Link encerrado. Quem abrir agora vê que não aceita mais cadastro." });
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  const ativos = carga.estado === "pronto" ? carga.dados.itens.filter((l) => l.ativo) : [];
  const podeEncerrar = carga.estado === "pronto" && carga.dados.podeCriar;
  const lista = ativos.length ? (
    <section aria-labelledby="lc-ativos" className="grid">
      <h3 id="lc-ativos" className="t-apoio font-medium text-tinta">{unidade && paraUnidade ? "Links desta unidade" : "Links do prédio"}</h3>
      <ul className="grid">{ativos.map((l) => <LinhaLink key={l.id} l={l} aoEncerrar={podeEncerrar ? () => void encerrar(l) : undefined} />)}</ul>
    </section>
  ) : null;

  if (criado?.codigo) {
    const url = enderecoDoLink(criado.codigo);
    const podeCompartilhar = typeof navigator !== "undefined" && "share" in navigator;
    return (
      <Dialogo aberto titulo={titulo} aoFechar={aoFechar} media fechar apoio={`${criado.unidade ?? "Prédio todo"} · vale ${validade(dias).split(",")[0]}`}>
        <div className="grid gap-4">
          {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={carga.recarregar} /> : null}
          <p className="t-apoio md:hidden">{criado.unidade ?? "Prédio todo"} · vale {validade(dias).split(",")[0]}</p>
          <Aviso tom="ok" titulo="Link criado">Mande para a pessoa pelo seu WhatsApp ou como preferir. Quem preencher entra em A confirmar.</Aviso>
          <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-violeta-100 bg-violeta-50 px-3.5 py-3">
            <Icone nome="link" className="h-5 w-5 text-violeta-600" />
            <code className="t-codigo min-w-0 flex-1 break-all">{url.replace(/^https?:\/\//, "")}</code>
            <Botao variante="contorno" tamanho="m" onClick={() => void copiar(url)}><Icone nome="copiar" />{copiado ? "Copiado" : "Copiar"}</Botao>
          </div>
          <p className="t-apoio">O endereço só aparece agora. Se perder, encerre este e crie outro.</p>
          {lista}
          <div className="flex justify-between gap-2 border-t border-linha pt-4">
            <Botao variante="discreto" onClick={aoFechar}>Fechar</Botao>
            {podeCompartilhar ? (
              <Botao onClick={() => void navigator.share({ title: "Cadastro do condomínio", text: "Preencha o seu cadastro no condomínio pelo link:", url }).catch(() => undefined)}>
                <Icone nome="compartilhar" />Compartilhar
              </Botao>
            ) : (
              <Botao onClick={() => void copiar(url)}><Icone nome="copiar" />{copiado ? "Copiado" : "Copiar o link"}</Botao>
            )}
          </div>
        </div>
      </Dialogo>
    );
  }

  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar} media fechar apoio="O morador preenche pelo celular, sem conta. Nada vale antes de você aprovar.">
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando os links…" /> : carga.estado === "erro" ? (
        <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />
      ) : (
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
          {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={carga.recarregar} /> : null}
          {unidade ? (
            <div className="grid gap-1.5">
              <span className="t-apoio font-medium text-tinta">Para quem</span>
              <Escolha rotulo="Para quem" atual={paraUnidade ? "UNIDADE" : "PREDIO"} aoMudar={(v) => setParaUnidade(v === "UNIDADE")} opcoes={[
                { valor: "UNIDADE", texto: <><Icone nome="predio" className="h-4 w-4" />Esta unidade</> },
                { valor: "PREDIO", texto: <><Icone nome="menu" className="h-4 w-4" />A pessoa escolhe</> },
              ]} />
              <span className="t-apoio">{unidade.nome}. Em A pessoa escolhe, o link serve para o prédio todo, bom para mandar no grupo de moradores.</span>
            </div>
          ) : (
            <p className="t-apoio">O link serve para o prédio todo: a pessoa escolhe a unidade. Bom para mandar no grupo de moradores.</p>
          )}
          <fieldset className="grid gap-2.5">
            <legend className="mb-2 t-apoio font-medium text-tinta">O que pedir</legend>
            <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
              <label className="flex items-start gap-2.5 t-texto">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-violeta-600" checked disabled />
                <span>Nome e telefone<span className="block t-apoio">Sempre</span></span>
              </label>
              {PEDIDOS.map((p) => (
                <label key={p} className="flex items-start gap-2.5 t-texto">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-violeta-600" checked={pede.includes(p)}
                    onChange={(e) => setPede(e.target.checked ? [...pede, p] : pede.filter((x) => x !== p))} />
                  <span>{PEDIDOS_LINK[p].nome}{PEDIDOS_LINK[p].apoio ? <span className="block t-apoio">{PEDIDOS_LINK[p].apoio}</span> : null}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <CampoSelecao id="lc-dias" rotulo="Vale por" value={String(dias)} onChange={(e) => setDias(Number(e.target.value))}
            ajuda="Depois disso o link não abre mais. Dá para encerrar antes."
            opcoes={VALIDADES_LINK.map((d) => ({ valor: String(d), texto: validade(d) }))} />
          {lista}
          <div className="flex justify-between gap-2 border-t border-linha pt-4">
            <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
            {carga.dados.podeCriar ? <Botao type="submit" disabled={enviando}><Icone nome="link" />{enviando ? "Criando…" : "Criar link"}</Botao> : null}
          </div>
        </form>
      )}
    </Dialogo>
  );
}

/** "Proprietário que não mora · pelo link em 23/10 08:12 · com 1 da família". */
export function resumoCadastro(c: CadastroLink): string {
  const junto = [
    c.familia.length ? `${c.familia.length} da família` : null,
    c.pets.length ? (c.pets.length === 1 ? "1 pet" : `${c.pets.length} pets`) : null,
    c.veiculos.length ? (c.veiculos.length === 1 ? "1 veículo" : `${c.veiculos.length} veículos`) : null,
  ].filter(Boolean);
  return [
    c.ligacao ? LIGACOES_CADASTRO_SINDICO[c.ligacao] : null,
    `pelo link em ${diaHora(c.enviadoEm)}${c.corrigidoEm ? `, corrigido em ${diaHora(c.corrigidoEm)}` : ""}`,
    junto.length ? `com ${junto.join(", ")}` : null,
  ].filter(Boolean).join(" · ");
}

function ItemQueVeio({ titulo, apoio, iniciais, icone, aoTirar }: { titulo: string; apoio: string; iniciais?: boolean; icone?: "pata" | "pin"; aoTirar: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-[14px] border border-linha bg-superficie px-3 py-2.5">
      {iniciais ? <Iniciais nome={titulo} className="h-10 w-10 border border-dashed border-contorno !bg-superficie" />
        : <span className="ladrilho h-10 w-10" aria-hidden="true"><Icone nome={icone ?? "pata"} /></span>}
      <span className="grid min-w-0 flex-1"><span className="font-medium">{titulo}</span><span className="t-apoio">{apoio}</span></span>
      <Botao variante="contorno" tamanho="m" soIcone onClick={aoTirar} aria-label={`Não incluir ${titulo}`}><Icone nome="fechar" /></Botao>
    </li>
  );
}

/** Conferir: corrigir nome, telefone, ligação e e-mail, tirar o que não serve e aprovar. */
export function ConferirCadastro({ c, aoFechar, aoRecusar, salvo, recarregar }: {
  c: CadastroLink; aoFechar: () => void; aoRecusar: () => void; salvo: (r: Recado) => void; recarregar: () => void;
}) {
  const [nome, setNome] = useState(c.nome);
  const [telefone, setTelefone] = useState(mostrarTelefone(c.telefone));
  const [ligacao, setLigacao] = useState<LigacaoCadastro | "">(c.ligacao ?? "");
  const [email, setEmail] = useState(c.email ?? "");
  const [familia, setFamilia] = useState(c.familia);
  const [pets, setPets] = useState(c.pets);
  const [veiculos, setVeiculos] = useState(c.veiculos);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const comErro = camposComErro(erro);
  const primeiro = nome.trim().split(/\s+/)[0] || "A pessoa";
  const junto = [
    familia.length ? `${familia.map((f) => f.nome.split(/\s+/)[0]).join(" e ")} ${familia.length === 1 ? "entra" : "entram"} em Família` : null,
    pets.length ? `${pets.length === 1 ? "o pet entra" : "os pets entram"} em Pets` : null,
    veiculos.length ? `${veiculos.length === 1 ? "o veículo entra" : "os veículos entram"} em Garagens e veículos` : null,
  ].filter(Boolean);

  return (
    <JanelaForm aberto media titulo={`Conferir o cadastro de ${c.nome}`} textoBotao="Aprovar" aoFechar={aoFechar} recarregar={recarregar} erro={erro} setErro={setErro}
      explicacao={`${c.unidade} · chegou pelo link em ${diaHora(c.enviadoEm)}. Corrija o que precisar antes de aprovar.`}
      esquerda={<Botao variante="discreto" onClick={aoRecusar}><Icone nome="fechar" />Recusar…</Botao>}
      aoSalvar={async () => {
        const r = await chamarApi<{ confirmacaoNaFila: boolean }>(`/v1/condominio/cadastros-link/${c.id}/aprovar`, {
          corpo: { versao: c.versao, nome, telefone, ligacao: ligacao || null, email, familia, pets, veiculos },
        });
        if (r.ok) salvo({ tom: "ok", texto: `${nome.trim()} aprovado em ${c.unidade}. Agora fala pela unidade.` });
        return r;
      }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto id="cc-nome" rotulo="Nome" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
          erro={comErro.includes("nome") ? "Escreva o nome (até 120 caracteres)." : null} />
        <CampoTexto id="cc-telefone" rotulo="Telefone (WhatsApp)" required icone="telefone" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)}
          erro={comErro.includes("telefone") ? "Confira o número, com DDD." : null} />
        <CampoSelecao id="cc-ligacao" rotulo="Ligação com a unidade" value={ligacao} onChange={(e) => setLigacao(e.target.value as LigacaoCadastro)}
          erro={comErro.includes("ligacao") ? "Escolha a ligação com a unidade." : null}
          opcoes={[...(ligacao ? [] : [{ valor: "", texto: "Escolha" }]), ...(Object.keys(LIGACOES_CADASTRO_SINDICO) as LigacaoCadastro[]).map((v) => ({ valor: v, texto: LIGACOES_CADASTRO_SINDICO[v] }))]} />
        <CampoTexto id="cc-email" rotulo="E-mail" opcional type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)}
          ajuda={email ? "A pessoa confirma pelo e-mail depois de aprovada." : undefined} erro={comErro.includes("email") ? "Confira o e-mail." : null} />
      </div>
      {c.aniversario ? <p className="t-apoio">Aniversário: {mostrarAniversario(c.aniversario)}</p> : null}
      {familia.length ? (
        <section className="grid gap-2" aria-labelledby="cc-familia">
          <h3 id="cc-familia" className="t-apoio font-medium text-tinta">Família que veio junto</h3>
          <ul className="grid gap-2">
            {familia.map((f, i) => (
              <ItemQueVeio key={`f${i}`} iniciais titulo={f.nome} aoTirar={() => setFamilia(familia.filter((_, j) => j !== i))}
                apoio={`${PARENTESCOS_FAMILIAR[f.parentesco]} · ${f.mora ? "mora aqui" : "não mora aqui"}${f.aniversario ? ` · ${mostrarAniversario(f.aniversario)}` : ""}`} />
            ))}
          </ul>
        </section>
      ) : null}
      {pets.length ? (
        <section className="grid gap-2" aria-labelledby="cc-pets">
          <h3 id="cc-pets" className="t-apoio font-medium text-tinta">Pets</h3>
          <ul className="grid gap-2">
            {pets.map((p, i) => <ItemQueVeio key={`p${i}`} titulo={p.nome} apoio={[ESPECIES[p.especie], p.raca].filter(Boolean).join(" · ")} aoTirar={() => setPets(pets.filter((_, j) => j !== i))} />)}
          </ul>
        </section>
      ) : null}
      {veiculos.length ? (
        <section className="grid gap-2" aria-labelledby="cc-veiculos">
          <h3 id="cc-veiculos" className="t-apoio font-medium text-tinta">Veículos</h3>
          <ul className="grid gap-2">
            {veiculos.map((v, i) => (
              <ItemQueVeio key={`v${i}`} icone="pin" titulo={mostrarPlaca(v.placa)} apoio={[TIPOS_VEICULO[v.tipo], v.modelo].filter(Boolean).join(" · ")}
                aoTirar={() => setVeiculos(veiculos.filter((_, j) => j !== i))} />
            ))}
          </ul>
        </section>
      ) : null}
      <Aviso tom="info" titulo="Ao aprovar">
        {primeiro} entra em Pessoas da unidade como confirmado{junto.length ? `, e ${junto.join(", ")}` : ""}.
        {c.linkAtivo ? ` O link continua valendo até ${dia(c.linkExpiraEm)}.` : ""} O que você tirar daqui não entra.
      </Aviso>
    </JanelaForm>
  );
}

/** Recusar: os dados mandados são apagados; a pessoa vê o motivo se abrir o link de novo. */
export function RecusarCadastro({ c, aoFechar, salvo, recarregar }: { c: CadastroLink; aoFechar: () => void; salvo: (r: Recado) => void; recarregar: () => void }) {
  const [motivo, setMotivo] = useState<MotivoRecusaCadastro>("NAO_E_DA_UNIDADE");
  const [explicacao, setExplicacao] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const comErro = camposComErro(erro);
  return (
    <JanelaForm aberto titulo={`Recusar o cadastro de ${c.nome}`} textoBotao="Recusar cadastro" explicacao={c.unidade} aoFechar={aoFechar} recarregar={recarregar} erro={erro} setErro={setErro}
      aoSalvar={async () => {
        const r = await chamarApi(`/v1/condominio/cadastros-link/${c.id}/recusar`, { corpo: { versao: c.versao, motivo, explicacao } });
        if (r.ok) salvo({ tom: "ok", texto: `Cadastro de ${c.nome} recusado. Os dados foram apagados.` });
        return r;
      }}>
      <CampoSelecao id="rc-motivo" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoRecusaCadastro)}
        ajuda="A pessoa vê o motivo se abrir o link de novo."
        opcoes={(Object.keys(MOTIVOS_RECUSA_CADASTRO) as MotivoRecusaCadastro[]).map((m) => ({ valor: m, texto: MOTIVOS_RECUSA_CADASTRO[m] }))} />
      <CampoAreaTexto id="rc-explicacao" rotulo="Explique" opcional={motivo !== "OUTRO"} maxLength={500} value={explicacao} onChange={(e) => setExplicacao(e.target.value)}
        erro={comErro.includes("explicacao") ? (motivo === "OUTRO" ? "Explique o motivo (de 3 a 500 caracteres)." : "De 3 a 500 caracteres.") : null} />
      <p className="t-apoio">Os dados mandados são apagados. No histórico da unidade fica só que um cadastro pelo link foi recusado.</p>
    </JanelaForm>
  );
}
