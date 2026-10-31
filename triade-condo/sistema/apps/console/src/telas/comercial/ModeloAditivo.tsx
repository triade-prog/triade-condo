"use client";
// Modelos › Aditivo (0311; CM-13 e CM-30): o modelo do aditivo, com versões como o contrato. Só a
// Administração (console.comercial.modelos) cadastra e põe em uso; o Comercial lê. Da R17.7c (0318,
// C1): duas partes, Reajuste e Retorno, cada uma com os seus campos e a sua versão em uso. O aviso ao
// síndico gera o aditivo de reajuste; Reativar gera o de retorno. A versão em uso nunca é editada:
// mudar o texto cria a versão seguinte; os aditivos já gerados guardam a versão.

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ADITIVO_CAMPOS } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, Vazio, type ErroApi } from "@triade/ui";
import { AbasLista, Cartao, diaHora } from "../comum.tsx";
import { ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import {
  CAMPOS_RETORNO, camposErradosModelo, ROTAS_RENOVACOES, TEXTO_INICIAL_RETORNO, textoRegra, TIPOS_MODELO_ADITIVO, type RegraReajusteTela, type TipoModeloAditivo,
} from "./renovacoes.ts";
import type { Pessoa } from "./tipos.ts";

export interface ModeloAditivo {
  id: string;
  versao: number;
  /** Reajuste ou Retorno (0318); sem o tipo, é do reajuste. */
  tipo?: TipoModeloAditivo;
  numero: number;
  titulo: string;
  texto: string;
  situacao: "RASCUNHO" | "EM_USO" | "SUBSTITUIDA";
  emUsoEm?: string;
  emUsoPor?: Pessoa;
  substituidaEm?: string;
  criadoEm: string;
  criadoPor?: Pessoa;
  aditivos: number;
}

interface RespostaModelosAditivo {
  versoes: ModeloAditivo[];
  emUso?: ModeloAditivo;
  /** Os campos de cada tipo; a lista solta é a do reajuste (0311). */
  campos: string[] | Partial<Record<TipoModeloAditivo, string[]>>;
  regra: RegraReajusteTela;
  podeEditar: boolean;
}

const NOME_SITUACAO = { RASCUNHO: "Rascunho guardado", EM_USO: "Em uso", SUBSTITUIDA: "Substituída" } as const;
const TOM = { RASCUNHO: "neutro", EM_USO: "ok", SUBSTITUIDA: "neutro" } as const;
const NOMES_CAMPOS: Record<string, string> = { ...ADITIVO_CAMPOS, ...CAMPOS_RETORNO };

/** O tipo de uma versão: sem o campo, é do reajuste (as versões da 0311). */
export const tipoDoModelo = (m: Pick<ModeloAditivo, "tipo">): TipoModeloAditivo => m.tipo ?? "REAJUSTE";

/** Os campos de um tipo, como a API manda (por tipo ou a lista solta do reajuste), ou os conhecidos. */
export function camposDoTipo(campos: RespostaModelosAditivo["campos"] | undefined, tipo: TipoModeloAditivo): string[] {
  if (Array.isArray(campos)) return tipo === "REAJUSTE" && campos.length ? campos : tipo === "REAJUSTE" ? Object.keys(ADITIVO_CAMPOS) : Object.keys(CAMPOS_RETORNO);
  return campos?.[tipo]?.length ? campos[tipo]! : Object.keys(tipo === "REAJUSTE" ? ADITIVO_CAMPOS : CAMPOS_RETORNO);
}

/** O texto inicial de uma versão nova do reajuste: os campos que o aditivo pede, para o advogado ajustar. */
export const TEXTO_INICIAL_ADITIVO =
  "Aditivo ao contrato «contrato» do «condominio», assinado em «data_contrato».\n\n"
  + "No aniversário do contrato, em «aniversario», a mensalidade passa de «valor_atual» para «valor_novo». Motivo: «motivo_reajuste».\n\n"
  + "O valor novo vale a partir da «vale_desde». O síndico foi avisado em «aviso_em». As outras cláusulas do contrato continuam como estão.";

const TEXTOS_TIPO: Record<TipoModeloAditivo, { apoio: string; semUso: string; usar: (n: number) => string; inicial: string; tituloInicial: string }> = {
  REAJUSTE: {
    apoio: "O aditivo do reajuste anual e do fim do preço de fundador (CM-13, CM-30). O aviso ao síndico gera o aditivo da versão em uso.",
    semUso: "Sem versão em uso, o aviso de reajuste vale sozinho, sem aditivo.",
    usar: (n) => `Os próximos avisos de reajuste geram o aditivo da v${n}.`,
    inicial: TEXTO_INICIAL_ADITIVO,
    tituloInicial: "Aditivo de reajuste",
  },
  RETORNO: {
    apoio: "O aditivo de retorno ao contrato, para o cliente que volta depois do último dia (CM-31, CM-32). Reativar gera o aditivo da versão em uso.",
    semUso: "Sem versão em uso, Gerar o aditivo de retorno fica desligado em Renovações › Cancelamentos › Reativar.",
    usar: (n) => `Os próximos aditivos de retorno saem da v${n}.`,
    inicial: TEXTO_INICIAL_RETORNO,
    tituloInicial: "Aditivo de retorno ao contrato",
  },
};

function TextoComCampos({ texto }: { texto: string }) {
  return (
    <p className="t-texto whitespace-pre-wrap [overflow-wrap:anywhere]">
      {texto.split(/(«[^«»]*»)/g).map((t, n) => (t.startsWith("«") ? <span key={n} className="rounded-md bg-superficie-2 px-1 t-codigo">{t}</span> : t))}
    </p>
  );
}

export function AbaAditivo() {
  const carga = useCarregar<RespostaModelosAditivo>(ROTAS_RENOVACOES.modelos);
  const busca = useSearchParams();
  const [tipo, setTipo] = useState<TipoModeloAditivo>(busca.get("parte") === "retorno" ? "RETORNO" : "REAJUSTE");
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [janela, setJanela] = useState<{ tipo: "editar"; m: Partial<ModeloAditivo> } | { tipo: "usar"; m: ModeloAditivo } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Buscando o modelo de aditivo…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const t = TEXTOS_TIPO[tipo];
  const versoes = d.versoes.filter((x) => tipoDoModelo(x) === tipo);
  const campos = camposDoTipo(d.campos, tipo);
  const emUso = versoes.find((m) => m.situacao === "EM_USO");
  const m = versoes.find((x) => x.id === escolhida) ?? emUso ?? versoes[0];
  const pronto = (texto: string, id?: string) => { setJanela(null); setAviso(texto); if (id) setEscolhida(id); carga.recarregar(); };
  const nome = TIPOS_MODELO_ADITIVO[tipo].toLowerCase();

  return (
    <div className="grid gap-4">
      <AbasLista rotulo="Partes do aditivo" atual={tipo} aoMudar={(x) => { setTipo(x); setEscolhida(null); setAviso(null); }} abas={(Object.keys(TIPOS_MODELO_ADITIVO) as TipoModeloAditivo[]).map((x) => ({
        valor: x, texto: TIPOS_MODELO_ADITIVO[x], n: d.versoes.filter((v) => tipoDoModelo(v) === x).length,
      }))} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl t-apoio">{t.apoio}</p>
        {d.podeEditar ? (
          <Botao onClick={() => setJanela({ tipo: "editar", m: emUso ? { tipo, titulo: emUso.titulo, texto: emUso.texto } : { tipo } })}>
            <Icone nome="mais" />Cadastrar versão nova
          </Botao>
        ) : null}
      </div>
      {aviso ? <Aviso tom="ok" papel="status">{aviso}</Aviso> : null}
      {!emUso ? <Aviso tom="atencao" titulo="Sem modelo em uso">{t.semUso}</Aviso> : null}
      {!versoes.length ? (
        <Vazio titulo={`Nenhuma versão do aditivo de ${nome}`} icone="documento">Cadastre o texto do advogado, com os campos que o sistema preenche.</Vazio>
      ) : (
        <Cartao id={`aditivo-versoes-${nome}`} titulo={`Versões do aditivo de ${nome}`} icone="camadas">
          <ul className="grid">
            {versoes.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 border-t border-linha py-3 first:border-t-0">
                <b className="w-10 t-texto">{`v${x.numero}`}</b>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="t-texto">{x.titulo}</span>
                  <span className="t-apoio">{`Cadastrado${x.criadoPor ? ` por ${x.criadoPor.nome}` : ""} em ${diaHora(x.criadoEm)} · usado em ${x.aditivos} ${x.aditivos === 1 ? "aditivo" : "aditivos"}`}</span>
                </span>
                <Selo tom={TOM[x.situacao]}>{NOME_SITUACAO[x.situacao]}</Selo>
                <Botao variante="discreto" aria-pressed={m?.id === x.id} aria-label={`Ver o texto da v${x.numero} do aditivo de ${nome}`} onClick={() => setEscolhida(x.id)}><Icone nome="olho" />Ver</Botao>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {m ? (
          <Cartao id={`aditivo-texto-${nome}`} titulo={`Texto da v${m.numero}`} icone="documento">
            <div className="grid gap-3 rounded-[12px] border border-linha bg-fundo p-4">
              <p className="t-texto font-semibold">{m.titulo}</p>
              <TextoComCampos texto={m.texto} />
            </div>
            {d.podeEditar && m.situacao === "RASCUNHO" ? (
              <div className="flex flex-wrap gap-2 max-md:grid">
                <Botao variante="contorno" onClick={() => setJanela({ tipo: "editar", m })}><Icone nome="editar" />Editar o rascunho</Botao>
                <Botao onClick={() => setJanela({ tipo: "usar", m })}><Icone nome="check" />Usar esta versão</Botao>
              </div>
            ) : null}
          </Cartao>
        ) : <div className="max-lg:hidden" />}
        <div className="grid content-start gap-5">
          <Cartao id={`aditivo-campos-${nome}`} titulo="Campos que o sistema preenche" icone="lista">
            <ul className="grid gap-1.5" aria-label={`Campos do aditivo de ${nome}`}>
              {campos.map((k) => (
                <li key={k} className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-lg bg-superficie-2 px-2 py-0.5 t-codigo">{`«${k}»`}</span>
                  <span className="t-apoio">{NOMES_CAMPOS[k] ?? k}</span>
                </li>
              ))}
            </ul>
            <p className="t-apoio">Campo escrito errado ou que não existe impede salvar a versão.</p>
          </Cartao>
          {tipo === "REAJUSTE" ? (
            <Cartao id="aditivo-regra" titulo="Regra do reajuste" icone="ajuste">
              <p className="t-texto">{textoRegra(d.regra)}</p>
              <p className="t-apoio">Muda em Renovações › Regra do reajuste. As duas partes assinam o aditivo pelo gov.br na renovação; o reajuste vale pelo aviso, com ou sem as assinaturas.</p>
            </Cartao>
          ) : (
            <Cartao id="aditivo-uso-retorno" titulo="Onde é usado" icone="retorno">
              <p className="t-texto">Em Renovações › Cancelamentos › Reativar, a Administração gera o aditivo de retorno da versão em uso, com o plano da Tabela de preços do dia, sem fundador.</p>
              <p className="t-apoio">As duas partes assinam pelo gov.br. Reativar só liga com as duas assinaturas conferidas.</p>
            </Cartao>
          )}
        </div>
      </div>
      {janela?.tipo === "editar" ? <JanelaModeloAditivo m={janela.m} tipo={tipo} campos={campos} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
      {janela?.tipo === "usar" ? (
        <JanelaUsarAditivo m={janela.m} emUso={emUso} tipo={tipo} aoFechar={() => setJanela(null)}
          feito={() => pronto(`A v${janela.m.numero} do aditivo de ${nome} está em uso.`, janela.m.id)} />
      ) : null}
    </div>
  );
}

function JanelaModeloAditivo({ m, tipo, campos: lista, aoFechar, feito }: {
  m: Partial<ModeloAditivo>; tipo: TipoModeloAditivo; campos: string[]; aoFechar: () => void; feito: (texto: string, id?: string) => void;
}) {
  const t = TEXTOS_TIPO[tipo];
  const nome = TIPOS_MODELO_ADITIVO[tipo].toLowerCase();
  const [titulo, setTitulo] = useState(m.titulo ?? t.tituloInicial);
  const [texto, setTexto] = useState(m.texto ?? t.inicial);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const errados = camposErradosModelo(texto, lista);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const faltam = [...(titulo.trim().length < 3 ? ["titulo"] : []), ...(texto.trim().length < 50 || errados.length ? ["texto"] : [])];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const r = await chamarApi<ModeloAditivo>(ROTAS_RENOVACOES.modelo(m.id), { metodo: m.id ? "PUT" : "POST", corpo: { versao: m.versao ?? null, tipo, titulo: titulo.trim(), texto } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(m.id ? `Rascunho v${r.dados.numero} salvo.` : `Versão v${r.dados.numero} do aditivo de ${nome} cadastrada como rascunho.`, r.dados.id);
  }

  return (
    <Dialogo aberto titulo={m.id ? `Editar o rascunho v${m.numero}` : `Cadastrar versão nova do aditivo de ${nome}`} aoFechar={aoFechar} larga>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-apoio">{`Os campos entre « e » o sistema preenche: ${lista.map((k) => `«${k}»`).join(", ")}.`}</p>
        <CampoTexto id="aditivo-titulo" rotulo="Título" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)}
          erro={campos.includes("titulo") ? "Diga o título do aditivo." : undefined} />
        <CampoAreaTexto id="aditivo-texto-campo" rotulo="Texto do aditivo" maxLength={20_000} rows={10} value={texto} onChange={(e) => setTexto(e.target.value)}
          erro={errados.length ? `Campo escrito errado ou que não existe: ${errados.join(", ")}. Use só os campos da lista.`
            : campos.includes("texto") ? "Cole o texto do aditivo (de 50 a 20 mil letras)." : undefined} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={m.id ? "Salvar o rascunho" : "Cadastrar a versão"} />
      </form>
    </Dialogo>
  );
}

function JanelaUsarAditivo({ m, emUso, tipo, aoFechar, feito }: { m: ModeloAditivo; emUso?: ModeloAditivo; tipo: TipoModeloAditivo; aoFechar: () => void; feito: () => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const nome = TIPOS_MODELO_ADITIVO[tipo].toLowerCase();

  async function usar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_RENOVACOES.usarModelo(m.id), { corpo: { versao: m.versao } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`Usar a v${m.numero} do aditivo de ${nome}`} aoFechar={aoFechar}>
      <form onSubmit={usar} className="grid gap-4" noValidate>
        <p className="t-texto">
          {emUso ? `A v${emUso.numero}, em uso hoje, fica substituída. Os aditivos já gerados guardam a versão usada. ${TEXTOS_TIPO[tipo].usar(m.numero)}`
            : TEXTOS_TIPO[tipo].usar(m.numero)}
        </p>
        <p className="t-apoio">Depois de em uso, esta versão não se edita: mudar o texto cria a versão seguinte. A versão em uso da outra parte não muda.</p>
        {erro ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Usar esta versão" />
      </form>
    </Dialogo>
  );
}
