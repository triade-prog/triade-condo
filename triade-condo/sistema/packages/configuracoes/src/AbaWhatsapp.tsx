"use client";
// Configurações › WhatsApp (passo 5; W-11, W-12, W-21, DC14), tela 6 do desenho: o termo do
// piloto (só o síndico aceita, antes de a TRÍADE conectar), a mensagem de fora do horário sem
// prometer prazo, o aviso fixo contra golpes, a categoria e a prioridade do pedido que chega pelo
// WhatsApp e quanto tempo as mensagens seguintes entram nele. Cada pessoa liga os próprios avisos
// no WhatsApp dela. A conexão (QR, credenciais) fica só no Console. Quem cuida das quedas do número
// (W-17): sem escolha, o síndico. O tempo de anexar é ajuste da TRÍADE (CF-09, PI-04); o termo e
// os avisos de cada pessoa são só do condomínio, e o Console mostra só a situação (CF-03). Os
// comunicados pelo WhatsApp (F6.6; CD-11, W-20) ligam em Comunicados. Na página por tarefa
// (decisão B.1) as partes gravam pela barra do rodapé; o tempo de anexar fica no bloco "Feito pela
// TRÍADE" (D.1) e os avisos de cada pessoa foram para o menu da conta, em Meus avisos (C.1). No
// alto, o número oficial pela Meta (F5.12, quadros 460 a 462), ligado pela janela da Meta
// (quadros 466 a 468, só o síndico, no app); o de teste fica embaixo dele até o oficial ser ligado.

import { useState } from "react";
import { AVISOS_NO_WHATSAPP, MINUTOS_ANEXAR, prometePrazo, type AvisoNoWhatsapp } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, ErroCarregar, textoDoErro, type ErroApi } from "@triade/ui";
import { useAmbiente, useCarregar, naBase } from "./contexto.tsx";
import { AjusteTecnico, BlocoTriade, type Tecnica } from "./tecnica.tsx";
import { contarMudancas, PaginaSalvavel, useParte, useVersao } from "./salvar.tsx";
import { SituacaoDaConexao, type Conexao } from "./conexao.tsx";
import { NumeroOficial } from "./NumeroOficial.tsx";

interface ConfigWhatsapp {
  numero: string | null;
  conexao: Conexao;
  config: { foraHorario: string; categoriaId: string; prioridadeId: string; anexarMinutos: number; versao: number };
  avisoGolpe: string;
  categorias: { id: string; nome: string }[];
  prioridades: { id: string; nome: string }[];
  meusAvisos?: { telefone: string; tipos: AvisoNoWhatsapp[]; ligado: boolean; versao: number };
  quedas?: { pessoaId?: string; quemCuida?: string };
  pessoasQuedas?: { id: string; nome: string; sindico: boolean }[];
  pode: { editar: boolean; tecnica?: boolean; aceitarTermo: boolean; cadastrarMeta?: boolean };
}

