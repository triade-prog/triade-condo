"use client";
// Modelos › Contrato (quadro 443, aprovado em 25/10/2026; EM-06 e CM-13): só a Administração
// (console.comercial.modelos). O texto do contrato vem do advogado e é cadastrado aqui, com os
// campos «...» que o sistema preenche; usar uma versão pede a revisão do advogado (nome, OAB e
// data), o termo de tratamento de dados e o índice de reajuste. A versão em uso nunca é editada:
// mudar o texto cria a versão seguinte; os contratos já gerados guardam a versão usada.

import { useState, type FormEvent } from "react";
import { CAMPOS_CONTRATO, camposErradosContrato, normalizarOab, SITUACOES_MODELO_CONTRATO } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, Vazio, type ErroApi } from "@triade/ui";
import { Cartao, diaHora } from "../comum.tsx";
import { ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { hojeBrasilia } from "./cliente.ts";
import { documentoExemplo, ROTAS_CONTRATO, textoFaltaModelo, textoRevisao, type ModeloContrato, type RespostaModelos } from "./contrato.ts";

/** O texto com os campos «...» à vista, em fonte de código. */
function TextoComCampos({ texto }: { texto: string }) {
  return (
    <p className="t-texto whitespace-pre-wrap [overflow-wrap:anywhere]">
      {texto.split(/(«[^«»]*»)/g).map((t, n) => (t.startsWith("«") ? <span key={n} className="rounded-md bg-superficie-2 px-1 t-codigo">{t}</span> : t))}
    </p>
  );
}

function Regra({ titulo, texto, ok }: { titulo: string; texto: string; ok?: boolean }) {
  return (
    <li className="flex items-start gap-3 border-t border-linha py-3 first:border-t-0">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${ok === false ? "bg-atencao-fundo text-atencao" : "bg-ok-fundo text-ok"}`} aria-hidden="true">
        <Icone nome={ok === false ? "relogio" : "check"} className="h-3.5 w-3.5" />
      </span>
      <span className="grid gap-0.5"><span className="t-texto font-medium">{titulo}</span><span className="t-apoio">{texto}</span></span>
    </li>
  );
}

const TOM_MODELO = { EM_USO: "ok", RASCUNHO: "neutro", SUBSTITUIDA: "neutro" } as const;
const NOME_SITUACAO = (m: ModeloContrato) => (m.situacao === "RASCUNHO" ? "Rascunho guardado" : SITUACOES_MODELO_CONTRATO[m.situacao]);

export function AbaContrato() {
  const carga = useCarregar<RespostaModelos>(ROTAS_CONTRATO.modelos);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [janela, setJanela] = useState<{ tipo: "editar"; m: Partial<ModeloContrato> } | { tipo: "usar"; m: ModeloContrato } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  if (carga.estado === "carregando") return <Carregando rotulo="Buscando o modelo de contrato…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const emUso = d.versoes.find((m) => m.situacao === "EM_USO");
  const m = d.versoes.find((x) => x.id === escolhida) ?? emUso ?? d.versoes[0];
  const pronto = (texto: string, id?: string) => { setJanela(null); setAviso(texto); if (id) setEscolhida(id); carga.recarregar(); };
  const nova = () => setJanela({ tipo: "editar", m: emUso ? { titulo: emUso.titulo, texto: emUso.texto, termo: emUso.termo, indiceReajuste: emUso.indiceReajuste } : {} });

  async function baixarExemplo(x: ModeloContrato) {
    setBaixando(true);
    try {
      const { baixarPdf } = await import("./pdf.ts");
      await baixarPdf(documentoExemplo(x));
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl t-apoio">O texto do contrato vem do advogado e é cadastrado aqui pela Administração. O Comercial só gera o contrato a partir dele.</p>
        {d.podeEditar ? <Botao onClick={nova}><Icone nome="mais" />Cadastrar versão nova</Botao> : null}
      </div>
      {aviso ? <Aviso tom="ok" papel="status">{aviso}</Aviso> : null}
      {!emUso ? <Aviso tom="atencao" titulo="Sem modelo em uso">Nenhuma versão foi revisada por advogado e posta em uso. Gerar contrato fica desligado no Comercial.</Aviso> : null}
      {!d.versoes.length ? (
        <Vazio titulo="Nenhuma versão do contrato" icone="documento">Cadastre o texto que o advogado revisou, com os campos que o sistema preenche.</Vazio>
      ) : (
        <>
          <Cartao id="modelo-versoes" titulo="Versões do modelo" icone="camadas">
            <ul className="grid">
              {d.versoes.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-3 border-t border-linha py-3 first:border-t-0">
                  <b className="w-10 t-texto">{`v${x.numero}`}</b>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="t-texto">{textoRevisao(x)}</span>
                    <span className="t-apoio">
                      {x.situacao === "RASCUNHO"
                        ? `Não pode ser usado para gerar contrato${x.falta.length ? `. ${textoFaltaModelo(x.falta)}` : ". Pronto para usar."}`
                        : `Cadastrado${x.criadoPor ? ` por ${x.criadoPor.nome}` : ""} em ${diaHora(x.criadoEm)} · usado em ${x.contratos} ${x.contratos === 1 ? "contrato" : "contratos"}`}
                    </span>
                  </span>
                  <Selo tom={TOM_MODELO[x.situacao]}>{NOME_SITUACAO(x)}</Selo>
                  <Botao variante="discreto" aria-pressed={m?.id === x.id} aria-label={`Ver o texto da v${x.numero}`} onClick={() => setEscolhida(x.id)}><Icone nome="olho" />Ver</Botao>
                </li>
              ))}
            </ul>
          </Cartao>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {m ? (
              <Cartao id="modelo-texto" titulo={`Texto da v${m.numero}`} icone="documento"
                acao={<Botao variante="discreto" disabled={baixando} onClick={() => void baixarExemplo(m)}><Icone nome="baixar" />{baixando ? "Montando…" : "Baixar em PDF de exemplo"}</Botao>}>
                <div className="grid gap-3 rounded-[12px] border border-linha bg-fundo p-4">
                  <p className="t-texto font-semibold">{m.titulo}</p>
                  {m.texto ? <TextoComCampos texto={m.texto} /> : null}
                  {m.termo ? <><p className="t-rotulo">Termo de tratamento de dados</p><TextoComCampos texto={m.termo} /></> : <p className="t-apoio">Sem o termo de tratamento de dados.</p>}
                </div>
                <p className="t-apoio">{`${textoRevisao(m)}${m.indiceReajuste ? ` · reajuste pelo ${m.indiceReajuste}` : " · sem índice de reajuste"}.`}</p>
                {d.podeEditar && m.situacao === "RASCUNHO" ? (
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-2 max-md:grid">
                      <Botao variante="contorno" onClick={() => setJanela({ tipo: "editar", m })}><Icone nome="editar" />Editar o rascunho</Botao>
                      <Botao disabled={m.falta.length > 0} aria-describedby={m.falta.length ? "modelo-falta" : undefined} onClick={() => setJanela({ tipo: "usar", m })}>
                        <Icone nome="check" />Usar esta versão
                      </Botao>
                    </div>
                    {m.falta.length ? <p id="modelo-falta" className="t-apoio">{textoFaltaModelo(m.falta)}</p> : null}
                  </div>
                ) : null}
              </Cartao>
            ) : null}
            <div className="grid content-start gap-5">
              <Cartao id="modelo-campos" titulo="Campos que o sistema preenche" icone="lista">
                <ul className="flex flex-wrap gap-1.5" aria-label="Campos do modelo">
                  {d.campos.map((k) => (
                    <li key={k}><span className="inline-flex rounded-lg bg-superficie-2 px-2 py-0.5 t-codigo" title={CAMPOS_CONTRATO[k as keyof typeof CAMPOS_CONTRATO]}>{`«${k}»`}</span></li>
                  ))}
                </ul>
                <p className="t-apoio">Campo escrito errado ou que não existe impede salvar a versão.</p>
              </Cartao>
              <Cartao id="modelo-regras" titulo="Para usar uma versão" icone="escudo">
                <ul className="grid">
                  <Regra titulo="Revisada por advogado" texto="Nome, OAB e data da revisão, obrigatórios." />
                  <Regra titulo="Termo de tratamento de dados junto" texto="A TRÍADE como operadora dos dados do condomínio." />
                  <Regra titulo="Índice de reajuste" texto="O índice do reajuste anual, com aviso antes (CM-30)." />
                </ul>
                <p className="t-apoio">Uma versão em uso nunca é editada: mudar o texto cria a versão seguinte. Contratos já gerados guardam a versão usada.</p>
              </Cartao>
            </div>
          </div>
        </>
      )}
      {janela?.tipo === "editar" ? <JanelaModeloContrato m={janela.m} aoFechar={() => setJanela(null)} feito={(t, id) => pronto(t, id)} /> : null}
      {janela?.tipo === "usar" ? (
        <JanelaUsarModelo m={janela.m} emUso={emUso} aoFechar={() => setJanela(null)} feito={() => pronto(`A v${janela.m.numero} está em uso. Os próximos contratos saem dela.`, janela.m.id)} />
      ) : null}
    </div>
  );
}

function JanelaModeloContrato({ m, aoFechar, feito }: { m: Partial<ModeloContrato>; aoFechar: () => void; feito: (texto: string, id?: string) => void }) {
  const [titulo, setTitulo] = useState(m.titulo ?? "Contrato de uso da plataforma");
  const [texto, setTexto] = useState(m.texto ?? "");
  const [termo, setTermo] = useState(m.termo ?? "");
  const [indice, setIndice] = useState(m.indiceReajuste ?? "");
  const [advogado, setAdvogado] = useState(m.id ? m.revisao?.advogado ?? "" : "");
  const [oab, setOab] = useState(m.id ? m.revisao?.oab ?? "" : "");
  const [revisado, setRevisado] = useState(m.id ? m.revisao?.em?.slice(0, 10) ?? "" : "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const erradosTexto = camposErradosContrato(texto);
  const erradosTermo = camposErradosContrato(termo);
  const errados = (lista: string[]) => (lista.length ? `Campo escrito errado ou que não existe: ${lista.join(", ")}. Use só os campos da lista.` : undefined);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const revisao = [advogado.trim(), oab.trim(), revisado];
    const faltam = [
      ...(titulo.trim().length < 3 ? ["titulo"] : []), ...(texto.trim().length < 50 || erradosTexto.length ? ["texto"] : []),
      ...(termo.trim() && (termo.trim().length < 50 || erradosTermo.length) ? ["termo"] : []),
      ...(revisao.some(Boolean) ? [...(advogado.trim().length < 3 ? ["advogadoNome"] : []), ...(!normalizarOab(oab) ? ["advogadoOab"] : []), ...(!revisado ? ["revisadoEm"] : [])] : []),
    ];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const r = await chamarApi<ModeloContrato>(ROTAS_CONTRATO.modelo(m.id), {
      metodo: m.id ? "PUT" : "POST",
      corpo: { versao: m.versao ?? null, titulo: titulo.trim(), texto, termo: termo.trim() || null, indiceReajuste: indice.trim() || null,
        advogadoNome: advogado.trim() || null, advogadoOab: oab.trim() || null, revisadoEm: revisado || null },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(m.id ? `Rascunho v${r.dados.numero} salvo.` : `Versão v${r.dados.numero} cadastrada como rascunho.`, r.dados.id);
  }

  const erroServidor = erro?.detalhes?.camposErrados as string[] | undefined;
  return (
    <Dialogo aberto titulo={m.id ? `Editar o rascunho v${m.numero}` : "Cadastrar versão nova"} aoFechar={aoFechar} larga>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-apoio">{`Cole o texto que o advogado revisou. Os campos entre « e » o sistema preenche: ${Object.keys(CAMPOS_CONTRATO).map((k) => `«${k}»`).join(", ")}.`}</p>
        <CampoTexto id="modelo-titulo" rotulo="Título" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)}
          erro={campos.includes("titulo") ? "Diga o título do contrato." : undefined} />
        <CampoAreaTexto id="modelo-texto-campo" rotulo="Texto do contrato" maxLength={100_000} rows={12} value={texto} onChange={(e) => setTexto(e.target.value)}
          erro={errados(erradosTexto) ?? (erroServidor?.length ? errados(erroServidor) : campos.includes("texto") ? "Cole o texto do contrato (de 50 a 100 mil letras)." : undefined)} />
        <CampoAreaTexto id="modelo-termo" rotulo="Termo de tratamento de dados" maxLength={50_000} rows={6} value={termo} onChange={(e) => setTermo(e.target.value)}
          ajuda="Vai no fim do mesmo PDF. Obrigatório para usar a versão." erro={errados(erradosTermo) ?? (campos.includes("termo") ? "O termo vai de 50 a 50 mil letras." : undefined)} />
        <CampoTexto id="modelo-indice" rotulo="Índice de reajuste" maxLength={60} value={indice} onChange={(e) => setIndice(e.target.value)} placeholder="IPCA"
          ajuda="Obrigatório para usar a versão." erro={campos.includes("indiceReajuste") ? "Diga o índice de reajuste (por exemplo, IPCA)." : undefined} />
        <fieldset className="grid gap-3 rounded-[16px] border border-linha p-4">
          <legend className="px-1 t-texto font-semibold">Revisão do advogado</legend>
          <p className="t-apoio">Obrigatória para usar a versão: nome, OAB e data, inteiros. Sem ela, a versão fica como rascunho.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <CampoTexto id="modelo-advogado" rotulo="Advogado" maxLength={120} value={advogado} onChange={(e) => setAdvogado(e.target.value)}
              erro={campos.includes("advogadoNome") ? "Diga o nome do advogado que revisou." : undefined} />
            <CampoTexto id="modelo-oab" rotulo="OAB" maxLength={30} value={oab} onChange={(e) => setOab(e.target.value)} placeholder="DF 12345"
              erro={campos.includes("advogadoOab") ? "Diga a OAB do advogado (por exemplo, DF 12345)." : undefined} />
            <CampoTexto id="modelo-revisado" rotulo="Revisado em" type="date" max={hojeBrasilia()} value={revisado} onChange={(e) => setRevisado(e.target.value)}
              erro={campos.includes("revisadoEm") ? "Diga a data da revisão (até hoje)." : undefined} />
          </div>
        </fieldset>
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={m.id ? "Salvar o rascunho" : "Cadastrar a versão"} />
      </form>
    </Dialogo>
  );
}

function JanelaUsarModelo({ m, emUso, aoFechar, feito }: { m: ModeloContrato; emUso?: ModeloContrato; aoFechar: () => void; feito: () => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function usar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(ROTAS_CONTRATO.usarModelo(m.id), { corpo: { versao: m.versao } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`Usar a v${m.numero}`} aoFechar={aoFechar}>
      <form onSubmit={usar} className="grid gap-4" noValidate>
        <p className="t-texto">{`${textoRevisao(m)}.`}</p>
        <p className="t-texto">
          {emUso ? `A v${emUso.numero}, em uso hoje, fica substituída. Os contratos já gerados guardam a versão usada; os próximos saem da v${m.numero}.` : `Os próximos contratos saem da v${m.numero}.`}
        </p>
        <p className="t-apoio">Depois de em uso, esta versão não se edita: mudar o texto cria a versão seguinte.</p>
        {erro ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Usar esta versão" />
      </form>
    </Dialogo>
  );
}
