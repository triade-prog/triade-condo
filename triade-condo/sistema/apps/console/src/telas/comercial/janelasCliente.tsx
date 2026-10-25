"use client";
// As janelas do piloto, do virar cliente, da troca de sistema e da oportunidade nova (0308, R17.4;
// quadros 331, 338 e 345, aprovados; CM-08, CM-09, CM-21 e CM-29). Toda gravação passa pela
// api-console; quem pode e o que cada passo pede é do banco.

import { useState, type FormEvent } from "react";
import { FAIXAS_PRECO, linkWhatsappComercial, METAS_PILOTO, MOTIVOS_PERDA, PRAZOS_PILOTO, type MetaPiloto, type MotivoPerda } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, classeBotao, Dialogo, Icone, Interruptor, type ErroApi } from "@triade/ui";
import { EscolhaBotoes, ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { Dado } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import {
  criadoAoVirarCliente, daImplantacao, hojeBrasilia, NOMES_FALTA, ROTAS_CLIENTE, terminaEm, textoMedida, textoMeta, textoPrazo, type ClienteCriado, type MembroEquipe,
  type Piloto, type RespostaTroca, type Troca,
} from "./cliente.ts";
import { ROTAS_PROPOSTAS, type FichaProposta, type ListaPropostas } from "./propostas.ts";
import type { FichaInteressado, Pessoa } from "./tipos.ts";

const dataBr = (d: string) => d.split("-").reverse().join("/");

/** Quem cuida da implantação: da equipe com a função Implantação (passa a ver o cliente na carteira). */
function CampoImplantacao({ id, valor, aoMudar, erro, ajuda }: { id: string; valor: string; aoMudar: (v: string) => void; erro?: string; ajuda: string }) {
  const equipe = useCarregar<{ pessoas: MembroEquipe[] }>(ROTAS_CLIENTE.equipe);
  if (equipe.estado === "carregando") return <Carregando linhas={1} rotulo="Buscando a equipe…" />;
  if (equipe.estado === "erro") return <Aviso tom="erro">{`Não deu para buscar a equipe: ${equipe.texto}`}</Aviso>;
  const lista = daImplantacao(equipe.dados.pessoas);
  if (!lista.length) return <Aviso tom="atencao">Ninguém da equipe tem a função Implantação. Dê a função em Equipe antes.</Aviso>;
  return (
    <CampoSelecao id={id} rotulo="Quem cuida da implantação" value={valor} onChange={(e) => aoMudar(e.target.value)} ajuda={ajuda} erro={erro}
      opcoes={[{ valor: "", texto: "Escolha" }, ...lista.map((p) => ({ valor: p.id, texto: `${p.nome} (Implantação)` }))]} />
  );
}

/** Piloto com critério de sucesso (quadro 338, CM-21): prazo curto e meta combinada antes. */
export function JanelaPiloto({ i, aoFechar, feito }: { i: Pick<FichaInteressado, "id" | "versao" | "condominio">; aoFechar: () => void; feito: () => void }) {
  const [prazo, setPrazo] = useState<"30" | "45" | "60">("45");
  const [comeca, setComeca] = useState(hojeBrasilia());
  const [meta, setMeta] = useState<MetaPiloto | null>("RETORNOS_NO_PRAZO");
  const [pct, setPct] = useState("80");
  const [combinado, setCombinado] = useState("");
  const [resp, setResp] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const fim = terminaEm(comeca, Number(prazo));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const n = Number(pct);
    const faltam = [
      ...(!meta ? ["meta"] : []), ...(!Number.isInteger(n) || n < 1 || n > 100 ? ["metaPercentual"] : []),
      ...(combinado.trim().length < 3 ? ["combinadoCom"] : []), ...(!resp ? ["responsavelImplantacaoId"] : []),
    ];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const r = await chamarApi(ROTAS_CLIENTE.piloto(i.id), {
      corpo: { versao: i.versao, prazoDias: Number(prazo), comecaEm: comeca, meta, metaPercentual: n, combinadoCom: combinado.trim(), responsavelImplantacaoId: resp, cidade: null, uf: null },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`Piloto para ${i.condominio}`} aoFechar={aoFechar} media
      apoio="Prazo curto e meta combinada antes, para a assembleia decidir com números (CM-21).">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <EscolhaBotoes nome="piloto-prazo" legenda="Prazo" valor={prazo} aoMudar={setPrazo}
          opcoes={PRAZOS_PILOTO.map((p) => ({ valor: String(p) as "30" | "45" | "60", texto: `${p} dias` }))} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="piloto-comeca" rotulo="Começa em" type="date" min={hojeBrasilia()} value={comeca} onChange={(e) => setComeca(e.target.value)}
            erro={campos.includes("comecaEm") ? "O piloto começa de hoje a 60 dias." : undefined} />
          <CampoTexto id="piloto-termina" rotulo="Termina em" value={fim ? dataBr(fim) : ""} readOnly aria-readonly="true" ajuda="Sai do começo e do prazo." />
        </div>
        <EscolhaBotoes nome="piloto-meta" legenda="Meta combinada antes (obrigatório)" valor={meta} aoMudar={setMeta}
          opcoes={(Object.entries(METAS_PILOTO) as [MetaPiloto, string][]).map(([valor, texto]) => ({ valor, texto }))}
          ajuda={campos.includes("meta") ? <span className="text-erro">Escolha a meta.</span> : undefined} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="piloto-pct" rotulo="Meta (%)" inputMode="numeric" maxLength={3} value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, ""))}
            ajuda={meta ? `${textoMeta(meta, Number(pct) || 0)}. Medida pela própria Plataforma, em Indicadores.` : "Medida pela própria Plataforma, em Indicadores."}
            erro={campos.includes("metaPercentual") ? "De 1% a 100%." : undefined} />
          <CampoTexto id="piloto-combinado" rotulo="Combinado com" maxLength={120} value={combinado} onChange={(e) => setCombinado(e.target.value)}
            placeholder="Sérgio Alves, síndico" ajuda="Só a equipe vê; não vai para o kit."
            erro={campos.includes("combinadoCom") ? "Diga com quem a meta foi combinada." : undefined} />
        </div>
        <CampoImplantacao id="piloto-resp" valor={resp} aoMudar={setResp} ajuda="Cuida da implantação mínima do piloto e passa a ver o condomínio na carteira."
          erro={campos.includes("responsavelImplantacaoId") ? "Escolha quem cuida da implantação." : undefined} />
        <p className="rounded-xl bg-superficie-2 px-3.5 py-3 t-apoio">No fim, o piloto vira proposta ou perdido com motivo. O condomínio entra na carteira como Em piloto, com a implantação mínima, sem cobrança.</p>
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Começar o piloto" />
      </form>
    </Dialogo>
  );
}

