"use client";
// Configurações › WhatsApp (passo 5; W-11, W-12, W-21, DC14), tela 6 do desenho: o termo do
// piloto (só o síndico aceita, antes de a TRÍADE conectar), a mensagem de fora do horário sem
// prometer prazo, o aviso fixo contra golpes, a categoria e a prioridade do pedido que chega pelo
// WhatsApp e quanto tempo as mensagens seguintes entram nele. Cada pessoa liga os próprios avisos
// no WhatsApp dela. A conexão (QR, credenciais) fica só no Console. Quem cuida das quedas do número
// (W-17): sem escolha, o síndico.

import { useState, type FormEvent } from "react";
import { AVISOS_NO_WHATSAPP, MINUTOS_ANEXAR, prometePrazo, type AvisoNoWhatsapp } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, ErroCarregar, textoDoErro, type ErroApi } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import { SituacaoDaConexao, type Conexao } from "../whatsapp/Whatsapp.tsx";

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
  pode: { editar: boolean; aceitarTermo: boolean };
}

function Termo({ aoAceitar }: { aoAceitar: () => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  async function aceitar() {
    setErro(null);
    const r = await chamarApi("/v1/condominio/whatsapp/termo", { corpo: {} });
    if (!r.ok) return setErro(r.erro);
    aoAceitar();
  }
  return (
    <section aria-labelledby="t-termo" className="grid gap-3 rounded-[18px] border border-atencao-borda bg-superficie p-5 shadow-s1">
      <h2 id="t-termo" className="text-lg font-medium">Termo do piloto do WhatsApp</h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <ul className="grid list-disc gap-1 pl-5 text-sm">
        <li>A conexão é de teste: liga o número do condomínio pelo WhatsApp Web, como um aparelho conectado. Não é a API oficial.</li>
        <li>O WhatsApp pode restringir ou bloquear o número a qualquer momento, sem aviso e sem recurso.</li>
        <li>Use um número só do condomínio. Nunca o número pessoal do síndico nem de outra pessoa.</li>
        <li>Enquanto o número estiver desconectado, as mensagens dos moradores não chegam: atenda por telefone e registre no painel.</li>
      </ul>
      <div className="flex justify-end"><Botao onClick={() => void aceitar()}>Li e aceito o termo do piloto</Botao></div>
    </section>
  );
}

function Mensagens({ d, aoSalvar }: { d: ConfigWhatsapp; aoSalvar: (texto: string) => void }) {
  const [fora, setFora] = useState(d.config.foraHorario);
  const [categoria, setCategoria] = useState(d.config.categoriaId);
  const [prioridade, setPrioridade] = useState(d.config.prioridadeId);
  const [anexar, setAnexar] = useState(d.config.anexarMinutos);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const promessa = prometePrazo(fora);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi("/v1/condominio/whatsapp/config", {
      metodo: "PUT", corpo: { versao: d.config.versao, foraHorario: fora, categoriaId: categoria, prioridadeId: prioridade, anexarMinutos: anexar },
    });
    if (!r.ok) return setErro(r.erro);
    aoSalvar("Configurações do WhatsApp salvas.");
  }

  const campos = camposComErro(erro);
  return (
    <form onSubmit={salvar} noValidate className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 className="text-lg font-medium">Mensagens e pedidos que chegam</h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <CampoAreaTexto id="zap-fora" rotulo="Fora do horário" maxLength={600} value={fora} disabled={!d.pode.editar} onChange={(e) => setFora(e.target.value)}
        ajuda="Vai uma vez por período fora do horário de atendimento (Configurações › Horários). Não prometa prazo nem atendimento imediato."
        erro={campos.includes("foraHorario") ? "Escreva de 20 a 600 caracteres." : promessa ? "Tire a promessa de prazo ou de atendimento imediato." : null} />
      <div className="grid gap-1">
        <span className="text-sm font-medium">Aviso contra golpes (fixo)</span>
        <p className="rounded-xl border border-linha bg-superficie-2 px-3 py-2 text-sm">{d.avisoGolpe}</p>
        <span className="text-xs text-tinta-suave">Vai nas boas-vindas e na confirmação de cada pedido.</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelecao id="zap-categoria" rotulo="Categoria do pedido que chega" value={categoria} disabled={!d.pode.editar}
          onChange={(e) => setCategoria(e.target.value)} opcoes={d.categorias.map((c) => ({ valor: c.id, texto: c.nome }))} />
        <CampoSelecao id="zap-prioridade" rotulo="Prioridade" value={prioridade} disabled={!d.pode.editar}
          onChange={(e) => setPrioridade(e.target.value)} opcoes={d.prioridades.map((p) => ({ valor: p.id, texto: p.nome }))} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Anexar ao mesmo pedido o que chegar por</legend>
        <div className="trilho flex-wrap">
          {MINUTOS_ANEXAR.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={anexar === m} disabled={!d.pode.editar} onClick={() => setAnexar(m)}>{m} min</button>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-tinta-suave">Quem atende reclassifica cada pedido. O responsável é o padrão da fila (Pessoas e acesso).</p>
      {d.pode.editar ? <div className="flex justify-end"><Botao type="submit" disabled={promessa}>Salvar</Botao></div> : null}
    </form>
  );
}

function QuemCuidaDasQuedas({ d, aoSalvar }: { d: ConfigWhatsapp; aoSalvar: (texto: string) => void }) {
  const [pessoa, setPessoa] = useState(d.quedas?.pessoaId ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const pessoas = d.pessoasQuedas ?? [];

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi("/v1/condominio/whatsapp/config/quedas", { metodo: "PUT", corpo: { versao: d.config.versao, pessoaId: pessoa || null } });
    if (!r.ok) return setErro(r.erro);
    aoSalvar(pessoa ? `${pessoas.find((x) => x.id === pessoa)?.nome ?? "A pessoa escolhida"} cuida das quedas do WhatsApp.` : "O síndico cuida das quedas do WhatsApp.");
  }

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 className="text-lg font-medium">Quando o WhatsApp cair</h2>
      <p className="text-sm text-tinta-suave">
        Quem cuida é avisado no sino quando o número desconecta, escreve por onde os moradores falam enquanto isso e, quando o número volta, decide o que ficou parado na fila.
        {d.quedas?.quemCuida ? ` Hoje: ${d.quedas.quemCuida}.` : ""}
      </p>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <CampoSelecao id="zap-quedas" rotulo="Quem cuida das quedas" className="max-w-sm" value={pessoa} disabled={!d.pode.editar}
        onChange={(e) => setPessoa(e.target.value)} ajuda="Só quem pode responder pedidos."
        erro={camposComErro(erro).includes("pessoaId") ? "Escolha alguém que pode responder pedidos." : null}
        opcoes={[{ valor: "", texto: "O síndico (padrão)" }, ...pessoas.map((x) => ({ valor: x.id, texto: x.sindico ? `${x.nome}, síndico` : x.nome }))]} />
      {d.pode.editar ? <div className="flex justify-end"><Botao type="submit">Salvar quem cuida</Botao></div> : null}
    </form>
  );
}

