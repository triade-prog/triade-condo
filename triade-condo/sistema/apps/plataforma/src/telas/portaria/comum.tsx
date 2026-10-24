"use client";
// Peças comuns da Portaria (Portaria 1 · Encomendas; PA-01, PA-07, W-21; telas-modelo
// encomendas-*): o selo do aviso com a linha embaixo, o menu "Ações da encomenda de ...", e as
// janelas de entregar, avisar por outro meio, corrigir o registro e ver a foto da etiqueta.
// Quem cuida da portaria vê o nome das pessoas de cada unidade, nunca o telefone.

import { useState } from "react";
import {
  AVISOS_ENCOMENDA, detalheAviso, MEIOS_AVISO, MOTIVOS_NAO_RECEBE, TOM_AVISO_ENCOMENDA, textoVolumes,
  type Encomenda, type MeioAviso, type PessoaEncomenda,
} from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, Selo, textoDoErro } from "@triade/ui";
import { abrirLink, conferirArquivo, enviarUm } from "../comunicados/comum.tsx";
import { Escolha, MenuAcoes, type ItemMenu } from "../moradores/comum.tsx";
import { useCarregar } from "../sessao.tsx";

export type { Encomenda, PessoaEncomenda };

export interface OpcoesEncomenda {
  unidades: { id: string; rotulo: string; identificacao: string }[];
  lugares: { id: string; nome: string }[];
  lembrete: { ligado: boolean; dias: number };
  cenario: string | null;
  whatsapp: boolean;
  modelo?: { titulo: string; corpo: string; rodape: string | null; situacao: string };
  condominio: string;
  eu: { id: string; nome: string };
  pode: { cuidar: boolean };
}

export interface QuemDaUnidade {
  unidade: { id: string; rotulo: string };
  pessoas: PessoaEncomenda[];
  recebem: number;
  motivoSemAviso?: string;
}

const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const DIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const diaDe = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

/** "hoje 14:32", "ontem 09:10", "22/10 18:05", no horário de Brasília. */
export function quando(iso: string): string {
  const d = new Date(iso);
  const hoje = diaDe(new Date());
  const ontem = diaDe(new Date(Date.now() - 86_400_000));
  const dia = diaDe(d) === hoje ? "hoje" : diaDe(d) === ontem ? "ontem" : DIA.format(d);
  return `${dia} ${HORA.format(d)}`;
}

/** "às 14:32". */
export function hora(iso: string): string {
  return HORA.format(new Date(iso));
}

/** O selo do aviso, com a linha que diz quem recebeu, quem pediu PARAR ou o que não chegou. */
export function SeloAviso({ e, comDetalhe = true }: { e: Encomenda; comDetalhe?: boolean }) {
  const detalhe = detalheAviso(e, quando);
  const lembrete = e.aviso === "AVISADA" && e.lembrarEm ? ` · lembrete em ${DIA.format(new Date(e.lembrarEm))}` : "";
  return (
    <span className="grid justify-items-start gap-1">
      <Selo tom={TOM_AVISO_ENCOMENDA[e.aviso]}>{AVISOS_ENCOMENDA[e.aviso]}</Selo>
      {comDetalhe && (detalhe || lembrete) ? <span className="t-apoio">{detalhe}{lembrete}</span> : null}
    </span>
  );
}

/** "Guardada por você · hoje 14:32" ou "João Ribeiro · ontem 18:05". */
export function quemGuardou(e: Encomenda): string {
  return `${e.guardadaPor.eu ? "Guardada por você" : e.guardadaPor.nome} · ${quando(e.guardadaEm)}`;
}

export function resumoEncomenda(e: Pick<Encomenda, "remetente" | "volumes">): string {
  return `${e.remetente} · ${textoVolumes(e.volumes)}`;
}

export type AcaoEncomenda = "entregar" | "outro-meio" | "corrigir" | "etiqueta";

/** O menu de três pontos da linha (Entregar fica à vista, fora do menu). */
export function MenuEncomenda({ e, podeCuidar, aoEscolher, aoAvisar }: {
  e: Encomenda; podeCuidar: boolean; aoEscolher: (a: AcaoEncomenda) => void; aoAvisar: () => void;
}) {
  const itens: ItemMenu[] = [];
  if (podeCuidar && e.estado === "GUARDADA") {
    itens.push({ texto: "Avisar de novo", icone: "whats", apoio: "Pelo WhatsApp, para quem recebe agora", acao: aoAvisar });
    itens.push({ texto: "Avisei por outro meio", icone: "telefone", apoio: "Interfone, bilhete ou pessoalmente", acao: () => aoEscolher("outro-meio") });
  }
  if (e.fotoEtiqueta) itens.push({ texto: "Ver a foto da etiqueta", icone: "camera", acao: () => aoEscolher("etiqueta") });
  if (podeCuidar && e.estado === "GUARDADA") itens.push({ texto: "Corrigir o registro", icone: "editar", acao: () => aoEscolher("corrigir") });
  return <MenuAcoes rotulo={`Ações da encomenda de ${e.unidade.rotulo}`} itens={itens} />;
}