/** Encerrar o piloto: vira proposta ou perdido com motivo (perdido só a Administração). */
export function JanelaEncerrarPiloto({ piloto, podePerder, aoFechar, feito }: { piloto: Piloto; podePerder: boolean; aoFechar: () => void; feito: (texto: string) => void }) {
  const [resultado, setResultado] = useState<"PROPOSTA" | "PERDIDO" | null>(null);
  const [motivo, setMotivo] = useState<MotivoPerda | null>(null);
  const [detalhe, setDetalhe] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const faltam = [...(!resultado ? ["resultado"] : []), ...(resultado === "PERDIDO" && !motivo ? ["motivoPerda"] : [])];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const r = await chamarApi(ROTAS_CLIENTE.encerrarPiloto(piloto.id), {
      corpo: { versao: piloto.versao, resultado, motivoPerda: resultado === "PERDIDO" ? motivo : null, detalhe: detalhe.trim() || null },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(resultado === "PERDIDO" ? "Piloto encerrado como perdido. O interessado foi para Perdido." : "Piloto encerrado: segue para a proposta.");
  }

  return (
    <Dialogo aberto titulo="Encerrar o piloto" aoFechar={aoFechar} media apoio={`${textoPrazo(piloto)} · meta de ${textoMeta(piloto.meta, piloto.metaPercentual)}.`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-texto">{textoMedida(piloto.medida)}</p>
        <EscolhaBotoes nome="piloto-resultado" legenda="Como terminou" valor={resultado} aoMudar={setResultado}
          opcoes={[{ valor: "PROPOSTA" as const, texto: "Virou proposta" }, ...(podePerder ? [{ valor: "PERDIDO" as const, texto: "Perdido" }] : [])]}
          ajuda={campos.includes("resultado") ? <span className="text-erro">Diga como o piloto terminou.</span>
            : resultado === "PERDIDO" ? "O interessado vai para Perdido e o condomínio fica na carteira como Piloto encerrado."
            : resultado === "PROPOSTA" ? "O condomínio continua em piloto até virar cliente, sem cobrança." : undefined} />
        {!podePerder ? <p className="t-apoio">Só a Administração encerra o piloto como perdido.</p> : null}
        {resultado === "PERDIDO" ? (
          <EscolhaBotoes nome="piloto-motivo" legenda="Por que não fechou (obrigatório)" valor={motivo} aoMudar={setMotivo}
            opcoes={Object.entries(MOTIVOS_PERDA).map(([valor, texto]) => ({ valor: valor as MotivoPerda, texto }))}
            ajuda={campos.includes("motivoPerda") ? <span className="text-erro">Escolha o motivo.</span> : undefined} />
        ) : null}
        <CampoAreaTexto id="piloto-detalhe" rotulo="O que aconteceu" opcional maxLength={500} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Encerrar o piloto" perigo={resultado === "PERDIDO"} icone={resultado === "PERDIDO" ? "fechar" : "check"} />
      </form>
    </Dialogo>
  );
}

/** Virar cliente (quadro 331, CM-08): com o contrato assinado, cria tudo de uma vez. */
export function JanelaVirarCliente({ f, aoFechar, feito, aoFaltar }: {
  f: FichaInteressado; aoFechar: () => void; feito: (r: ClienteCriado) => void; aoFaltar: (campos: string[]) => void;
}) {
  const lista = useCarregar<ListaPropostas>(ROTAS_PROPOSTAS.lista(null, f.id));
  const propostaId = lista.estado === "pronto" ? lista.dados.propostas[0]?.id : undefined;
  const proposta = useCarregar<FichaProposta>(propostaId ? ROTAS_PROPOSTAS.proposta(propostaId) : null);
  const troca = useCarregar<RespostaTroca>(ROTAS_CLIENTE.troca(f.id));
  const [resp, setResp] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const aceita = proposta.estado === "pronto" ? proposta.dados.versoes.find((v) => v.situacao === "ACEITA") : undefined;
  const doPiloto = !!f.piloto && ["EM_ANDAMENTO", "VIROU_PROPOSTA"].includes(f.piloto.situacao);
  const linhas = criadoAoVirarCliente({
    condominio: aceita?.condominio ?? f.condominio, cidade: f.cidade ?? aceita?.cidade, uf: f.uf ?? aceita?.uf, pessoa: f.pessoa, decisor: f.predio.decisor,
    versao: aceita, troca: troca.estado === "pronto" ? troca.dados.troca : undefined, doPiloto,
  });
  const carregando = lista.estado === "carregando" || (propostaId && proposta.estado === "carregando") || troca.estado === "carregando";

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!resp) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["responsavelImplantacaoId"] } });
    setEnviando(true);
    const r = await chamarApi<ClienteCriado>(ROTAS_CLIENTE.virarCliente(f.id), { corpo: { versao: f.versao, responsavelImplantacaoId: resp, cidade: null, uf: null, cenario: null } });
    setEnviando(false);
    if (!r.ok) {
      if (r.erro.detalhes?.motivo === "FALTA_PARA_ETAPA") return aoFaltar(camposComErro(r.erro));
      return setErro(r.erro);
    }
    feito(r.dados);
  }

  return (
    <Dialogo aberto titulo="Virar cliente" aoFechar={aoFechar} larga
      apoio={`${f.condominio}${aceita ? ` · proposta v${aceita.numero} aceita` : ""} · contrato assinado pelos dois.`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-texto">Com o contrato assinado, isto é criado de uma vez, sem digitar de novo (CM-08):</p>
        {carregando ? <Carregando linhas={4} rotulo="Juntando o que vai ser criado…" /> : (
          <div className="rounded-[14px] border border-linha px-4" role="list" aria-label="O que vai ser criado">
            {linhas.map(([nome, texto]) => <div key={nome} role="listitem"><Dado icone="check" nome={nome}>{texto}</Dado></div>)}
          </div>
        )}
        <CampoImplantacao id="virar-resp" valor={resp} aoMudar={setResp}
          ajuda="Passa a ver este cliente na carteira. O Comercial deixa de ver os dados do condomínio (CM-11)."
          erro={campos.includes("responsavelImplantacaoId") ? "Escolha quem cuida da implantação." : undefined} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Criar o cliente e abrir a implantação" icone="predio" />
      </form>
    </Dialogo>
  );
}

