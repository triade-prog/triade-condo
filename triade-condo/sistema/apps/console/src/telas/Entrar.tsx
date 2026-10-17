"use client";
// Entrar no Console (PT-08): senha e depois o código do autenticador, obrigatório para a
// equipe. No primeiro acesso, o QR code para cadastrar o autenticador.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Aviso, Botao, CampoTexto, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";

type Etapa = "SENHA" | "CODIGO" | "CADASTRAR_AUTENTICADOR";

interface Cadastro {
  factorId: string;
  qrCode: string;
  segredo: string;
}

/** O QR do Auth vem como SVG; vira uma imagem segura para o <img>. */
function imagemQr(qr: string): string {
  const svg = qr.replace(/^data:image\/svg\+xml;utf-8,/, "");
  return svg.startsWith("data:") ? svg : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function Entrar() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("SENHA");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function comecarCadastro() {
    const r = await chamarApi<Cadastro>("/v1/auth/autenticador/cadastrar", { corpo: {} });
    if (r.ok) setCadastro(r.dados);
    else setErro(r.erro);
  }

  async function enviarSenha(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ etapa: "CODIGO" | "CADASTRAR_AUTENTICADOR" | "PRONTO" }>("/v1/auth/entrar", { corpo: { email, senha } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setSenha("");
    if (r.dados.etapa === "PRONTO") return router.replace("/");
    if (r.dados.etapa === "CADASTRAR_AUTENTICADOR") await comecarCadastro();
    setEtapa(r.dados.etapa);
  }

  async function enviarCodigo(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const corpo = cadastro ? { codigo, factorId: cadastro.factorId } : { codigo };
    const r = await chamarApi("/v1/auth/autenticador/verificar", { corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    router.replace("/");
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[28px] font-normal tracking-tight">Entrar no Console</h1>
        <ol className="mt-2 flex gap-2 text-xs text-tinta-suave" aria-label="Etapas">
          <li aria-current={etapa === "SENHA" ? "step" : undefined} className={etapa === "SENHA" ? "font-semibold text-selecao-tinta" : ""}>1 Senha</li>
          <li aria-hidden="true">depois</li>
          <li aria-current={etapa !== "SENHA" ? "step" : undefined} className={etapa !== "SENHA" ? "font-semibold text-selecao-tinta" : ""}>2 Código do autenticador</li>
        </ol>
      </div>
      {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}

      {etapa === "SENHA" ? (
        <form onSubmit={enviarSenha} className="grid gap-4">
          <CampoTexto id="email" rotulo="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <CampoTexto id="senha" rotulo="Senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Botao type="submit" disabled={enviando}>{enviando ? "Conferindo…" : "Entrar"}</Botao>
          <Link href="/recuperar" className="justify-self-center text-sm font-medium text-acao hover:underline">Esqueci a senha</Link>
          <p className="text-xs text-tinta-suave">Só a equipe TRÍADE entra aqui. Síndico usa a Plataforma do síndico.</p>
        </form>
      ) : (
        <form onSubmit={enviarCodigo} className="grid gap-4">
          {etapa === "CADASTRAR_AUTENTICADOR" ? (
            <div className="grid gap-3">
              <p>A equipe TRÍADE entra sempre com o aplicativo autenticador. Leia o código abaixo no aplicativo (Google Authenticator, Microsoft Authenticator ou outro) e digite os 6 números que ele mostrar.</p>
              {cadastro ? (
                <>
                  {/* QR gerado na hora em data: (sem otimização de imagem a fazer). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagemQr(cadastro.qrCode)} alt="QR code para cadastrar o autenticador" width={180} height={180} className="justify-self-center rounded-md border border-linha bg-papel p-2" />
                  <p className="text-xs text-tinta-suave">
                    Sem câmera? Digite esta chave no aplicativo: <code className="font-mono break-all text-tinta">{cadastro.segredo}</code>
                  </p>
                </>
              ) : null}
            </div>
          ) : (
            <p>Abra o aplicativo autenticador e digite o código de 6 números da TRÍADE.</p>
          )}
          <CampoTexto id="codigo" rotulo="Código do autenticador" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
            value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
          <Botao type="submit" disabled={enviando || codigo.length !== 6}>{enviando ? "Conferindo…" : "Confirmar código"}</Botao>
        </form>
      )}
    </div>
  );
}