/** Avisar de novo: a mesma mensagem, para quem recebe agora. Devolve o recado. */
export async function avisarDeNovo(e: Encomenda): Promise<{ tom: "ok" | "atencao"; texto: string }> {
  const r = await chamarApi<{ avisos: number }>(`/v1/condominio/encomendas/${e.id}/avisar`, { corpo: {} });
  if (!r.ok) return { tom: "atencao", texto: textoDoErro(r.erro) };
  return { tom: "ok", texto: `${e.unidade.rotulo} avisada de novo: ${r.dados.avisos === 1 ? "1 aviso saiu" : `${r.dados.avisos} avisos saíram`} pelo WhatsApp.` };
}

/** Quem pode retirar: o nome, o papel e se recebe o aviso; sem telefone. */
export function PessoasDaUnidade({ pessoas, compacto }: { pessoas: PessoaEncomenda[]; compacto?: boolean }) {
  if (!pessoas.length) return <p className="t-apoio">Ninguém confirmado nesta unidade.</p>;
  return (
    <ul className="grid">
      {pessoas.map((p) => (
        <li key={p.contatoId} className="flex flex-wrap items-center justify-between gap-2 border-t border-linha py-2.5 first:border-t-0">
          <span className="grid">
            <span className="font-medium">{p.nome}</span>
            <span className="t-apoio">{p.papel}{p.mora ? " · mora aqui" : ""}</span>
          </span>
          {compacto ? null : p.recebe ? <Selo tom="ok">Recebe os avisos</Selo>
            : <Selo tom={p.motivo === "PAROU" ? "atencao" : "neutro"}>{p.motivo === "PAROU" ? "Pediu PARAR" : MOTIVOS_NAO_RECEBE[p.motivo ?? "NAO_MORA"]}</Selo>}
        </li>
      ))}
    </ul>
  );
}

