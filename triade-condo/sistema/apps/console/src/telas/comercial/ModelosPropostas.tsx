"use client";
// Modelos › Respostas prontas e Referências (quadro 344, CM-27 e CM-28). As respostas vão junto da
// proposta e do kit; só entram as revisadas e ativas, e as que chegam no banco vêm a revisar. A
// referência só existe com a autorização do síndico registrada, que ele pode retirar a qualquer
// hora: retirada, some do link e do kit na hora e não volta. Caso só com número medido na
// Plataforma, depois de pelo menos 3 meses de uso (EM-07). Só a Administração muda; o Comercial usa.

import { useState, type FormEvent } from "react";
import { ESCOPOS_REFERENCIA, TEMAS_RESPOSTA, type EscopoReferencia, type TemaResposta } from "@triade/domain";
import { Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, Interruptor, Selo, Vazio, type ErroApi } from "@triade/ui";
import { Cartao, diaHora } from "../comum.tsx";
import { EscolhaBotoes, ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { JanelaMotivo } from "./janelasPropostas.tsx";
import { diaMes, ROTAS_PROPOSTAS, type Referencia, type RespostaPronta } from "./propostas.ts";

const dataCurta = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function JanelaResposta({ r, aoFechar, feito }: { r: Partial<RespostaPronta>; aoFechar: () => void; feito: () => void }) {
  const [tema, setTema] = useState<TemaResposta>(r.tema ?? "LGPD");
  const [titulo, setTitulo] = useState(r.titulo ?? "");
  const [texto, setTexto] = useState(r.texto ?? "");
  const [revisada, setRevisada] = useState(r.revisada ?? false);
  const [ativa, setAtiva] = useState(r.ativa ?? true);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r2 = await chamarApi(ROTAS_PROPOSTAS.respostas(r.id), { metodo: r.id ? "PUT" : "POST", corpo: { versao: r.versao ?? null, tema, titulo, texto, revisada, ativa } });
    setEnviando(false);
    if (!r2.ok) return setErro(r2.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={r.id ? "Editar resposta pronta" : "Nova resposta pronta"} aoFechar={aoFechar} media
      apoio="Vai junto da proposta e do kit. Sem marcar revisada, fica a revisar e não entra nas propostas novas.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoSelecao id="resp-tema" rotulo="Tema" value={tema} onChange={(e) => setTema(e.target.value as TemaResposta)}
          opcoes={Object.entries(TEMAS_RESPOSTA).map(([valor, texto]) => ({ valor, texto }))} />
        <CampoTexto id="resp-titulo" rotulo="Título" maxLength={60} value={titulo} onChange={(e) => setTitulo(e.target.value)}
          erro={campos.includes("titulo") ? "Título com 3 letras ou mais." : undefined} />
        <CampoAreaTexto id="resp-texto" rotulo="Resposta" maxLength={3000} value={texto} onChange={(e) => setTexto(e.target.value)}
          ajuda="Só o que a TRÍADE faz hoje; o planejado fica como planejado (EM-07)." erro={campos.includes("texto") ? "Resposta com 10 letras ou mais." : undefined} />
        <Interruptor id="resp-revisada" rotulo="Revisada pela Administração" ajuda="Revisar grava quem e quando." marcado={revisada} aoMudar={setRevisada} />
        <Interruptor id="resp-ativa" rotulo="Ativa" marcado={ativa} aoMudar={setAtiva} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar a resposta" />
      </form>
    </Dialogo>
  );
}

function JanelaReferencia({ r, aoFechar, feito }: { r: Partial<Referencia>; aoFechar: () => void; feito: () => void }) {
  const [sindico, setSindico] = useState(r.sindico ?? "");
  const [condominio, setCondominio] = useState(r.condominio ?? "");
  const [unidades, setUnidades] = useState(r.unidades ? String(r.unidades) : "");
  const [escopo, setEscopo] = useState<EscopoReferencia>(r.escopo ?? "CONTATO");
  const [whatsapp, setWhatsapp] = useState(r.whatsapp ?? "");
  const [email, setEmail] = useState(r.email ?? "");
  const [autorizadoEm, setAutorizadoEm] = useState(r.autorizadoEm ?? hoje());
  const [autorizacaoTexto, setAutorizacaoTexto] = useState(r.autorizacaoTexto ?? "");
  const [casoTexto, setCasoTexto] = useState(r.caso?.texto ?? "");
  const [casoUsoDesde, setCasoUsoDesde] = useState(r.caso?.usoDesde ?? "");
  const [casoMedidoEm, setCasoMedidoEm] = useState(r.caso?.medidoEm ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const e = (c: string, t: string) => (campos.includes(c) ? t : undefined);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r2 = await chamarApi(ROTAS_PROPOSTAS.referencias(r.id), {
      metodo: r.id ? "PUT" : "POST",
      corpo: {
        versao: r.versao ?? null, sindico, condominio, unidades: unidades.trim() ? Number(unidades) : null, escopo,
        whatsapp: escopo === "CONTATO" ? whatsapp || null : null, email: escopo === "CONTATO" ? email || null : null, autorizadoEm, autorizacaoTexto,
        casoTexto: casoTexto.trim() || null, casoUsoDesde: casoUsoDesde || null, casoMedidoEm: casoMedidoEm || null,
      },
    });
    setEnviando(false);
    if (!r2.ok) return setErro(r2.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={r.id ? `Editar ${r.sindico}` : "Registrar autorização de um cliente"} aoFechar={aoFechar} larga
      apoio="Referência só com a autorização do síndico registrada. Ele pode retirar a qualquer hora.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <div className="grid gap-4 md:grid-cols-3">
          <CampoTexto id="ref-sindico" rotulo="Síndico" maxLength={80} value={sindico} onChange={(x) => setSindico(x.target.value)} erro={e("sindico", "Nome com 2 letras ou mais.")} />
          <CampoTexto id="ref-condominio" rotulo="Condomínio" maxLength={120} value={condominio} onChange={(x) => setCondominio(x.target.value)} erro={e("condominio", "Nome do condomínio.")} />
          <CampoTexto id="ref-unidades" rotulo="Unidades" opcional inputMode="numeric" maxLength={5} value={unidades} onChange={(x) => setUnidades(x.target.value.replace(/\D/g, ""))} />
        </div>
        <EscolhaBotoes nome="ref-escopo" legenda="O que ele autorizou" valor={escopo} aoMudar={setEscopo}
          opcoes={Object.entries(ESCOPOS_REFERENCIA).map(([valor, texto]) => ({ valor: valor as EscopoReferencia, texto }))}
          ajuda={escopo === "SO_NOME" ? "Só o nome e o prédio aparecem; o contato não é guardado." : "O WhatsApp ou o e-mail aparece no link e no kit."} />
        {escopo === "CONTATO" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <CampoTexto id="ref-whatsapp" rotulo="WhatsApp" inputMode="tel" maxLength={30} value={whatsapp} onChange={(x) => setWhatsapp(x.target.value)}
              erro={e("whatsapp", "Informe o WhatsApp com DDD ou o e-mail.")} />
            <CampoTexto id="ref-email" rotulo="E-mail" opcional type="email" maxLength={120} value={email} onChange={(x) => setEmail(x.target.value)} erro={e("email", "Confira o e-mail.")} />
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
          <CampoTexto id="ref-autorizado" rotulo="Autorizou em" type="date" value={autorizadoEm} disabled={!!r.id} onChange={(x) => setAutorizadoEm(x.target.value)}
            ajuda={r.id ? "A data da autorização não muda." : undefined} erro={e("autorizadoEm", "Informe a data.")} />
          <CampoTexto id="ref-autorizacao" rotulo="Como autorizou" maxLength={500} value={autorizacaoTexto} onChange={(x) => setAutorizacaoTexto(x.target.value)}
            ajuda="Por exemplo: autorizou por WhatsApp em 20/10." erro={e("autorizacaoTexto", "Diga como e onde ele autorizou, com 10 letras ou mais.")} />
        </div>
        <fieldset className="grid gap-3 border-t border-linha pt-3">
          <legend className="t-titulo-cartao">Caso medido (opcional)</legend>
          <CampoTexto id="ref-caso" rotulo="O que mudou, com o número medido na Plataforma" opcional maxLength={600} value={casoTexto} onChange={(x) => setCasoTexto(x.target.value)} />
          <div className="grid gap-4 md:grid-cols-2">
            <CampoTexto id="ref-desde" rotulo="Usa desde" type="date" opcional value={casoUsoDesde} onChange={(x) => setCasoUsoDesde(x.target.value)} />
            <CampoTexto id="ref-medido" rotulo="Medido em" type="date" opcional value={casoMedidoEm} onChange={(x) => setCasoMedidoEm(x.target.value)}
              erro={e("casoMedidoEm", "A medição vem pelo menos 3 meses depois do início de uso, com as duas datas.")} />
          </div>
        </fieldset>
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar a referência" />
      </form>
    </Dialogo>
  );
}

/** Respostas prontas: tema, o que diz, se está revisada e por quem. */
export function ListaRespostas({ respostas, podeEditar, mudou }: { respostas: RespostaPronta[]; podeEditar: boolean; mudou: () => void }) {
  const [janela, setJanela] = useState<Partial<RespostaPronta> | null>(null);
  return (
    <Cartao id="mod-respostas" titulo="Respostas prontas" icone="balao"
      acao={podeEditar ? <Botao onClick={() => setJanela({})}><Icone nome="mais" />Nova resposta</Botao> : undefined}>
      {respostas.length ? (
        <ul className="divide-y divide-linha">
          {respostas.map((r) => (
            <li key={r.id} className="grid gap-x-4 gap-y-1.5 py-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.8fr)_minmax(0,0.9fr)_auto] md:items-center">
              <span className="t-texto font-semibold">{TEMAS_RESPOSTA[r.tema] ?? r.tema}</span>
              <span className="grid gap-0.5">
                <span className="t-texto">{r.titulo}</span>
                <span className="t-apoio line-clamp-2">{r.texto}</span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {r.revisada ? <Selo tom="ok">{`Revisada ${diaMes(r.revisadaEm)}${r.revisadaPor ? ` · ${r.revisadaPor.nome}` : ""}`}</Selo> : <Selo tom="atencao">A revisar</Selo>}
                {r.ativa ? null : <Selo tom="neutro">Desligada</Selo>}
              </span>
              {podeEditar ? <Botao variante="discreto" aria-label={`Editar ${r.titulo}`} onClick={() => setJanela(r)}><Icone nome="editar" />Editar</Botao> : <span />}
            </li>
          ))}
        </ul>
      ) : <Vazio titulo="Nenhuma resposta pronta" icone="balao">A Administração escreve e revisa as respostas para questionário e cotação.</Vazio>}
      <p className="t-apoio">Vão junto da proposta e do kit. Só as revisadas e ativas entram nas propostas novas.</p>
      {janela ? <JanelaResposta r={janela} aoFechar={() => setJanela(null)} feito={() => { setJanela(null); mudou(); }} /> : null}
    </Cartao>
  );
}

type JanelaRef = { tipo: "editar"; r: Partial<Referencia> } | { tipo: "retirar"; r: Referencia } | null;

/** Referências: quem autorizou, o que autorizou e o caso medido. */
export function ListaReferencias({ referencias, podeEditar, mudou }: { referencias: Referencia[]; podeEditar: boolean; mudou: () => void }) {
  const [janela, setJanela] = useState<JanelaRef>(null);
  const pronto = () => { setJanela(null); mudou(); };
  return (
    <Cartao id="mod-referencias" titulo="Referências" icone="pessoas"
      acao={podeEditar ? <Botao variante="contorno" onClick={() => setJanela({ tipo: "editar", r: {} })}><Icone nome="mais" />Registrar autorização de um cliente</Botao> : undefined}>
      {referencias.length ? (
        <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Referências, role para o lado">
          <table className="w-full border-collapse">
            <caption className="sr-only">Referências de clientes</caption>
            <thead>
              <tr>
                {["Síndico", "Condomínio", "Autorizou", "Caso medido", ""].map((c, i) => (
                  <th key={i} scope="col" className="border-b border-linha bg-superficie-2 px-3 py-2.5 text-left t-rotulo font-semibold">{c || <span className="sr-only">Ações</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {referencias.map((r) => (
                <tr key={r.id} className={r.retirada ? "text-tinta-suave" : ""}>
                  <th scope="row" className="border-b border-linha px-3 py-2.5 text-left align-top t-texto font-medium">{r.sindico}</th>
                  <td className="border-b border-linha px-3 py-2.5 align-top t-texto">{`${r.condominio}${r.unidades ? ` · ${r.unidades} unidades` : ""}`}</td>
                  <td className="border-b border-linha px-3 py-2.5 align-top t-texto">
                    {r.retirada ? <Selo tom="neutro">{`Retirada ${diaHora(r.retirada.em)}`}</Selo> : `${ESCOPOS_REFERENCIA[r.escopo]} · ${dataCurta(r.autorizadoEm)}`}
                    <span className="block t-apoio">{r.retirada ? r.retirada.motivo : r.autorizacaoTexto}</span>
                  </td>
                  <td className="border-b border-linha px-3 py-2.5 align-top t-texto">
                    {r.caso ? <>{r.caso.texto}<span className="block t-apoio">{`Desde ${dataCurta(r.caso.usoDesde)}, medido em ${dataCurta(r.caso.medidoEm)}`}</span></> : <span className="t-apoio">[depois de 3 meses de uso]</span>}
                  </td>
                  <td className="border-b border-linha px-3 py-2.5 align-top">
                    {podeEditar && !r.retirada ? (
                      <span className="flex flex-wrap gap-1">
                        <Botao variante="discreto" aria-label={`Editar ${r.sindico}`} onClick={() => setJanela({ tipo: "editar", r })}><Icone nome="editar" />Editar</Botao>
                        <Botao variante="discreto" aria-label={`Retirar a autorização de ${r.sindico}`} onClick={() => setJanela({ tipo: "retirar", r })}><Icone nome="fechar" />Retirar</Botao>
                      </span>
                    ) : r.emUso ? <span className="t-apoio">{`Em ${r.emUso} ${r.emUso === 1 ? "proposta" : "propostas"}`}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Vazio titulo="Nenhuma referência ainda" icone="pessoas">Quando um síndico cliente aceitar ser referência, registre a autorização aqui.</Vazio>}
      <p className="t-apoio">Caso só com números medidos na Plataforma, depois de pelo menos 3 meses de uso. Sem número inventado (EM-07).</p>
      {janela?.tipo === "editar" ? <JanelaReferencia r={janela.r} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
      {janela?.tipo === "retirar" ? (
        <JanelaMotivo titulo={`Retirar a autorização de ${janela.r.sindico}`} rotulo="Motivo" botao="Retirar a autorização" maximo={300}
          apoio="A referência some do link e do kit na hora, o WhatsApp e o e-mail são apagados e não dá para desfazer. Para autorizar de novo, registre outra."
          aoFechar={() => setJanela(null)}
          aoConfirmar={async (motivo) => {
            const r = await chamarApi(ROTAS_PROPOSTAS.retirarReferencia(janela.r.id), { corpo: { versao: janela.r.versao, motivo } });
            if (!r.ok) return r.erro;
            pronto();
            return null;
          }} />
      ) : null}
    </Cartao>
  );
}