/** O aviso do que o Ganho pede, quando Virar cliente volta com FALTA_PARA_ETAPA. */
export const textoFaltaGanho = (campos: string[]) => `Para virar cliente o Ganho pede ${campos.map((c) => NOMES_FALTA[c] ?? c).join(", ")}.`;

const FAIXAS = Object.entries(FAIXAS_PRECO).map(([valor, f]) => ({ valor, texto: f.nome }));

/** Oportunidade nova para outro condomínio do mesmo contato (CM-09). */
export function JanelaNovaOportunidade({ i, equipe, aoFechar, feito }: {
  i: Pick<FichaInteressado, "id" | "pessoa" | "responsavel">; equipe: Pessoa[]; aoFechar: () => void; feito: (id: string) => void;
}) {
  const [v, setV] = useState({ condominio: "", cnpj: "", endereco: "", cidade: "", uf: "", faixa: "", unidades: "", responsavelId: i.responsavel?.id ?? "" });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const muda = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const duplicado = erro?.detalhes?.motivo === "DUPLICADO";

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (v.condominio.trim().length < 2) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["condominio"] } });
    setEnviando(true);
    const r = await chamarApi<{ id: string }>(ROTAS_CLIENTE.oportunidades(i.id), {
      corpo: {
        condominio: v.condominio.trim(), cnpj: v.cnpj || null, endereco: v.endereco || null, cidade: v.cidade || null, uf: v.uf || null, faixa: v.faixa || null,
        unidades: v.unidades ? Number(v.unidades) : null, responsavelId: v.responsavelId || null,
      },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(r.dados.id);
  }

  return (
    <Dialogo aberto titulo="Nova oportunidade para outro condomínio" aoFechar={aoFechar} media>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-apoio">{`Com o mesmo contato${i.pessoa ? ` (${i.pessoa})` : ""} e a mesma base legal. Cada condomínio tem a sua etapa e a sua proposta; a etapa começa em Novo e nada sai sozinho.`}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="op-condominio" rotulo="Condomínio" maxLength={120} value={v.condominio} onChange={muda("condominio")}
            erro={campos.includes("condominio") ? (duplicado ? "Este contato já tem uma oportunidade para este condomínio." : "Escreva o nome do condomínio.") : undefined} />
          <CampoTexto id="op-cnpj" rotulo="CNPJ" opcional inputMode="numeric" maxLength={20} value={v.cnpj} onChange={muda("cnpj")}
            erro={campos.includes("cnpj") ? (duplicado ? "Este CNPJ já é de outro interessado." : "CNPJ com 14 dígitos.") : undefined} />
          <CampoTexto id="op-endereco" rotulo="Endereço" opcional maxLength={200} value={v.endereco} onChange={muda("endereco")} className="md:col-span-2" />
          <CampoTexto id="op-cidade" rotulo="Cidade" opcional maxLength={80} value={v.cidade} onChange={muda("cidade")} />
          <CampoTexto id="op-uf" rotulo="UF" opcional maxLength={2} value={v.uf} onChange={muda("uf")} erro={campos.includes("uf") ? "Duas letras, como DF." : undefined} />
          <CampoSelecao id="op-faixa" rotulo="Faixa de unidades" opcional value={v.faixa} onChange={muda("faixa")} opcoes={[{ valor: "", texto: "Ainda não sei" }, ...FAIXAS]} />
          <CampoTexto id="op-unidades" rotulo="Unidades" opcional inputMode="numeric" maxLength={5} value={v.unidades}
            onChange={(e) => setV((x) => ({ ...x, unidades: e.target.value.replace(/\D/g, "") }))} />
          <CampoSelecao id="op-resp" rotulo="Responsável" opcional value={v.responsavelId} onChange={muda("responsavelId")}
            opcoes={[{ valor: "", texto: "O mesmo desta ficha" }, ...equipe.map((p) => ({ valor: p.id, texto: p.nome }))]} />
        </div>
        {erro && (!campos.length || !duplicado) && !campos.some((c) => ["condominio", "cnpj", "uf"].includes(c)) ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Abrir a oportunidade" icone="mais" />
      </form>
    </Dialogo>
  );
}

/** Começar ou editar a troca de sistema (quadro 345): empresa de antes, data, o que pedir e a carta. */
export function JanelaTroca({ interessadoId, dados, aoFechar, feito }: { interessadoId: string; dados: RespostaTroca; aoFechar: () => void; feito: (t: Troca) => void }) {
  const t = dados.troca ?? null;
  const [empresa, setEmpresa] = useState(t?.empresaAnterior ?? dados.administradora ?? dados.sistemaAtual ?? "");
  const [quando, setQuando] = useState(t?.dataTroca ?? "");
  const [itens, setItens] = useState(t?.itens ?? dados.itensPadrao);
  const [novo, setNovo] = useState("");
  const [carta, setCarta] = useState(t?.carta ?? "");
  const [refazer, setRefazer] = useState(!t);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const faltam = [...(empresa.trim().length < 2 ? ["empresaAnterior"] : []), ...(!quando ? ["dataTroca"] : []), ...(!itens.length ? ["itens"] : [])];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const r = await chamarApi<Troca>(ROTAS_CLIENTE.troca(interessadoId), {
      metodo: "PUT", corpo: { versao: t?.versao ?? null, empresaAnterior: empresa.trim(), dataTroca: quando, itens, carta: refazer ? null : carta },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(r.dados);
  }

  function juntar() {
    const x = novo.trim();
    if (x.length < 3 || itens.length >= 20) return;
    setItens((l) => [...l, { texto: x, recebido: false }]);
    setNovo("");
  }

  return (
    <Dialogo aberto titulo={t ? "Editar a troca de sistema" : "Começar a troca de sistema"} aoFechar={aoFechar} media>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-apoio">A carta é da síndica para a empresa anterior; a TRÍADE não fala pelo condomínio.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="troca-empresa" rotulo="Sistema ou empresa de antes" maxLength={120} value={empresa} onChange={(e) => setEmpresa(e.target.value)}
            erro={campos.includes("empresaAnterior") ? "Diga o sistema ou a empresa de antes." : undefined} />
          <CampoTexto id="troca-data" rotulo="Dia da troca" type="date" value={quando} onChange={(e) => setQuando(e.target.value)}
            ajuda="A linha do tempo conta a partir dele." erro={campos.includes("dataTroca") ? "Diga a data da troca (até um ano)." : undefined} />
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 t-apoio font-medium">O que pedir à empresa anterior</legend>
          <ul className="grid gap-1.5">
            {itens.map((x, n) => (
              <li key={`${x.texto}-${n}`} className="flex items-center justify-between gap-2 rounded-xl border border-linha px-3 py-1.5 t-texto">
                <span>{x.texto}{x.recebido ? <span className="t-apoio"> · recebido</span> : null}</span>
                <Botao variante="discreto" tamanho="m" aria-label={`Tirar ${x.texto}`} onClick={() => setItens((l) => l.filter((_, k) => k !== n))}>
                  <Icone nome="fechar" className="h-4 w-4" />Tirar
                </Botao>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <CampoTexto id="troca-novo" rotulo="Outro item" opcional maxLength={120} value={novo} onChange={(e) => setNovo(e.target.value)} className="min-w-0 flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); juntar(); } }} />
            <Botao variante="contorno" onClick={juntar} disabled={novo.trim().length < 3}><Icone nome="mais" />Juntar</Botao>
          </div>
          {campos.includes("itens") ? <span className="t-apoio text-erro">De 1 a 20 itens, cada um com 3 letras ou mais.</span> : null}
          <span className="t-apoio">Mínimo para começar: unidades e moradores; o resto entra depois sem travar a entrega.</span>
        </fieldset>
        {t ? <Interruptor id="troca-refazer" rotulo="Refazer a carta pela carta-modelo" marcado={refazer} aoMudar={setRefazer}
          ajuda="Com a empresa, a data e o que falta de agora. O texto escrito à mão é trocado." /> : null}
        {t && !refazer ? (
          <CampoAreaTexto id="troca-carta" rotulo="Carta à empresa anterior" maxLength={4000} value={carta} onChange={(e) => setCarta(e.target.value)} className="[&_textarea]:min-h-56"
            erro={campos.includes("carta") ? "A carta vai de 20 a 4 mil letras." : undefined} />
        ) : !t ? <p className="t-apoio">A carta sai da carta-modelo, em nome de quem aceitou a proposta, com o que falta receber. Dá para editar depois.</p> : null}
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={t ? "Salvar a troca" : "Começar a troca"} />
      </form>
    </Dialogo>
  );
}

/** "Mandar a carta para a síndica": ela assina e manda à empresa anterior; fica registrada a data. */
export function JanelaCartaTroca({ interessadoId, troca, whatsapp, aoFechar, feito }: {
  interessadoId: string; troca: Troca; whatsapp?: string; aoFechar: () => void; feito: (t: Troca) => void;
}) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [copiada, setCopiada] = useState(false);

  async function copiar() {
    try { await navigator.clipboard.writeText(troca.carta); setCopiada(true); } catch { setCopiada(false); }
  }

  async function registrar() {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<Troca>(ROTAS_CLIENTE.cartaEnviada(interessadoId), { corpo: { versao: troca.versao } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(r.dados);
  }

  return (
    <Dialogo aberto titulo="Mandar a carta para a síndica" aoFechar={aoFechar} media>
      <div className="grid gap-4">
        <p className="t-apoio">{`Ela assina e manda à ${troca.empresaAnterior}. A TRÍADE não fala pelo condomínio.`}</p>
        <p className="max-h-72 overflow-y-auto rounded-xl border border-linha bg-fundo p-3.5 t-texto whitespace-pre-wrap" tabIndex={0} aria-label="Texto da carta">{troca.carta}</p>
        <div className="flex flex-wrap gap-2 max-md:grid">
          <Botao variante="contorno" onClick={() => void copiar()}><Icone nome="copiar" />{copiada ? "Carta copiada" : "Copiar a carta"}</Botao>
          {whatsapp ? (
            <a className={classeBotao("contorno")}
              href={linkWhatsappComercial(whatsapp, troca.carta)} target="_blank" rel="noopener noreferrer"><Icone nome="whats" />Abrir no WhatsApp</a>
          ) : null}
        </div>
        <span role="status" className="sr-only">{copiada ? "Carta copiada." : ""}</span>
        {erro ? <ErroJanela erro={erro} /> : null}
        <div className="flex flex-wrap justify-end gap-2 max-md:grid">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao disabled={enviando} onClick={() => void registrar()}><Icone nome="check" />{enviando ? "Salvando…" : "Registrar que a carta foi mandada"}</Botao>
        </div>
      </div>
    </Dialogo>
  );
}
