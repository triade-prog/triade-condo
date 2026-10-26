"use client";
// Modelos › Aditivo (0311; CM-13 e CM-30): o modelo do aditivo de reajuste, com versões como o
// contrato. Só a Administração (console.comercial.modelos) cadastra e põe em uso; o Comercial lê. O
// aviso ao síndico gera o aditivo da versão em uso, com os campos «...» preenchidos. A versão em uso
// nunca é editada: mudar o texto cria a versão seguinte; os aditivos já gerados guardam a versão.

import { useState, type FormEvent } from "react";
import { ADITIVO_CAMPOS, camposErradosAditivo, type CampoAditivo } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, Vazio, type ErroApi } from "@triade/ui";
import { Cartao, diaHora } from "../comum.tsx";
import { ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { ROTAS_RENOVACOES, textoRegra, type RegraReajusteTela } from "./renovacoes.ts";
import type { Pessoa } from "./tipos.ts";

export interface ModeloAditivo {
  id: string;
  versao: number;
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
  campos: CampoAditivo[];
  regra: RegraReajusteTela;
  podeEditar: boolean;
}

const NOME_SITUACAO = { RASCUNHO: "Rascunho guardado", EM_USO: "Em uso", SUBSTITUIDA: "Substituída" } as const;
const TOM = { RASCUNHO: "neutro", EM_USO: "ok", SUBSTITUIDA: "neutro" } as const;

/** O texto inicial de uma versão nova: os campos que o aditivo pede, para o advogado ajustar. */
export const TEXTO_INICIAL_ADITIVO =
  "Aditivo ao contrato «contrato» do «condominio», assinado em «data_contrato».\n\n"
  + "No aniversário do contrato, em «aniversario», a mensalidade passa de «valor_atual» para «valor_novo». Motivo: «motivo_reajuste».\n\n"
  + "O valor novo vale a partir da «vale_desde». O síndico foi avisado em «aviso_em». As outras cláusulas do contrato continuam como estão.";

function TextoComCampos({ texto }: { texto: string }) {
  return (
    <p className="t-texto whitespace-pre-wrap [overflow-wrap:anywhere]">
      {texto.split(/(«[^«»]*»)/g).map((t, n) => (t.startsWith("«") ? <span key={n} className="rounded-md bg-superficie-2 px-1 t-codigo">{t}</span> : t))}
    </p>
  );
}

export function AbaAditivo() {
  const carga = useCarregar<RespostaModelosAditivo>(ROTAS_RENOVACOES.modelos);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [janela, setJanela] = useState<{ tipo: "editar"; m: Partial<ModeloAditivo> } | { tipo: "usar"; m: ModeloAditivo } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Buscando o modelo de aditivo…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const emUso = d.versoes.find((m) => m.situacao === "EM_USO");
  const m = d.versoes.find((x) => x.id === escolhida) ?? emUso ?? d.versoes[0];
  const pronto = (texto: string, id?: string) => { setJanela(null); setAviso(texto); if (id) setEscolhida(id); carga.recarregar(); };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl t-apoio">O aditivo do reajuste anual e do fim do preço de fundador (CM-13, CM-30). O aviso ao síndico gera o aditivo da versão em uso.</p>
        {d.podeEditar ? (
          <Botao onClick={() => setJanela({ tipo: "editar", m: emUso ? { titulo: emUso.titulo, texto: emUso.texto } : {} })}><Icone nome="mais" />Cadastrar versão nova</Botao>
        ) : null}
      </div>
      {aviso ? <Aviso tom="ok" papel="status">{aviso}</Aviso> : null}
      {!emUso ? <Aviso tom="atencao" titulo="Sem modelo em uso">Sem versão em uso, o aviso de reajuste vale sozinho, sem aditivo.</Aviso> : null}
      {!d.versoes.length ? (
        <Vazio titulo="Nenhuma versão do aditivo" icone="documento">Cadastre o texto do aditivo, com os campos que o sistema preenche.</Vazio>
      ) : (
        <>
          <Cartao id="aditivo-versoes" titulo="Versões do aditivo" icone="camadas">
            <ul className="grid">
              {d.versoes.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-3 border-t border-linha py-3 first:border-t-0">
                  <b className="w-10 t-texto">{`v${x.numero}`}</b>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="t-texto">{x.titulo}</span>
                    <span className="t-apoio">{`Cadastrado${x.criadoPor ? ` por ${x.criadoPor.nome}` : ""} em ${diaHora(x.criadoEm)} · usado em ${x.aditivos} ${x.aditivos === 1 ? "aditivo" : "aditivos"}`}</span>
                  </span>
                  <Selo tom={TOM[x.situacao]}>{NOME_SITUACAO[x.situacao]}</Selo>
                  <Botao variante="discreto" aria-pressed={m?.id === x.id} aria-label={`Ver o texto da v${x.numero} do aditivo`} onClick={() => setEscolhida(x.id)}><Icone nome="olho" />Ver</Botao>
                </li>
              ))}
            </ul>
          </Cartao>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {m ? (
              <Cartao id="aditivo-texto" titulo={`Texto da v${m.numero}`} icone="documento">
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
            ) : null}
            <div className="grid content-start gap-5">
              <Cartao id="aditivo-campos" titulo="Campos que o sistema preenche" icone="lista">
                <ul className="grid gap-1.5" aria-label="Campos do aditivo">
                  {d.campos.map((k) => (
                    <li key={k} className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-lg bg-superficie-2 px-2 py-0.5 t-codigo">{`«${k}»`}</span>
                      <span className="t-apoio">{ADITIVO_CAMPOS[k] ?? k}</span>
                    </li>
                  ))}
                </ul>
                <p className="t-apoio">Campo escrito errado ou que não existe impede salvar a versão.</p>
              </Cartao>
              <Cartao id="aditivo-regra" titulo="Regra do reajuste" icone="ajuste">
                <p className="t-texto">{textoRegra(d.regra)}</p>
                <p className="t-apoio">Muda em Renovações › Regra do reajuste. A assinatura do aditivo pelo gov.br ainda não é pedida pelo sistema.</p>
              </Cartao>
            </div>
          </div>
        </>
      )}
      {janela?.tipo === "editar" ? <JanelaModeloAditivo m={janela.m} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
      {janela?.tipo === "usar" ? (
        <JanelaUsarAditivo m={janela.m} emUso={emUso} aoFechar={() => setJanela(null)} feito={() => pronto(`A v${janela.m.numero} do aditivo está em uso.`, janela.m.id)} />
      ) : null}
    </div>
  );
}

