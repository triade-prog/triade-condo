"use client";
// Aba WhatsApp da ficha (passo 5; W-01, DC14), tela 1 do desenho: o número do condomínio, a
// conexão de piloto pelo Wafly (não oficial, dito sem rodeio), as credenciais da instância (que
// nunca mais aparecem), a conexão pelo QR ou por código, a conferência do aparelho e o histórico.
// Só administração e implantação conectam, trocam credenciais e desconectam (com motivo).

import { useState, type FormEvent } from "react";
import { formatarDataHora, mostrarTelefone, SITUACOES_CONEXAO, type SituacaoConexao } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, type ErroApi, type Tom } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { PropsAba } from "./tipos.ts";

interface DadosWhatsapp {
  numeroFicha: string | null;
  conexao: {
    situacao: SituacaoConexao;
    provedor?: string;
    oficial?: boolean;
    aparelho?: string;
    conectadoEm?: string;
    desconectadoEm?: string;
    ultimaRecebida?: string;
    termoAceitoEm?: string;
    termoAceitoPor?: string;
    versao?: number;
  };
  historico: { acao: string; em: string; autor: string | null; dados: { origem?: string; motivo?: string } }[];
  pode: { conectar: boolean };
}

const TOM: Record<SituacaoConexao, Tom> = { SEM_CREDENCIAIS: "neutro", DESCONECTADO: "erro", CONECTANDO: "atencao", CONECTADO: "ok" };

const EVENTOS: Record<string, string> = {
  "whatsapp.credenciais": "Credenciais da instância guardadas; avisos do provedor religados com segredo novo",
  "whatsapp.conectado": "Conectado; o aparelho confere com a ficha",
  "whatsapp.desconectado": "Desconectado",
  "whatsapp.aparelho_diferente": "Aparelho diferente do número da ficha: desconectado na hora",
  "whatsapp.termo_aceito": "Termo do piloto aceito pelo síndico",
};

function JanelaCredenciais({ id, versao, aoFechar, aoSalvar }: { id: string; versao?: number; aoFechar: () => void; aoSalvar: (avisos: boolean) => void }) {
  const [instancia, setInstancia] = useState("");
  const [token, setToken] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi<{ avisos: boolean }>(`/v1/clientes/${id}/whatsapp/credenciais`, { metodo: "PUT", corpo: { versao: versao ?? null, instancia, token } });
    if (!r.ok) return setErro(r.erro);
    aoSalvar(r.dados.avisos);
  }
  const campos = camposComErro(erro);
  return (
    <Dialogo aberto titulo="Credenciais da instância" aoFechar={aoFechar}>
      <form onSubmit={salvar} noValidate className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <p className="text-sm text-tinta-suave">Do painel do Wafly, em Instâncias. Guardadas cifradas: depois de salvas, não aparecem mais em lugar nenhum.</p>
        <CampoTexto id="wa-instancia" rotulo="Instância" required maxLength={100} autoComplete="off" value={instancia} onChange={(e) => setInstancia(e.target.value)}
          erro={campos.includes("instancia") ? "Só letras, números, hífen e sublinhado." : null} />
        <CampoTexto id="wa-token" rotulo="Token da instância" type="password" required maxLength={500} autoComplete="off" value={token}
          onChange={(e) => setToken(e.target.value)} erro={campos.includes("token") ? "Cole o token da instância." : null} />
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit">Guardar</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function JanelaConectar({ id, numero, aoFechar, aoConferir }: { id: string; numero: string | null; aoFechar: () => void; aoConferir: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [jaConectado, setJaConectado] = useState(false);

  async function pedir(modo: "QR" | "CODIGO") {
    setErro(null);
    const r = await chamarApi<{ qr?: string; codigo?: string; conectado?: boolean }>(`/v1/clientes/${id}/whatsapp/conectar`, { corpo: { modo } });
    if (!r.ok) return setErro(r.erro);
    setQr(r.dados.qr ?? null);
    setCodigo(r.dados.codigo ?? null);
    setJaConectado(!!r.dados.conectado);
  }

  return (
    <Dialogo aberto titulo="Conectar o número" aoFechar={aoFechar}>
      <div className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <ol className="grid list-decimal gap-1 pl-5 text-sm">
          <li>No celular do condomínio, abra o WhatsApp do número {numero ? mostrarTelefone(numero) : "da ficha"}.</li>
          <li>Toque em Aparelhos conectados e em Conectar aparelho.</li>
          <li>Aponte para o QR, ou escolha conectar com número de telefone e digite o código.</li>
        </ol>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem do QR que o provedor devolve na hora; não passa por otimizador
          <img src={qr} alt="QR para conectar o WhatsApp do condomínio" className="h-56 w-56 justify-self-center rounded-xl border border-linha bg-white p-2" />
        ) : null}
        {codigo ? <p className="justify-self-center rounded-xl bg-violeta-50 px-4 py-3 font-mono text-2xl tracking-widest" aria-label={`Código de emparelhamento ${codigo}`}>{codigo}</p> : null}
        {jaConectado ? <Aviso tom="ok">O provedor diz que já está conectado. Confira o aparelho.</Aviso> : null}
        <Aviso tom="info">Depois de conectar, o sistema confere se o aparelho é o número da ficha. Se for outro, desconecta na hora.</Aviso>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={() => void pedir("QR")}>{qr ? "Novo QR" : "Mostrar o QR"}</Botao>
          <Botao variante="contorno" onClick={() => void pedir("CODIGO")}>Usar código de emparelhamento</Botao>
          <Botao onClick={aoConferir}>Pronto, conferir</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