function Termo({ aoAceitar }: { aoAceitar: () => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  async function aceitar() {
    setErro(null);
    const r = await chamarApi(naBase("/whatsapp/termo"), { corpo: {} });
    if (!r.ok) return setErro(r.erro);
    aoAceitar();
  }
  return (
    <section aria-labelledby="t-termo" className="grid gap-3 rounded-[18px] border border-atencao-borda bg-superficie p-5 shadow-s1">
      <h2 id="t-termo" className="t-titulo-secao font-medium">Termo do piloto do WhatsApp</h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <ul className="grid list-disc gap-1 pl-5 t-texto">
        <li>A conexão é de teste: liga o número do condomínio pelo WhatsApp Web, como um aparelho conectado. Não é a API oficial.</li>
        <li>O WhatsApp pode restringir ou bloquear o número a qualquer momento, sem aviso e sem recurso.</li>
        <li>Use um número só do condomínio. Nunca o número pessoal do síndico nem de outra pessoa.</li>
        <li>Enquanto o número estiver desconectado, as mensagens dos moradores não chegam: atenda por telefone e registre no painel.</li>
      </ul>
      <div className="flex justify-end"><Botao onClick={() => void aceitar()}>Li e aceito o termo do piloto</Botao></div>
    </section>
  );
}

function Mensagens({ d }: { d: ConfigWhatsapp }) {
  const [fora, setFora] = useState(d.config.foraHorario);
  const [categoria, setCategoria] = useState(d.config.categoriaId);
  const [prioridade, setPrioridade] = useState(d.config.prioridadeId);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const promessa = prometePrazo(fora);
  const versao = useVersao("config", d.config.versao);

  async function salvar(): Promise<string | null> {
    setErro(null);
    if (promessa) return null;
    const r = await chamarApi<{ versao: number }>(naBase("/whatsapp/config"), {
      metodo: "PUT", corpo: { versao: versao.atual(), foraHorario: fora, categoriaId: categoria, prioridadeId: prioridade },
    });
    if (!r.ok) { setErro(r.erro); return null; }
    versao.gravou(r.dados);
    return "Configurações do WhatsApp salvas.";
  }
  useParte("zap-mensagens", {
    nome: "Mensagens e pedidos que chegam",
    mudancas: contarMudancas({ fora: d.config.foraHorario, categoria: d.config.categoriaId, prioridade: d.config.prioridadeId }, { fora, categoria, prioridade }),
    salvar,
  });

  const campos = camposComErro(erro);
  return (
    <section aria-labelledby="t-zap-msg" className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-zap-msg" className="t-titulo-secao font-medium">Mensagens e pedidos que chegam</h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <CampoAreaTexto id="zap-fora" rotulo="Fora do horário" maxLength={600} value={fora} disabled={!d.pode.editar} onChange={(e) => setFora(e.target.value)}
        ajuda="Vai uma vez por período fora do horário de atendimento (Configurações › Horários). Não prometa prazo nem atendimento imediato."
        erro={campos.includes("foraHorario") ? "Escreva de 20 a 600 caracteres." : promessa ? "Tire a promessa de prazo ou de atendimento imediato." : null} />
      <div className="grid gap-1">
        <span className="t-texto font-medium">Aviso contra golpes (fixo)</span>
        <p className="rounded-xl border border-linha bg-superficie-2 px-3 py-2 t-texto">{d.avisoGolpe}</p>
        <span className="t-apoio text-tinta-suave">Vai nas boas-vindas e na confirmação de cada pedido.</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelecao id="zap-categoria" rotulo="Categoria do pedido que chega" value={categoria} disabled={!d.pode.editar}
          onChange={(e) => setCategoria(e.target.value)} opcoes={d.categorias.map((c) => ({ valor: c.id, texto: c.nome }))} />
        <CampoSelecao id="zap-prioridade" rotulo="Prioridade" value={prioridade} disabled={!d.pode.editar}
          onChange={(e) => setPrioridade(e.target.value)} opcoes={d.prioridades.map((p) => ({ valor: p.id, texto: p.nome }))} />
      </div>
      <p className="t-apoio text-tinta-suave">Quem atende reclassifica cada pedido. O responsável é o padrão da fila (Pessoas e acesso).</p>
    </section>
  );
}

function QuemCuidaDasQuedas({ d }: { d: ConfigWhatsapp }) {
  const [pessoa, setPessoa] = useState(d.quedas?.pessoaId ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const pessoas = d.pessoasQuedas ?? [];
  const versao = useVersao("config", d.config.versao);

  async function salvar(): Promise<string | null> {
    setErro(null);
    const r = await chamarApi<{ versao: number }>(naBase("/whatsapp/config/quedas"), { metodo: "PUT", corpo: { versao: versao.atual(), pessoaId: pessoa || null } });
    if (!r.ok) { setErro(r.erro); return null; }
    versao.gravou(r.dados);
    return pessoa ? `${pessoas.find((x) => x.id === pessoa)?.nome ?? "A pessoa escolhida"} cuida das quedas do WhatsApp.` : "O síndico cuida das quedas do WhatsApp.";
  }
  useParte("zap-quedas", { nome: "Quando o WhatsApp cair", mudancas: Number(pessoa !== (d.quedas?.pessoaId ?? "")), salvar });

  return (
    <section aria-labelledby="t-zap-quedas" className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-zap-quedas" className="t-titulo-secao font-medium">Quando o WhatsApp cair</h2>
      <p className="t-apoio text-tinta-suave">
        Quem cuida é avisado no sino quando o número desconecta, escreve por onde os moradores falam enquanto isso e, quando o número volta, decide o que ficou parado na fila.
        {d.quedas?.quemCuida ? ` Hoje: ${d.quedas.quemCuida}.` : ""}
      </p>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <CampoSelecao id="zap-quedas" rotulo="Quem cuida das quedas" className="max-w-sm" value={pessoa} disabled={!d.pode.editar}
        onChange={(e) => setPessoa(e.target.value)} ajuda="Só quem pode responder pedidos."
        erro={camposComErro(erro).includes("pessoaId") ? "Escolha alguém que pode responder pedidos." : null}
        opcoes={[{ valor: "", texto: "O síndico (padrão)" }, ...pessoas.map((x) => ({ valor: x.id, texto: x.sindico ? `${x.nome}, síndico` : x.nome }))]} />
    </section>
  );
}

function MeusAvisos({ d }: { d: ConfigWhatsapp }) {
  const [telefone, setTelefone] = useState(d.meusAvisos?.telefone ?? "+55");
  const [tipos, setTipos] = useState<AvisoNoWhatsapp[]>(d.meusAvisos?.tipos ?? ["PEDIDO_NOVO", "RETORNO_VENCIDO", "REVISAO"]);
  const [ligado, setLigado] = useState(d.meusAvisos?.ligado ?? true);
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function salvar(): Promise<string | null> {
    setErro(null);
    const r = await chamarApi(naBase("/whatsapp/meus-avisos"), {
      metodo: "PUT", corpo: { versao: d.meusAvisos?.versao ?? null, telefone: telefone.replace(/[\s()-]/g, ""), tipos, ligado },
    });
    if (!r.ok) { setErro(r.erro); return null; }
    return ligado ? "Seus avisos no WhatsApp foram salvos." : "Avisos no seu WhatsApp desligados.";
  }
  const iniciais = { telefone: d.meusAvisos?.telefone ?? "+55", tipos: d.meusAvisos?.tipos ?? ["PEDIDO_NOVO", "RETORNO_VENCIDO", "REVISAO"], ligado: d.meusAvisos?.ligado ?? true };
  useParte("meus-avisos", { nome: "Avisos no meu WhatsApp", mudancas: contarMudancas(iniciais, { telefone, tipos, ligado }), salvar });

  return (
    <section aria-labelledby="t-meus-avisos" className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-meus-avisos" className="t-titulo-secao font-medium">Avisos no meu WhatsApp</h2>
      <p className="t-apoio text-tinta-suave">Chegam do número do condomínio, só no horário de funcionamento, sem nome nem telefone do morador. Decisões continuam no painel.</p>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <label className="flex items-center gap-3 t-texto">
        <input type="checkbox" className="h-5 w-5 accent-violeta-600" checked={ligado} onChange={(e) => setLigado(e.target.checked)} />
        Receber avisos no meu WhatsApp
      </label>
      <fieldset className="grid gap-2" disabled={!ligado}>
        <legend className="mb-1 t-texto font-medium">Quais</legend>
        {(Object.entries(AVISOS_NO_WHATSAPP) as [AvisoNoWhatsapp, string][]).map(([k, t]) => (
          <label key={k} className="flex items-center gap-3 t-texto">
            <input type="checkbox" className="h-5 w-5 accent-violeta-600" checked={tipos.includes(k)}
              onChange={(e) => setTipos(e.target.checked ? [...tipos, k] : tipos.filter((x) => x !== k))} />
            <span>{t}{k === "PEDIDO_NOVO" ? <span className="block t-apoio text-tinta-suave">De todos os canais, não só do WhatsApp.</span> : null}</span>
          </label>
        ))}
      </fieldset>
      <CampoTexto id="zap-meu-celular" rotulo="Meu celular" inputMode="tel" maxLength={20} value={telefone} onChange={(e) => setTelefone(e.target.value)}
        ajuda="Com DDI e DDD, por exemplo +5561999998888."
        erro={camposComErro(erro).includes("telefone") ? "Celular com DDI e DDD (ex.: +5561999998888)." : null} />
    </section>
  );
}

/** A página WhatsApp: a situação, o termo, as mensagens e quem cuida das quedas; no fim, o que é da TRÍADE. */
export function AbaWhatsapp({ aoSalvar, tecnica }: { aoSalvar: (texto: string) => void; tecnica: Tecnica }) {
  const { onde, aoMudar } = useAmbiente();
  const carga = useCarregar<ConfigWhatsapp>(naBase("/whatsapp/config"));
  if (carga.estado === "carregando") return <Carregando />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const salvo = (texto: string) => { aoSalvar(texto); carga.recarregar(); };
  return (
    <>
      <NumeroOficial numero={d.numero} conexao={d.conexao} podeCadastrar={onde === "app" && d.pode.cadastrarMeta === true}
        aoMudar={(texto) => { if (texto) salvo(texto); else carga.recarregar(); aoMudar?.(); }} />
      {d.conexao.provedor === "META" ? null : (
        <section aria-labelledby="t-numero-teste" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
          <h2 id="t-numero-teste" className="t-titulo-secao font-medium">Número de teste (piloto)</h2>
          <SituacaoDaConexao numero={d.numero} conexao={d.conexao} />
        </section>
      )}
      {d.pode.aceitarTermo && d.conexao.provedor !== "META" ? <Termo aoAceitar={() => { salvo("Termo do piloto aceito. A TRÍADE pode conectar o número."); aoMudar?.(); }} /> : null}
      <Mensagens key={`m-${d.config.versao}`} d={d} />
      {d.quedas ? <QuemCuidaDasQuedas key={`q-${d.config.versao}`} d={d} /> : null}
      {onde === "app" ? null : (
        <p className="t-apoio text-tinta-suave">
          O termo do piloto {d.conexao.termoAceitoEm ? "já foi aceito" : "ainda não foi aceito"}. O aceite e os avisos no WhatsApp de cada pessoa são do condomínio, no app.
        </p>
      )}
      <BlocoTriade>
        <AjusteTecnico key={`x-${d.config.versao}`} id="anexar" titulo="Mensagens seguintes" mudanca="ANEXAR" parte="Anexar ao mesmo pedido o que chegar por"
          atual={String(d.config.anexarMinutos)} tecnica={tecnica} recarregar={carga.recarregar}
          opcoes={MINUTOS_ANEXAR.map((m) => ({ valor: String(m), texto: `${m} min` }))}
          ajuda="Depois de abrir o pedido pelo WhatsApp, o que o morador mandar neste tempo, como foto, áudio ou documento, entra no mesmo pedido."
          salvar={(v, motivo) => chamarApi(naBase("/whatsapp/anexar"), { metodo: "PUT", corpo: { versao: d.config.versao, minutos: Number(v), motivo } })}
          aoSalvar={(v) => salvo(`O que chegar pelo WhatsApp em ${v} minutos entra no mesmo pedido.`)} />
      </BlocoTriade>
    </>
  );
}

/** Meus avisos (decisão C.1): no menu da conta, porque vale só para quem está logado. Só no app. */
export function PaginaMeusAvisos() {
  const carga = useCarregar<ConfigWhatsapp>(naBase("/whatsapp/config"));
  const [recado, setRecado] = useState<string | null>(null);
  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo os seus avisos…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  return (
    <div className="grid max-w-3xl gap-4">
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      <PaginaSalvavel aoSalvar={(t) => { setRecado(t); carga.recarregar(); }}>
        <MeusAvisos key={`a-${d.meusAvisos?.versao ?? 0}`} d={d} />
      </PaginaSalvavel>
    </div>
  );
}
