"use client";
// As janelas do Comercial (quadros 325, 326 e 342, aprovados em 24/10/2026): novo interessado à
// mão, marcar como perdido, registrar conversa, próximo passo, editar a ficha, não contatar,
// pedido de exclusão e importar planilha. Toda gravação passa pela api-console; as regras (o que
// junta, o que cada etapa pede, quem pode) são do banco.

import { useState, type FormEvent, type ReactNode } from "react";
import {
  CAMPOS_ETAPA, CANAIS_REGISTRAVEIS, FAIXAS_PRECO, faixaDoSite, MOTIVOS_PERDA, normalizarWhatsappBr, ORIGENS_COMERCIAL, ORIGENS_MANUAIS, PAPEIS_CONTATO,
  type CodigoFaixa, type MotivoPerda,
} from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, Interruptor, type ErroApi } from "@triade/ui";
import { EscolhaBotoes, ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { plural } from "../comum.tsx";
import { nomeCanal, ROTAS_COMERCIAL } from "./comum.tsx";
import { CamposCriterios, type EscolhaCriterios } from "./janelasKit.tsx";
import type { FichaInteressado, Interessado, Pessoa } from "./tipos.ts";

const FAIXAS = Object.entries(FAIXAS_PRECO).map(([valor, f]) => ({ valor, texto: f.nome }));
const comVazio = (texto: string, opcoes: { valor: string; texto: string }[]) => [{ valor: "", texto }, ...opcoes];
const TEXTO_CONTATO = "A pessoa procurou a TRÍADE ou aceitou o contato. Registro com legítimo interesse documentado, só para responder e negociar.";
const TEXTO_OPTIN = "Aceitou receber mensagens pelo WhatsApp comercial";

/** Campo com o erro que a API devolveu: o primeiro campo recusado ganha a mensagem. */
function erroDe(campos: string[], nome: string, texto: string): string | undefined {
  return campos.includes(nome) ? texto : undefined;
}

/** Novo interessado à mão (quadro 325, CM-02). Mesmo WhatsApp, e-mail ou CNPJ junta no que já existe. */
export function JanelaNovoInteressado({ equipe, aoFechar, feito }: { equipe: Pessoa[]; aoFechar: () => void; feito: (id: string, juntado: boolean) => void }) {
  const [f, setF] = useState({ pessoa: "", whatsapp: "", email: "", condominio: "", cidade: "", uf: "", faixa: "", responsavelId: "", origem: "", origemDetalhe: "" });
  const [aceito, setAceito] = useState(false);
  const [optin, setOptin] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi<{ id: string; juntado: boolean }>(ROTAS_COMERCIAL.lista, {
      corpo: {
        ...f, faixa: f.faixa || null, responsavelId: f.responsavelId || null, uf: f.uf || null, origem: f.origem || null, contatoAceito: aceito,
        optinTexto: optin ? TEXTO_OPTIN : null,
      },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(r.dados.id, r.dados.juntado);
  }

  return (
    <Dialogo aberto titulo="Novo interessado" aoFechar={aoFechar} media
      apoio="Para quem chegou fora do site: WhatsApp comercial, Instagram, indicação, parceiro, construtora, cotação ou evento.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="novo-pessoa" rotulo="Nome da pessoa" maxLength={80} value={f.pessoa} onChange={muda("pessoa")} autoComplete="off" />
          <CampoTexto id="novo-whatsapp" rotulo="WhatsApp" type="tel" inputMode="tel" maxLength={30} value={f.whatsapp} onChange={muda("whatsapp")}
            ajuda="Se o número já existir, o sistema junta no interessado que já está aberto."
            erro={erroDe(campos, "whatsapp", "WhatsApp com DDD, do Brasil. Sem WhatsApp, informe o e-mail.")} />
          <CampoTexto id="novo-email" rotulo="E-mail" opcional type="email" maxLength={120} value={f.email} onChange={muda("email")} erro={erroDe(campos, "email", "Confira o e-mail.")} />
          <CampoTexto id="novo-condominio" rotulo="Condomínio" maxLength={120} value={f.condominio} onChange={muda("condominio")}
            erro={erroDe(campos, "condominio", "Escreva o nome do condomínio.")} />
          <CampoTexto id="novo-cidade" rotulo="Cidade" opcional maxLength={80} value={f.cidade} onChange={muda("cidade")} />
          <CampoTexto id="novo-uf" rotulo="UF" opcional maxLength={2} value={f.uf} onChange={muda("uf")} erro={erroDe(campos, "uf", "Duas letras, como DF.")} />
          <CampoSelecao id="novo-faixa" rotulo="Faixa de unidades" opcional value={f.faixa} onChange={muda("faixa")} opcoes={comVazio("Ainda não sei", FAIXAS)} />
          <CampoSelecao id="novo-responsavel" rotulo="Responsável" opcional value={f.responsavelId} onChange={muda("responsavelId")}
            opcoes={comVazio("Sem responsável", equipe.map((p) => ({ valor: p.id, texto: p.nome })))} erro={erroDe(campos, "responsavelId", "Escolha alguém do Comercial.")} />
        </div>
        <EscolhaBotoes nome="novo-origem" legenda="Por onde chegou" valor={f.origem || null} aoMudar={(v) => setF((x) => ({ ...x, origem: v }))}
          opcoes={ORIGENS_MANUAIS.map((o) => ({ valor: o, texto: ORIGENS_COMERCIAL[o] }))}
          ajuda={campos.includes("origem") ? <span className="text-erro">Escolha por onde a pessoa chegou.</span> : undefined} />
        <CampoTexto id="novo-detalhe" rotulo={f.origem === "COTACAO" ? "Qual plataforma de cotação" : "Quem indicou ou observação"} opcional maxLength={200}
          value={f.origemDetalhe} onChange={muda("origemDetalhe")} ajuda={f.origem === "COTACAO" ? "Cotação tem 24 horas para o primeiro retorno." : undefined} />
        <Interruptor id="novo-aceito" rotulo="A pessoa procurou a TRÍADE ou aceitou o contato" ajuda={TEXTO_CONTATO} marcado={aceito} aoMudar={setAceito} />
        {campos.includes("contatoAceito") ? <span className="t-apoio text-erro">Sem isso o interessado não entra.</span> : null}
        <Interruptor id="novo-optin" rotulo="Aceitou receber mensagens pelo WhatsApp"
          ajuda="Guarda data, canal e o texto que a pessoa viu. Sem isso, os botões de mensagem pronta ficam desligados." marcado={optin} aoMudar={setOptin} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <p className="t-apoio">Entra como Novo, com o primeiro retorno contado a partir de agora.</p>
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Registrar interessado" icone="mais" />
      </form>
    </Dialogo>
  );
}

/** Marcar como perdido (quadro 326): o motivo é obrigatório e alimenta o painel. */
export function JanelaPerdido({ i, aoFechar, feito }: { i: FichaInteressado; aoFechar: () => void; feito: () => void }) {
  const [motivo, setMotivo] = useState<MotivoPerda | null>(null);
  const [vencedor, setVencedor] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [retomar, setRetomar] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_COMERCIAL.etapa(i.id), {
      corpo: { versao: i.versao, etapa: "PERDIDO", motivoPerda: motivo, vencedor: vencedor || null, detalhe: detalhe || null, retomarEm: retomar || null },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }
  const semMotivo = camposComErro(erro).includes("motivoPerda");

  return (
    <Dialogo aberto titulo={`Marcar ${i.condominio} como perdido`} aoFechar={aoFechar} media apoio="O motivo alimenta o painel comercial.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <EscolhaBotoes nome="perdido-motivo" legenda="Por que não fechou (obrigatório)" valor={motivo} aoMudar={setMotivo}
          opcoes={Object.entries(MOTIVOS_PERDA).map(([valor, texto]) => ({ valor: valor as MotivoPerda, texto }))}
          ajuda={semMotivo ? <span className="text-erro">Escolha o motivo.</span> : undefined} />
        <CampoSelecao id="perdido-vencedor" rotulo="Quem ganhou" opcional value={vencedor} onChange={(e) => setVencedor(e.target.value)}
          opcoes={comVazio("Ninguém ainda", i.concorrentes.map((c) => ({ valor: c.nome, texto: c.nome })))}
          ajuda="Lista dos concorrentes da ficha; alimenta a taxa de vitória por concorrente." />
        <CampoAreaTexto id="perdido-detalhe" rotulo="O que aconteceu" opcional maxLength={500} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} />
        <CampoTexto id="perdido-retomar" rotulo="Voltar a falar em" opcional type="date" value={retomar} onChange={(e) => setRetomar(e.target.value)}
          ajuda="Opcional. A data fica na ficha para retomar a conversa." />
        <p className="t-apoio">Perdido continua consultável. Depois de 12 meses sem conversa, nome e WhatsApp são apagados e ficam só os números do funil.</p>
        {erro && !semMotivo ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Marcar como perdido" icone="fechar" perigo />
      </form>
    </Dialogo>
  );
}

/** Registrar conversa (CM-05). Com a mensagem pronta, a conversa já vem com o texto que foi para o WhatsApp. */
export function JanelaConversa({ i, inicial, aoFechar, feito }: {
  i: Pick<Interessado, "id" | "condominio">; inicial?: { canal?: string; resumo?: string; mensagemId?: string }; aoFechar: () => void; feito: () => void;
}) {
  const [canal, setCanal] = useState(inicial?.canal ?? "");
  const [resumo, setResumo] = useState(inicial?.resumo ?? "");
  const [respondeu, setRespondeu] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_COMERCIAL.conversas(i.id), { corpo: { canal: canal || null, resumo, respondeu, mensagemId: inicial?.mensagemId ?? null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo="Registrar conversa" aoFechar={aoFechar} media apoio={`${i.condominio}. Nada se apaga das conversas; corrigir é registrar outra.`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoSelecao id="conversa-canal" rotulo="Como foi" value={canal} onChange={(e) => setCanal(e.target.value)}
          opcoes={comVazio("Escolha", CANAIS_REGISTRAVEIS.map((c) => ({ valor: c, texto: nomeCanal(c) })))} erro={erroDe(campos, "canal", "Escolha como foi a conversa.")} />
        <CampoAreaTexto id="conversa-resumo" rotulo="O que conversaram" maxLength={2000} value={resumo} onChange={(e) => setResumo(e.target.value)}
          erro={erroDe(campos, "resumo", "Escreva um resumo da conversa.")} />
        <Interruptor id="conversa-respondeu" rotulo="A pessoa respondeu" ajuda="Para a cadência: ninguém insiste com quem já respondeu." marcado={respondeu} aoMudar={setRespondeu} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Registrar conversa" icone="balao" />
      </form>
    </Dialogo>
  );
}

/** Próximo passo, data e responsável (CM-04). Texto vazio tira o próximo passo. */
export function JanelaProximoPasso({ i, equipe, aoFechar, feito }: {
  i: Pick<Interessado, "id" | "versao" | "condominio" | "proximoPasso" | "responsavel">; equipe: Pessoa[]; aoFechar: () => void; feito: () => void;
}) {
  const [texto, setTexto] = useState(i.proximoPasso?.texto ?? "");
  const [data, setData] = useState(i.proximoPasso?.data ?? "");
  const [hora, setHora] = useState(i.proximoPasso?.hora ?? "");
  const [resp, setResp] = useState(i.responsavel?.id ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_COMERCIAL.proximoPasso(i.id), { metodo: "PUT", corpo: { versao: i.versao, texto, data: data || null, hora: hora || null, responsavelId: resp || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo="Próximo passo" aoFechar={aoFechar} media apoio={i.condominio}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoTexto id="passo-texto" rotulo="O que fazer" maxLength={200} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Ligar de novo, mandar a proposta, confirmar a assembleia" />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="passo-data" rotulo="Quando" type="date" value={data} onChange={(e) => setData(e.target.value)} erro={erroDe(campos, "data", "Escolha a data.")} />
          <CampoTexto id="passo-hora" rotulo="Hora" opcional type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        <CampoSelecao id="passo-responsavel" rotulo="Com quem" value={resp} onChange={(e) => setResp(e.target.value)}
          opcoes={comVazio("Sem responsável", equipe.map((p) => ({ valor: p.id, texto: p.nome })))} erro={erroDe(campos, "responsavelId", "Escolha alguém do Comercial.")} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar o próximo passo" icone="calendario" />
      </form>
    </Dialogo>
  );
}

const NOMES_CAMPOS: Record<string, string> = { ...CAMPOS_ETAPA, whatsapp: "WhatsApp", email: "E-mail", cnpj: "CNPJ", condominio: "Condomínio", objecoes: "Objeções",
  concorrentes: "Concorrentes", uf: "UF" };

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-t border-linha pt-4 first:border-t-0 first:pt-0">
      <legend className="t-titulo-cartao">{titulo}</legend>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

const paraLocal = (iso?: string) => {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso));
  return p.replace(" ", "T");
};
const deLocal = (v: string) => (v ? `${v}:00-03:00` : null);

/** Editar a ficha: contato, prédio, objeções e concorrentes (CM-16, CM-17). Os campos que a etapa pede vêm marcados. */
export function JanelaFicha({ i, marcar = [], aoFechar, feito }: { i: FichaInteressado; marcar?: string[]; aoFechar: () => void; feito: () => void }) {
  const p = i.predio;
  const [f, setF] = useState({
    pessoa: i.pessoa ?? "", papel: i.papel ?? "", whatsapp: i.whatsapp ?? "", email: i.email ?? "", condominio: i.condominio, cnpj: i.cnpj ?? "",
    endereco: i.endereco ?? "", cidade: i.cidade ?? "", uf: i.uf ?? "", faixa: i.faixa ?? "", unidades: i.unidades ? String(i.unidades) : "",
    responsavelId: i.responsavel?.id ?? "", administradora: p.administradora ?? "", sistemaAtual: p.sistemaAtual ?? "", fidelidadeAte: p.fidelidadeAte ?? "",
    assembleiaOrdinaria: p.assembleiaOrdinaria ?? "", mandatoAte: p.mandatoAte ?? "", decisor: p.decisor ?? "", decisaoEm: p.decisaoEm ?? "",
    visitaEm: p.visitaEm ?? "", visitaNota: p.visitaNota ?? "", demonstracaoEm: paraLocal(p.demonstracaoEm), observacao: i.observacao ?? "",
  });
  const [appAdm, setAppAdm] = useState(!!p.appAdministradora);
  const [optin, setOptin] = useState(!!i.optin);
  const [objecoes, setObjecoes] = useState<string[]>(i.objecoes);
  const [criterios, setCriterios] = useState<EscolhaCriterios>({ criterios: p.criterios ?? [], criterioOutro: p.criterioOutro ?? "", problema: p.problema ?? "" });
  const [concorrentes, setConcorrentes] = useState(i.concorrentes.map((c) => ({ nome: c.nome, preco: c.preco ? (c.preco / 100).toFixed(2).replace(".", ",") : "" })));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = [...camposComErro(erro), ...marcar];
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));
  const pede = (k: string) => (campos.includes(k) ? `Preencha: ${NOMES_CAMPOS[k] ?? k}.` : undefined);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const unidades = f.unidades.trim() ? Number(f.unidades) : null;
    setEnviando(true);
    const r = await chamarApi(ROTAS_COMERCIAL.interessado(i.id), {
      metodo: "PUT",
      corpo: {
        versao: i.versao, ...f, papel: f.papel || null, faixa: f.faixa || null, unidades, responsavelId: f.responsavelId || null, uf: f.uf || null,
        appAdministradora: f.administradora ? appAdm : null, demonstracaoEm: deLocal(f.demonstracaoEm), objecoes,
        criterios: criterios.criterios, criterioOutro: criterios.criterios.includes("OUTRO") ? criterios.criterioOutro.trim() || null : null,
        problema: criterios.problema.trim() || null,
        concorrentes: concorrentes.filter((c) => c.nome.trim()).map((c) => ({
          nome: c.nome.trim(), preco: c.preco.trim() ? Math.round(Number(c.preco.replace(/\./g, "").replace(",", ".")) * 100) || null : null,
        })),
        optinTexto: optin ? i.optin?.texto ?? TEXTO_OPTIN : null, optinCanal: optin ? i.optin?.canal ?? "WHATSAPP" : null,
      },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`Editar ${i.condominio}`} aoFechar={aoFechar} larga>
      <form onSubmit={salvar} className="grid gap-5" noValidate>
        {marcar.length ? <Aviso tom="atencao">{`Para a próxima etapa falta: ${marcar.map((k) => NOMES_CAMPOS[k] ?? k).join(", ")}.`}</Aviso> : null}
        <Secao titulo="Contato">
          <CampoTexto id="ficha-pessoa" rotulo="Nome da pessoa" opcional maxLength={80} value={f.pessoa} onChange={muda("pessoa")} />
          <CampoSelecao id="ficha-papel" rotulo="Papel" opcional value={f.papel} onChange={muda("papel")} opcoes={comVazio("Não informado",
            Object.entries(PAPEIS_CONTATO).map(([valor, texto]) => ({ valor, texto })))} />
          <CampoTexto id="ficha-whatsapp" rotulo="WhatsApp" type="tel" maxLength={30} value={f.whatsapp} onChange={muda("whatsapp")}
            erro={erroDe(campos, "whatsapp", erro?.detalhes?.motivo === "DUPLICADO" ? "Este número já é de outro interessado." : "WhatsApp com DDD, do Brasil.")} />
          <CampoTexto id="ficha-email" rotulo="E-mail" opcional type="email" maxLength={120} value={f.email} onChange={muda("email")}
            erro={erroDe(campos, "email", erro?.detalhes?.motivo === "DUPLICADO" ? "Este e-mail já é de outro interessado." : "Confira o e-mail.")} />
          <CampoSelecao id="ficha-responsavel" rotulo="Responsável" opcional value={f.responsavelId} onChange={muda("responsavelId")}
            opcoes={comVazio("Sem responsável", i.equipe.map((x) => ({ valor: x.id, texto: x.nome })))} erro={erroDe(campos, "responsavelId", "Escolha alguém do Comercial.")} />
          <div className="md:col-span-2">
            <Interruptor id="ficha-optin" rotulo="Aceitou receber mensagens pelo WhatsApp" marcado={optin} aoMudar={setOptin}
              ajuda={i.optin ? "Desligar apaga a data, o canal e o texto do aceite." : "Guarda a data, o canal e o texto do aceite."} />
          </div>
        </Secao>
        <Secao titulo="Prédio">
          <CampoTexto id="ficha-condominio" rotulo="Condomínio" maxLength={120} value={f.condominio} onChange={muda("condominio")} erro={erroDe(campos, "condominio", "Escreva o nome.")} />
          <CampoTexto id="ficha-cnpj" rotulo="CNPJ" opcional maxLength={20} value={f.cnpj} onChange={muda("cnpj")}
            erro={erroDe(campos, "cnpj", erro?.detalhes?.motivo === "DUPLICADO" ? "Este CNPJ já é de outro interessado." : "CNPJ com 14 dígitos.")} />
          <CampoTexto id="ficha-endereco" rotulo="Endereço" opcional maxLength={200} value={f.endereco} onChange={muda("endereco")} />
          <CampoTexto id="ficha-cidade" rotulo="Cidade" opcional maxLength={80} value={f.cidade} onChange={muda("cidade")} />
          <CampoTexto id="ficha-uf" rotulo="UF" opcional maxLength={2} value={f.uf} onChange={muda("uf")} />
          <CampoSelecao id="ficha-faixa" rotulo="Faixa de unidades" opcional value={f.faixa} onChange={muda("faixa")} opcoes={comVazio("Ainda não sei", FAIXAS)} erro={pede("faixa")} />
          <CampoTexto id="ficha-unidades" rotulo="Unidades informadas" opcional inputMode="numeric" maxLength={5} value={f.unidades} onChange={muda("unidades")}
            erro={erroDe(campos, "unidades", "Só o número de unidades.")} />
          <CampoTexto id="ficha-administradora" rotulo="Administradora" opcional maxLength={120} value={f.administradora} onChange={muda("administradora")} />
          {f.administradora ? <Interruptor id="ficha-app-adm" rotulo="A administradora tem app próprio" marcado={appAdm} aoMudar={setAppAdm} /> : null}
          <CampoTexto id="ficha-sistema" rotulo="Sistema atual" opcional maxLength={120} value={f.sistemaAtual} onChange={muda("sistemaAtual")} placeholder="Planilha e grupo de WhatsApp" />
          <CampoTexto id="ficha-fidelidade" rotulo="Fidelidade do sistema atual até" opcional type="date" value={f.fidelidadeAte} onChange={muda("fidelidadeAte")} />
          <CampoTexto id="ficha-ago" rotulo="Assembleia ordinária" opcional type="date" value={f.assembleiaOrdinaria} onChange={muda("assembleiaOrdinaria")} />
          <CampoTexto id="ficha-mandato" rotulo="Mandato do síndico até" opcional type="date" value={f.mandatoAte} onChange={muda("mandatoAte")} />
          <CampoTexto id="ficha-decisor" rotulo="Quem decide" opcional maxLength={300} value={f.decisor} onChange={muda("decisor")} erro={pede("decisor")}
            placeholder="O síndico leva ao conselho; acima de 12 meses vai à assembleia" />
          <CampoTexto id="ficha-decisao" rotulo="Reunião do conselho ou assembleia" opcional type="date" value={f.decisaoEm} onChange={muda("decisaoEm")} erro={pede("decisaoEm")} />
          <CampoTexto id="ficha-demo" rotulo="Demonstração" opcional type="datetime-local" value={f.demonstracaoEm} onChange={muda("demonstracaoEm")} erro={pede("demonstracaoEm")} />
          <CampoTexto id="ficha-visita" rotulo="Visita ao prédio" opcional type="date" value={f.visitaEm} onChange={muda("visitaEm")} />
          <CampoTexto id="ficha-visita-nota" rotulo="O que viu na visita" opcional maxLength={500} value={f.visitaNota} onChange={muda("visitaNota")} className="md:col-span-2" />
        </Secao>
        <fieldset className="grid gap-3 border-t border-linha pt-4">
          <legend className="t-titulo-cartao">Critérios do síndico e o problema do prédio</legend>
          <CamposCriterios id="ficha-criterios" valor={criterios} aoMudar={setCriterios} campos={campos} />
        </fieldset>
        <fieldset className="grid gap-3 border-t border-linha pt-4">
          <legend className="t-titulo-cartao">Objeções</legend>
          <div className="flex flex-wrap gap-2">
            {i.objecoesLista.map((o) => (
              <label key={o.codigo} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-linha px-4 has-checked:border-violeta-600 has-checked:bg-violeta-50 has-checked:font-semibold">
                <input type="checkbox" className="sr-only" checked={objecoes.includes(o.codigo)}
                  onChange={(e) => setObjecoes((v) => (e.target.checked ? [...v, o.codigo] : v.filter((x) => x !== o.codigo)))} />
                {o.texto}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-3 border-t border-linha pt-4">
          <legend className="t-titulo-cartao">Concorrentes na disputa</legend>
          {concorrentes.map((c, n) => (
            <div key={n} className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
              <CampoTexto id={`ficha-conc-${n}`} rotulo="Concorrente" maxLength={80} value={c.nome}
                onChange={(e) => setConcorrentes((v) => v.map((x, k) => (k === n ? { ...x, nome: e.target.value } : x)))} />
              <CampoTexto id={`ficha-conc-preco-${n}`} rotulo="Preço por mês (R$)" opcional inputMode="decimal" maxLength={12} value={c.preco}
                onChange={(e) => setConcorrentes((v) => v.map((x, k) => (k === n ? { ...x, preco: e.target.value } : x)))} />
              <Botao variante="discreto" onClick={() => setConcorrentes((v) => v.filter((_, k) => k !== n))} aria-label={`Tirar ${c.nome || "o concorrente"}`}>
                <Icone nome="fechar" />Tirar
              </Botao>
            </div>
          ))}
          {concorrentes.length < 10 ? (
            <Botao variante="contorno" className="justify-self-start" onClick={() => setConcorrentes((v) => [...v, { nome: "", preco: "" }])}><Icone nome="mais" />Concorrente</Botao>
          ) : null}
          {campos.includes("concorrentes") ? <span className="t-apoio text-erro">Confira os concorrentes: nome com 2 letras ou mais e preço em reais.</span> : null}
        </fieldset>
        <CampoAreaTexto id="ficha-observacao" rotulo="Observação" opcional maxLength={1000} value={f.observacao} onChange={muda("observacao")} />
        {erro && !camposComErro(erro).length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar a ficha" />
      </form>
    </Dialogo>
  );
}

/** Confirmar uma ação que não volta: não contatar (Comercial) ou pedido de exclusão (Administração). */
export function JanelaConfirmar({ titulo, texto, botao, aoConfirmar, aoFechar }: {
  titulo: string; texto: ReactNode; botao: string; aoConfirmar: () => Promise<ErroApi | null>; aoFechar: () => void;
}) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function confirmar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const e = await aoConfirmar();
    setEnviando(false);
    if (e) setErro(e);
  }
  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar} media>
      <form onSubmit={confirmar} className="grid gap-4">
        <div className="t-texto">{texto}</div>
        {erro ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={botao} icone="alerta" perigo />
      </form>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------------------
// Planilha (quadro 342, CM-24).

interface LinhaLida {
  linha: number;
  condominio: string;
  cnpj?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  unidades?: number | null;
  faixa?: CodigoFaixa | null;
  pessoa?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  decisao?: "JUNTAR" | "CRIAR";
}

const COLUNAS_ACEITAS: Record<string, keyof LinhaLida> = {
  condominio: "condominio", predio: "condominio", nome: "condominio", cnpj: "cnpj", endereco: "endereco", cidade: "cidade", uf: "uf", estado: "uf",
  unidades: "unidades", pessoa: "pessoa", contato: "pessoa", sindico: "pessoa", whatsapp: "whatsapp", telefone: "whatsapp", celular: "whatsapp",
  email: "email",
};
const simples = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z]/g, "");

/** Lê um CSV (vírgula ou ponto e vírgula, com aspas) ou o texto colado da planilha (tabulação). */
export function lerPlanilha(texto: string): { colunas: { de: string; para: keyof LinhaLida | null }[]; linhas: LinhaLida[]; descartadas: number[] } {
  const linhasCruas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const cab = linhasCruas[0] ?? "";
  const sep = cab.includes("\t") ? "\t" : (cab.split(";").length > cab.split(",").length ? ";" : ",");
  const partir = (l: string) => {
    const out: string[] = [];
    let atual = "", aspas = false;
    for (let k = 0; k < l.length; k++) {
      const ch = l[k]!;
      if (ch === '"') { if (aspas && l[k + 1] === '"') { atual += '"'; k++; } else aspas = !aspas; } else if (ch === sep && !aspas) { out.push(atual); atual = ""; } else atual += ch;
    }
    out.push(atual);
    return out.map((x) => x.trim());
  };
  const nomes = partir(cab);
  const colunas = nomes.map((de) => ({ de, para: COLUNAS_ACEITAS[simples(de)] ?? null }));
  const linhas: LinhaLida[] = [];
  const descartadas: number[] = [];
  linhasCruas.slice(1).forEach((l, n) => {
    const v = partir(l);
    const o: Record<string, string> = {};
    colunas.forEach((c, k) => { if (c.para && v[k]) o[c.para] = v[k]!; });
    const linha = n + 2;
    if (!o.condominio || o.condominio.length < 2) return void descartadas.push(linha);
    const unidades = o.unidades && /^\d{1,5}$/.test(o.unidades) ? Number(o.unidades) : null;
    const cnpj = o.cnpj?.replace(/\D/g, "");
    linhas.push({
      linha, condominio: o.condominio.slice(0, 120), cnpj: cnpj && cnpj.length === 14 ? cnpj : null, endereco: o.endereco?.slice(0, 200) || null,
      cidade: o.cidade?.slice(0, 80) || null, uf: o.uf && /^[A-Za-z]{2}$/.test(o.uf) ? o.uf.toUpperCase() : null, unidades,
      faixa: unidades ? faixaDoSite(unidades <= 40 ? "Até 40" : unidades <= 100 ? "41 a 100" : unidades <= 200 ? "101 a 200" : unidades <= 400 ? "201 a 400" : "400") : null,
      pessoa: o.pessoa?.slice(0, 80) || null, whatsapp: o.whatsapp ? normalizarWhatsappBr(o.whatsapp) : null,
      email: o.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.email) ? o.email.toLowerCase() : null,
    });
  });
  return { colunas, linhas: linhas.slice(0, 2000), descartadas };
}

interface Previa {
  linhas: number;
  novas: number;
  parecidas: { linha: number; condominio: string; interessadoId: string; interessado: string; campo: string }[];
  bloqueados: { linha: number; condominio: string }[];
}
/** A planilha-modelo (CM-24): as colunas aceitas e uma linha de exemplo. */
function baixarModelo() {
  const csv = "condominio;cnpj;endereco;cidade;uf;unidades;pessoa;whatsapp;email\r\nResidencial Exemplo;;SQS 308 bloco C;Brasília;DF;48;Ana Souza;(61) 99999-0000;ana@exemplo.com.br\r\n";
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "planilha-modelo-interessados.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const NOME_CAMPO: Record<string, string> = { WHATSAPP: "mesmo WhatsApp", CNPJ: "mesmo CNPJ", EMAIL: "mesmo e-mail", ENDERECO: "mesmo endereço" };

export function JanelaImportar({ aoFechar, feito }: { aoFechar: () => void; feito: (texto: string) => void }) {
  const [passo, setPasso] = useState<1 | 2 | 3 | 4>(1);
  const [arquivo, setArquivo] = useState("");
  const [lido, setLido] = useState<ReturnType<typeof lerPlanilha> | null>(null);
  const [origem, setOrigem] = useState("");
  const [base, setBase] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [decisoes, setDecisoes] = useState<Record<number, "JUNTAR" | "CRIAR">>({});
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const corpo = (confirmar: boolean) => ({
    arquivo: arquivo || "planilha", origemTexto: origem, baseLegalTexto: base, confirmar,
    linhas: (lido?.linhas ?? []).map((l) => ({ ...l, decisao: decisoes[l.linha] })),
  });

  async function abrir(f: File | undefined) {
    if (!f) return;
    setArquivo(f.name);
    setLido(lerPlanilha(await f.text()));
  }

  async function conferir(ev: FormEvent) {
    ev.preventDefault();
    if (!lido?.linhas.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["linhas"] } });
    setEnviando(true);
    const r = await chamarApi<Previa>(ROTAS_COMERCIAL.importar, { corpo: corpo(false) });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setErro(null);
    setPrevia(r.dados);
    setPasso(r.dados.parecidas.length ? 3 : 4);
  }

  async function importar() {
    setEnviando(true);
    const r = await chamarApi<{ criados: number; juntados: number; bloqueados: unknown[] }>(ROTAS_COMERCIAL.importar, { corpo: corpo(true) });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(`Planilha importada: ${plural(r.dados.criados, "interessado novo", "interessados novos")}, ${plural(r.dados.juntados, "juntado", "juntados")}` +
      `${r.dados.bloqueados.length ? `, ${plural(r.dados.bloqueados.length, "fora pela lista de não contatar", "fora pela lista de não contatar")}` : ""}.`);
  }

  const faltaDecidir = (previa?.parecidas ?? []).filter((p) => !decisoes[p.linha]).length;
  const etapas = ["Arquivo", "Colunas", "Duplicados", "Conferir"];

  return (
    <Dialogo aberto titulo="Importar planilha" aoFechar={aoFechar} larga apoio="Lista de prédios ou contatos para o funil, sem duplicar.">
      <ol className="flex flex-wrap gap-2" aria-label="Passos da importação">
        {etapas.map((e, n) => (
          <li key={e} aria-current={passo === n + 1 ? "step" : undefined}
            className={`rounded-full border px-3 py-1 t-apoio ${passo === n + 1 ? "border-violeta-600 bg-violeta-50 font-semibold text-violeta-700" : "border-linha"}`}>
            {n + 1} {e}
          </li>
        ))}
      </ol>
      {passo === 1 ? (
        <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); if (lido?.linhas.length) setPasso(2); else setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["linhas"] } }); }}>
          <label className="grid gap-1">
            <span className="t-apoio font-medium">Planilha em CSV</span>
            <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void abrir(e.target.files?.[0])} className="t-texto" aria-describedby="importar-ajuda" />
            <span id="importar-ajuda" className="t-apoio text-tinta-suave">
              No Excel ou no Google Planilhas, salve como CSV. Colunas aceitas: condomínio, CNPJ, endereço, cidade, UF, unidades, pessoa, WhatsApp, e-mail.
            </span>
          </label>
          <Botao variante="discreto" className="justify-self-start" onClick={baixarModelo}><Icone nome="baixar" />Baixar a planilha-modelo</Botao>
          {lido ? <p className="t-apoio">{`${arquivo} · ${plural(lido.linhas.length, "linha", "linhas")}${lido.descartadas.length ? ` · ${plural(lido.descartadas.length, "linha sem condomínio fica fora", "linhas sem condomínio ficam fora")}` : ""}`}</p> : null}
          <CampoTexto id="importar-origem" rotulo="Origem do lote" maxLength={200} value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Lista de prédios do Guará e Taguatinga"
            erro={erroDe(campos, "origemTexto", "Diga de onde veio a lista.")} />
          <CampoAreaTexto id="importar-base" rotulo="Base legal: teste de legítimo interesse" maxLength={1000} value={base} onChange={(e) => setBase(e.target.value)}
            placeholder="Por que é legítimo contatar estes prédios, com que dados e como a pessoa pode sair da lista."
            ajuda="O texto fica guardado com o lote." erro={erroDe(campos, "baseLegalTexto", "Escreva o teste, com pelo menos 10 letras.")} />
          {campos.includes("linhas") ? <Aviso tom="erro" papel="alert">Escolha uma planilha com pelo menos uma linha com o nome do condomínio.</Aviso> : null}
          <div className="flex flex-wrap justify-end gap-2 max-md:grid">
            <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
            <Botao type="submit"><Icone nome="dir" />Ver as colunas</Botao>
          </div>
        </form>
      ) : null}
      {passo === 2 && lido ? (
        <form className="grid gap-4" noValidate onSubmit={conferir}>
          <ul className="grid gap-1.5" aria-label="Colunas da planilha">
            {lido.colunas.map((c) => (
              <li key={c.de} className="flex flex-wrap items-center gap-2 t-texto">
                <span className="t-codigo">{c.de || "(sem nome)"}</span><Icone nome="dir" className="h-4 w-4 text-tinta-suave" />
                <span className={c.para ? "" : "text-tinta-suave"}>{c.para ? NOMES_COLUNA[c.para] : "Não entra"}</span>
              </li>
            ))}
          </ul>
          <p className="t-apoio">Quem está na lista de não contatar não entra. WhatsApp sem DDD ou de fora do Brasil fica de fora da linha.</p>
          {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
          {campos.length ? <Aviso tom="erro" papel="alert">Volte ao começo e confira a origem e a base legal.</Aviso> : null}
          <div className="flex flex-wrap justify-end gap-2 max-md:grid">
            <Botao variante="discreto" onClick={() => setPasso(1)}>Voltar</Botao>
            <Botao type="submit" disabled={enviando}><Icone nome="busca" />{enviando ? "Conferindo…" : "Procurar duplicados"}</Botao>
          </div>
        </form>
      ) : null}
      {passo === 3 && previa ? (
        <div className="grid gap-4">
          <p className="t-texto">{`${arquivo} · ${plural(previa.linhas, "linha", "linhas")} · ${previa.novas} novas e ${plural(previa.parecidas.length, "parecida", "parecidas")} com interessados que já existem.`}</p>
          <ul className="grid gap-3">
            {previa.parecidas.map((p) => (
              <li key={p.linha} className="grid gap-2 rounded-[14px] border border-linha p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                <span className="grid"><span className="font-medium">{p.condominio}</span><span className="t-apoio">{`linha ${p.linha} da planilha`}</span></span>
                <span className="grid"><span className="font-medium">{p.interessado}</span><span className="t-apoio">{NOME_CAMPO[p.campo] ?? p.campo}</span></span>
                <fieldset className="flex gap-2">
                  <legend className="sr-only">{`O que fazer com a linha ${p.linha}`}</legend>
                  {(["JUNTAR", "CRIAR"] as const).map((d) => (
                    <label key={d} className="flex min-h-11 cursor-pointer items-center rounded-full border border-linha px-4 has-checked:border-violeta-600 has-checked:bg-violeta-50 has-checked:font-semibold">
                      <input type="radio" className="sr-only" name={`decisao-${p.linha}`} checked={decisoes[p.linha] === d} onChange={() => setDecisoes((v) => ({ ...v, [p.linha]: d }))} />
                      {d === "JUNTAR" ? "Juntar" : "Criar novo"}
                    </label>
                  ))}
                </fieldset>
              </li>
            ))}
          </ul>
          <p className="t-apoio">{faltaDecidir ? `Nada entra até você decidir ${plural(faltaDecidir, "o parecido", "os parecidos")}.` : "Tudo decidido."}</p>
          <div className="flex flex-wrap justify-end gap-2 max-md:grid">
            <Botao variante="discreto" onClick={() => setPasso(2)}>Voltar</Botao>
            <Botao disabled={faltaDecidir > 0} onClick={() => setPasso(4)}><Icone nome="dir" />Conferir</Botao>
          </div>
        </div>
      ) : null}
      {passo === 4 && previa ? (
        <div className="grid gap-4">
          <ul className="grid gap-1 t-texto">
            <li>{plural(previa.novas + Object.values(decisoes).filter((d) => d === "CRIAR").length, "interessado novo", "interessados novos")}</li>
            <li>{plural(Object.values(decisoes).filter((d) => d === "JUNTAR").length, "linha juntada no interessado que já existe", "linhas juntadas nos interessados que já existem")}</li>
            {previa.bloqueados.length ? <li>{plural(previa.bloqueados.length, "linha fica fora pela lista de não contatar", "linhas ficam fora pela lista de não contatar")}</li> : null}
          </ul>
          <p className="t-apoio">{`Origem do lote: ${origem}. Base legal: legítimo interesse documentado. Entram como Novo, origem Planilha, sem primeiro retorno marcado.`}</p>
          {erro ? <ErroJanela erro={erro} /> : null}
          <div className="flex flex-wrap justify-end gap-2 max-md:grid">
            <Botao variante="discreto" onClick={() => setPasso(previa.parecidas.length ? 3 : 2)}>Voltar</Botao>
            <Botao disabled={enviando} onClick={() => void importar()}><Icone nome="check" />{enviando ? "Importando…" : "Conferir e importar"}</Botao>
          </div>
        </div>
      ) : null}
    </Dialogo>
  );
}