function MeusAvisos({ d, aoSalvar }: { d: ConfigWhatsapp; aoSalvar: (texto: string) => void }) {
  const [telefone, setTelefone] = useState(d.meusAvisos?.telefone ?? "+55");
  const [tipos, setTipos] = useState<AvisoNoWhatsapp[]>(d.meusAvisos?.tipos ?? ["PEDIDO_NOVO", "RETORNO_VENCIDO", "REVISAO"]);
  const [ligado, setLigado] = useState(d.meusAvisos?.ligado ?? true);
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi("/v1/condominio/whatsapp/meus-avisos", {
      metodo: "PUT", corpo: { versao: d.meusAvisos?.versao ?? null, telefone: telefone.replace(/[\s()-]/g, ""), tipos, ligado },
    });
    if (!r.ok) return setErro(r.erro);
    aoSalvar(ligado ? "Seus avisos no WhatsApp foram salvos." : "Avisos no seu WhatsApp desligados.");
  }

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 className="text-lg font-medium">Avisos no meu WhatsApp</h2>
      <p className="text-sm text-tinta-suave">Cada pessoa liga os seus, para o próprio celular. Chegam do número do condomínio, só no horário de funcionamento, sem nome nem telefone do morador. Decisões continuam no painel.</p>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5 accent-violeta-600" checked={ligado} onChange={(e) => setLigado(e.target.checked)} />
        Receber avisos no meu WhatsApp
      </label>
      <fieldset className="grid gap-2" disabled={!ligado}>
        <legend className="mb-1 text-sm font-medium">Quais</legend>
        {(Object.entries(AVISOS_NO_WHATSAPP) as [AvisoNoWhatsapp, string][]).map(([k, t]) => (
          <label key={k} className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-violeta-600" checked={tipos.includes(k)}
              onChange={(e) => setTipos(e.target.checked ? [...tipos, k] : tipos.filter((x) => x !== k))} />
            <span>{t}{k === "PEDIDO_NOVO" ? <span className="block text-xs text-tinta-suave">De todos os canais, não só do WhatsApp.</span> : null}</span>
          </label>
        ))}
      </fieldset>
      <CampoTexto id="zap-meu-celular" rotulo="Meu celular" inputMode="tel" maxLength={20} value={telefone} onChange={(e) => setTelefone(e.target.value)}
        ajuda="Com DDI e DDD, por exemplo +5561999998888."
        erro={camposComErro(erro).includes("telefone") ? "Celular com DDI e DDD (ex.: +5561999998888)." : null} />
      <div className="flex justify-end"><Botao type="submit">Salvar meus avisos</Botao></div>
    </form>
  );
}

export function AbaWhatsapp({ aoSalvar }: { aoSalvar: (texto: string) => void }) {
  const { atualizar } = usePlataforma();
  const carga = useCarregar<ConfigWhatsapp>("/v1/condominio/whatsapp/config");
  const [recado, setRecado] = useState<string | null>(null);
  if (carga.estado === "carregando") return <Carregando />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const salvo = (texto: string) => { setRecado(texto); carga.recarregar(); };
  return (
    <div className="grid gap-5">
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      <SituacaoDaConexao numero={d.numero} conexao={d.conexao} />
      {d.pode.aceitarTermo ? <Termo aoAceitar={() => { salvo("Termo do piloto aceito. A TRÍADE pode conectar o número."); aoSalvar("Termo do piloto aceito."); atualizar(); }} /> : null}
      <Mensagens key={`m-${d.config.versao}`} d={d} aoSalvar={salvo} />
      {d.quedas ? <QuemCuidaDasQuedas key={`q-${d.config.versao}`} d={d} aoSalvar={salvo} /> : null}
      <MeusAvisos key={`a-${d.meusAvisos?.versao ?? 0}`} d={d} aoSalvar={salvo} />
    </div>
  );
}