export function AbaWhatsapp({ ficha, avisar }: PropsAba) {
  const id = ficha.condominio.id;
  const carga = useCarregar<DadosWhatsapp>(`/v1/clientes/${id}/whatsapp`);
  const [janela, setJanela] = useState<"credenciais" | "conectar" | "desconectar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [aviso, setAviso] = useState<{ tom: Tom; texto: string } | null>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o WhatsApp…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const cx = d.conexao;

  async function conferir() {
    setJanela(null);
    setErro(null);
    const r = await chamarApi<{ situacao: SituacaoConexao; aparelhoDiferente?: boolean }>(`/v1/clientes/${id}/whatsapp/verificar`, { corpo: {} });
    if (!r.ok) return setErro(r.erro);
    setAviso(r.dados.aparelhoDiferente ? { tom: "erro", texto: "O aparelho conectado não é o número da ficha. Foi desconectado na hora." }
      : r.dados.situacao === "CONECTADO" ? { tom: "ok", texto: "Conectado. O aparelho confere com a ficha." }
      : { tom: "atencao", texto: "Ainda não conectado. Mostre o QR de novo e tente outra vez." });
    carga.recarregar();
  }

  async function desconectar() {
    setErro(null);
    const r = await chamarApi(`/v1/clientes/${id}/whatsapp/desconectar`, { corpo: { motivo } });
    if (!r.ok) return setErro(r.erro);
    setJanela(null);
    setMotivo("");
    setAviso({ tom: "ok", texto: "Número desconectado. O síndico foi avisado no sino." });
    carga.recarregar();
  }

  return (
    <div className="grid max-w-4xl gap-4">
      <Aviso tom="atencao" titulo="Conexão de piloto, não oficial (Wafly)">
        Liga o número pelo WhatsApp Web, como um aparelho conectado. O WhatsApp pode restringir ou bloquear o número sem aviso. Só para o condomínio de teste,
        com o termo do piloto aceito pelo síndico. Em produção, só a API oficial (DC4).
      </Aviso>
      {aviso ? <Aviso tom={aviso.tom} papel="status">{aviso.texto}</Aviso> : null}
      {erro && janela !== "desconectar" ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <section aria-labelledby="t-numero" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
        <h2 id="t-numero" className="flex flex-wrap items-center gap-2 text-lg font-medium">Número do condomínio <Selo tom="atencao">Piloto</Selo></h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-tinta-suave">Número na ficha</dt><dd className="font-medium">{d.numeroFicha ? mostrarTelefone(d.numeroFicha) : "Sem número: cadastre na aba Ficha"}</dd></div>
          <div><dt className="text-xs text-tinta-suave">Situação</dt><dd><Selo tom={TOM[cx.situacao]}>{SITUACOES_CONEXAO[cx.situacao]}</Selo></dd></div>
          {cx.aparelho ? <div><dt className="text-xs text-tinta-suave">Aparelho conectado</dt><dd className="font-medium">{mostrarTelefone(cx.aparelho)}</dd></div> : null}
          {cx.situacao === "CONECTADO" && cx.conectadoEm ? <div><dt className="text-xs text-tinta-suave">Desde</dt><dd>{formatarDataHora(cx.conectadoEm)}</dd></div> : null}
          {cx.situacao === "DESCONECTADO" && cx.desconectadoEm ? <div><dt className="text-xs text-tinta-suave">Desconectado desde</dt><dd>{formatarDataHora(cx.desconectadoEm)}</dd></div> : null}
          {cx.ultimaRecebida ? <div><dt className="text-xs text-tinta-suave">Última mensagem recebida</dt><dd>{formatarDataHora(cx.ultimaRecebida)}</dd></div> : null}
          <div><dt className="text-xs text-tinta-suave">Termo do piloto</dt>
            <dd>{cx.termoAceitoEm ? `Aceito por ${cx.termoAceitoPor ?? "o síndico"} em ${formatarDataHora(cx.termoAceitoEm)}` : "Esperando o síndico aceitar em Configurações › WhatsApp"}</dd></div>
        </dl>
        {d.pode.conectar ? (
          <div className="flex flex-wrap gap-2">
            <Botao variante="contorno" tamanho="m" onClick={() => setJanela("credenciais")}>{cx.situacao === "SEM_CREDENCIAIS" ? "Guardar credenciais" : "Trocar credenciais"}</Botao>
            {cx.situacao !== "SEM_CREDENCIAIS" && cx.situacao !== "CONECTADO" ? (
              <Botao tamanho="m" disabled={!cx.termoAceitoEm || !d.numeroFicha} onClick={() => setJanela("conectar")}>Conectar</Botao>
            ) : null}
            {cx.situacao !== "SEM_CREDENCIAIS" ? <Botao variante="contorno" tamanho="m" onClick={() => void conferir()}>Conferir agora</Botao> : null}
            {cx.situacao === "CONECTADO" || cx.situacao === "CONECTANDO" ? <Botao variante="discreto" tamanho="m" onClick={() => setJanela("desconectar")}>Desconectar</Botao> : null}
          </div>
        ) : cx.situacao !== "SEM_CREDENCIAIS" ? <div><Botao variante="contorno" tamanho="m" onClick={() => void conferir()}>Conferir agora</Botao></div> : null}
      </section>
      <section aria-labelledby="t-hist-zap" className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
        <h2 id="t-hist-zap" className="text-lg font-medium">Histórico da conexão</h2>
        {d.historico.length === 0 ? <p className="text-sm text-tinta-suave">Nada ainda.</p> : (
          <ul className="divide-y divide-linha text-sm">
            {d.historico.map((h, i) => (
              <li key={i} className="grid gap-0.5 py-2">
                <span>{EVENTOS[h.acao] ?? h.acao}{h.dados.origem === "PROVEDOR" ? " (pelo provedor)" : ""}{h.dados.motivo ? `. Motivo: ${h.dados.motivo}` : ""}</span>
                <span className="text-xs text-tinta-suave">{formatarDataHora(h.em)}{h.autor ? ` · ${h.autor}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {janela === "credenciais" ? (
        <JanelaCredenciais id={id} versao={cx.versao} aoFechar={() => setJanela(null)} aoSalvar={(avisos) => {
          setJanela(null);
          setAviso(avisos ? { tom: "ok", texto: "Credenciais guardadas e avisos do provedor ligados." }
            : { tom: "atencao", texto: "Credenciais guardadas, mas o provedor não aceitou ligar os avisos. Confira o token e guarde de novo." });
          avisar({ tom: "ok", texto: "Credenciais do WhatsApp guardadas." });
          carga.recarregar();
        }} />
      ) : null}
      {janela === "conectar" ? <JanelaConectar id={id} numero={d.numeroFicha} aoFechar={() => setJanela(null)} aoConferir={() => void conferir()} /> : null}
      {janela === "desconectar" ? (
        <Dialogo aberto titulo="Desconectar o número" aoFechar={() => setJanela(null)}>
          <div className="grid gap-4">
            {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
            <p className="text-sm">As mensagens dos moradores deixam de chegar e o síndico é avisado no sino.</p>
            <CampoAreaTexto id="wa-motivo" rotulo="Motivo" required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              erro={camposComErro(erro).includes("motivo") ? "Diga o motivo (3 a 300 caracteres)." : null} />
            <div className="flex justify-end gap-2">
              <Botao variante="contorno" onClick={() => setJanela(null)}>Voltar</Botao>
              <Botao variante="perigo" onClick={() => void desconectar()}>Desconectar</Botao>
            </div>
          </div>
        </Dialogo>
      ) : null}
    </div>
  );
}