const NOMES_COLUNA: Record<keyof LinhaLida, string> = {
  linha: "Linha", condominio: "Condomínio", cnpj: "CNPJ", endereco: "Endereço", cidade: "Cidade", uf: "UF", unidades: "Unidades", faixa: "Faixa",
  pessoa: "Pessoa", whatsapp: "WhatsApp", email: "E-mail", decisao: "Decisão",
};

/** Exportar a lista (só a Administração; fica no histórico). Monta o CSV no navegador. */
export async function exportarCsv(avisar: (t: string) => void) {
  const r = await chamarApi<{ linhas: Record<string, unknown>[] }>(ROTAS_COMERCIAL.exportar);
  if (!r.ok) return avisar("Não deu para exportar agora. Tente de novo.");
  const cab = ["condominio", "cidade", "uf", "faixa", "unidades", "pessoa", "whatsapp", "email", "cnpj", "origem", "etapa", "motivoPerda", "responsavel", "baseLegal", "criadoEm"];
  const esc = (v: unknown) => (v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`);
  const csv = [cab.join(";"), ...r.dados.linhas.map((l) => cab.map((k) => esc(l[k])).join(";"))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "interessados.csv";
  a.click();
  URL.revokeObjectURL(url);
  avisar(`Lista exportada: ${plural(r.dados.linhas.length, "interessado", "interessados")}. A exportação fica no histórico.`);
}