function JanelaModeloAditivo({ m, aoFechar, feito }: { m: Partial<ModeloAditivo>; aoFechar: () => void; feito: (texto: string, id?: string) => void }) {
  const [titulo, setTitulo] = useState(m.titulo ?? "Aditivo de reajuste");
  const [texto, setTexto] = useState(m.texto ?? TEXTO_INICIAL_ADITIVO);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const errados = camposErradosAditivo(texto);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const faltam = [...(titulo.trim().length < 3 ? ["titulo"] : []), ...(texto.trim().length < 50 || errados.length ? ["texto"] : [])];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const r = await chamarApi<ModeloAditivo>(ROTAS_RENOVACOES.modelo(m.id), { metodo: m.id ? "PUT" : "POST", corpo: { versao: m.versao ?? null, titulo: titulo.trim(), texto } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(m.id ? `Rascunho v${r.dados.numero} salvo.` : `Versão v${r.dados.numero} do aditivo cadastrada como rascunho.`, r.dados.id);
  }

  return (
    <Dialogo aberto titulo={m.id ? `Editar o rascunho v${m.numero}` : "Cadastrar versão nova do aditivo"} aoFechar={aoFechar} larga>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-apoio">{`Os campos entre « e » o sistema preenche: ${Object.keys(ADITIVO_CAMPOS).map((k) => `«${k}»`).join(", ")}.`}</p>
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

function JanelaUsarAditivo({ m, emUso, aoFechar, feito }: { m: ModeloAditivo; emUso?: ModeloAditivo; aoFechar: () => void; feito: () => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function usar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_RENOVACOES.usarModelo(m.id), { corpo: { versao: m.versao } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`Usar a v${m.numero} do aditivo`} aoFechar={aoFechar}>
      <form onSubmit={usar} className="grid gap-4" noValidate>
        <p className="t-texto">
          {emUso ? `A v${emUso.numero}, em uso hoje, fica substituída. Os aditivos já gerados guardam a versão usada; os próximos avisos geram da v${m.numero}.`
            : `Os próximos avisos de reajuste geram o aditivo da v${m.numero}.`}
        </p>
        <p className="t-apoio">Depois de em uso, esta versão não se edita: mudar o texto cria a versão seguinte.</p>
        {erro ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Usar esta versão" />
      </form>
    </Dialogo>
  );
}