/** Entregar (W-21): quem retirou é alguém da unidade ou outra pessoa, pelo nome; foto opcional; sem código. */
export function JanelaEntregar({ e, eu, aoFechar, salvo }: { e: Encomenda; eu: string; aoFechar: () => void; salvo: (texto: string) => void }) {
  const quem = useCarregar<QuemDaUnidade>(`/v1/condominio/encomendas/unidades/${e.unidade.id}/quem`);
  const [escolha, setEscolha] = useState<string>("");
  const [nome, setNome] = useState("");
  const [ligacao, setLigacao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [campos, setCampos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const pessoas = quem.estado === "pronto" ? quem.dados.pessoas : [];
  const outra = escolha === "OUTRA";
  const retirou = outra ? nome.trim() : pessoas.find((p) => p.contatoId === escolha)?.nome ?? "";

  async function confirmar() {
    setFalha(null);
    if (!escolha) return setFalha("Escolha quem retirou.");
    if (outra && nome.trim().length < 2) { setCampos(["nome"]); return setFalha("Escreva o nome de quem retirou."); }
    setEnviando(true);
    if (foto) {
      const erroFoto = conferirArquivo(foto, 10 * 1024 * 1024);
      if (erroFoto || foto.type === "application/pdf") { setEnviando(false); return setFalha(erroFoto ?? "A foto da retirada é só imagem (JPG, PNG ou WEBP)."); }
      const r = await enviarUm(`/v1/condominio/encomendas/${e.id}/fotos`, { tipoFoto: "RETIRADA" }, foto, (d) => d.fotoId!);
      if (!r.liberado) { setEnviando(false); return setFalha(`A foto não foi guardada: ${r.motivo ?? "envie de novo"}.`); }
    }
    const r = await chamarApi(`/v1/condominio/encomendas/${e.id}/entregar`, {
      corpo: outra ? { nome: nome.trim(), ligacao: ligacao.trim() || null } : { contatoId: escolha },
    });
    setEnviando(false);
    if (!r.ok) { setCampos(camposComErro(r.erro)); return setFalha(textoDoErro(r.erro)); }
    salvo(`Encomenda de ${e.unidade.rotulo} entregue a ${retirou}.`);
  }

  return (
    <Dialogo aberto media fechar titulo={`Entregar encomenda · ${e.unidade.rotulo}`} aoFechar={aoFechar}
      apoio="A pessoa diz o nome e você confere na lista da unidade.">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-fundo p-3">
          <span className="grid">
            <span className="font-semibold">{resumoEncomenda(e)}</span>
            <span className="t-apoio">{e.lugar?.nome} · {quemGuardou(e)}</span>
          </span>
          {e.fotoEtiqueta ? <Botao variante="discreto" tamanho="m" onClick={() => void abrirLink(`/v1/condominio/encomendas/${e.id}/fotos/${e.fotoEtiqueta}/link`)}><Icone nome="camera" />Ver a etiqueta</Botao> : null}
        </div>
        <fieldset className="grid gap-2">
          <legend className="t-rotulo mb-1">Quem retirou</legend>
          {quem.estado === "carregando" ? <p className="t-apoio">Carregando as pessoas da unidade…</p> : null}
          {pessoas.map((p) => (
            <label key={p.contatoId} className="flex items-center gap-3 rounded-xl border border-linha p-3 t-texto">
              <input type="radio" name="retirou" className="h-4 w-4 accent-violeta-600" checked={escolha === p.contatoId} onChange={() => setEscolha(p.contatoId)} />
              <span className="grid"><span className="font-medium">{p.nome}</span><span className="t-apoio">{p.papel}{p.mora ? " · mora aqui" : ""}</span></span>
            </label>
          ))}
          <label className="flex items-center gap-3 rounded-xl border border-linha p-3 t-texto">
            <input type="radio" name="retirou" className="h-4 w-4 accent-violeta-600" checked={outra} onChange={() => setEscolha("OUTRA")} />
            <span className="grid"><span className="font-medium">Outra pessoa</span><span className="t-apoio">Alguém que a unidade mandou buscar</span></span>
          </label>
          {outra ? (
            <div className="grid gap-3 md:grid-cols-2">
              <CampoTexto id="en-nome" rotulo="Nome de quem retirou" value={nome} maxLength={80} onChange={(x) => setNome(x.target.value)}
                erro={campos.includes("nome") ? "Escreva o nome" : undefined} />
              <CampoTexto id="en-ligacao" rotulo="Ligação com a unidade" opcional placeholder="Ex.: motorista, sobrinho" value={ligacao} maxLength={60}
                onChange={(x) => setLigacao(x.target.value)} />
            </div>
          ) : null}
        </fieldset>
        <Aviso tom="info">A pessoa diz o nome e você confere na lista da unidade. Não há código: o condomínio nunca pede código por mensagem.</Aviso>
        <div className="grid gap-1">
          <label htmlFor="en-foto" className="t-rotulo">Foto da retirada <span className="font-normal text-tinta-suave">(opcional)</span></label>
          <input id="en-foto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="t-texto"
            onChange={(x) => setFoto(x.target.files?.[0] ?? null)} />
          <span className="t-apoio">JPG, PNG ou WEBP · até 10 MB · fica só no painel.</span>
        </div>
        {retirou ? <p className="t-apoio">Fica registrado: entregue por {eu} a {retirou}, hoje às {HORA.format(new Date())}.</p> : null}
        {falha ? <Aviso tom="erro" papel="alert">{falha}</Aviso> : null}
        <div className="flex justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao disabled={enviando} onClick={() => void confirmar()}><Icone nome="check" />Confirmar a entrega</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

/** Avisei por outro meio: interfone, bilhete ou pessoalmente, e com quem falou. */
export function JanelaOutroMeio({ e, aoFechar, salvo }: { e: Encomenda; aoFechar: () => void; salvo: (texto: string) => void }) {
  const [meio, setMeio] = useState<MeioAviso>("INTERFONE");
  const [com, setCom] = useState("");
  const [falha, setFalha] = useState<string | null>(null);
  async function registrar() {
    const r = await chamarApi(`/v1/condominio/encomendas/${e.id}/outro-meio`, { corpo: { meio, com: com.trim() || null } });
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    salvo(`${e.unidade.rotulo} avisada por outro meio: ${MEIOS_AVISO[meio].toLowerCase()}.`);
  }
  return (
    <Dialogo aberto fechar titulo={`Como avisou a ${e.unidade.rotulo}?`} aoFechar={aoFechar}>
      <div className="grid gap-4">
        <Escolha rotulo="Como avisou" atual={meio} aoMudar={setMeio}
          opcoes={(Object.keys(MEIOS_AVISO) as MeioAviso[]).map((m) => ({ valor: m, texto: MEIOS_AVISO[m] }))} />
        <CampoTexto id="om-com" rotulo="Com quem falou" opcional value={com} maxLength={80} onChange={(x) => setCom(x.target.value)} />
        <p className="t-apoio">A encomenda passa a Avisada por outro meio, com seu nome e a hora.</p>
        {falha ? <Aviso tom="erro" papel="alert">{falha}</Aviso> : null}
        <div className="flex justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={() => void registrar()}>Registrar o aviso</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

/** Corrigir o registro enquanto está guardada; trocar a unidade avisa a unidade certa. */
export function JanelaCorrigir({ e, opcoes, aoFechar, salvo }: { e: Encomenda; opcoes: OpcoesEncomenda; aoFechar: () => void; salvo: (texto: string) => void }) {
  const [v, setV] = useState({ unidadeId: e.unidade.id, remetente: e.remetente, volumes: e.volumes, lugarId: e.lugar?.id ?? "", observacao: e.observacao ?? "" });
  const [falha, setFalha] = useState<string | null>(null);
  const [campos, setCampos] = useState<string[]>([]);
  const lugares = opcoes.lugares.some((l) => l.id === v.lugarId) || !e.lugar ? opcoes.lugares : [...opcoes.lugares, { id: e.lugar.id, nome: `${e.lugar.nome} (fora de uso)` }];
  async function salvar() {
    const r = await chamarApi<{ avisos: number }>(`/v1/condominio/encomendas/${e.id}`, {
      metodo: "PUT", corpo: { ...v, volumes: Number(v.volumes), observacao: v.observacao.trim() || null, versao: e.versao },
    });
    if (!r.ok) { setCampos(camposComErro(r.erro)); return setFalha(textoDoErro(r.erro)); }
    salvo(v.unidadeId !== e.unidade.id ? `Registro corrigido. A unidade certa foi avisada${r.dados.avisos ? "" : " (sem aviso pelo WhatsApp)"}.` : "Registro corrigido.");
  }
  return (
    <Dialogo aberto media fechar titulo="Corrigir o registro" apoio="Trocar a unidade avisa a unidade certa." aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={(x) => { x.preventDefault(); void salvar(); }}>
        <CampoSelecao id="co-unidade" rotulo="Unidade" value={v.unidadeId} onChange={(x) => setV({ ...v, unidadeId: x.target.value })}
          opcoes={opcoes.unidades.map((u) => ({ valor: u.id, texto: u.rotulo }))} erro={campos.includes("unidadeId") ? "Escolha a unidade" : undefined} />
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
          <CampoTexto id="co-remetente" rotulo="De quem veio" value={v.remetente} maxLength={60} onChange={(x) => setV({ ...v, remetente: x.target.value })}
            erro={campos.includes("remetente") ? "De 2 a 60 caracteres" : undefined} />
          <CampoTexto id="co-volumes" rotulo="Volumes" type="number" min={1} max={50} value={v.volumes} onChange={(x) => setV({ ...v, volumes: Number(x.target.value) })} />
        </div>
        <CampoSelecao id="co-lugar" rotulo="Onde está" value={v.lugarId} onChange={(x) => setV({ ...v, lugarId: x.target.value })}
          opcoes={lugares.map((l) => ({ valor: l.id, texto: l.nome }))} />
        <CampoAreaTexto id="co-obs" rotulo="Observação" opcional value={v.observacao} maxLength={200} onChange={(x) => setV({ ...v, observacao: x.target.value })} />
        {falha ? <Aviso tom="erro" papel="alert">{falha}</Aviso> : null}
        <div className="flex justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit">Salvar a correção</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** As janelas da linha, juntas: quem chama diz qual está aberta. */
export function JanelasEncomenda({ aberta, opcoes, eu, aoFechar, salvo }: {
  aberta: { e: Encomenda; acao: AcaoEncomenda } | null; opcoes: OpcoesEncomenda | null; eu: string; aoFechar: () => void; salvo: (texto: string) => void;
}) {
  if (!aberta) return null;
  const { e, acao } = aberta;
  if (acao === "entregar") return <JanelaEntregar e={e} eu={eu} aoFechar={aoFechar} salvo={salvo} />;
  if (acao === "outro-meio") return <JanelaOutroMeio e={e} aoFechar={aoFechar} salvo={salvo} />;
  if (acao === "corrigir" && opcoes) return <JanelaCorrigir e={e} opcoes={opcoes} aoFechar={aoFechar} salvo={salvo} />;
  return null;
}

/** Abre a foto da etiqueta numa aba nova (link de 5 minutos). */
export function abrirEtiqueta(e: Encomenda): Promise<string | null> {
  return e.fotoEtiqueta ? abrirLink(`/v1/condominio/encomendas/${e.id}/fotos/${e.fotoEtiqueta}/link`) : Promise.resolve(null);
}
