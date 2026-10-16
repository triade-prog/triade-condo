// Login e sessão dos dois sistemas (F0.6, PT-08), com as diferenças de cada um:
// - Console TRÍADE: só a equipe ativa, sempre com o autenticador (aal2).
// - Plataforma do síndico: quem tem vínculo ativo; o autenticador é pedido de quem o cadastrou.
// Senha errada e conta sem acesso respondem igual. Tentativas contadas por e-mail + IP em
// hash. A recuperação responde sempre a mesma coisa, exista a conta ou não.

import type { Context, Hono, MiddlewareHandler } from "hono";
import {
  codigoAutenticadorSchema,
  entrarSchema,
  ErroDominio,
  recuperarSenhaSchema,
  redefinirSenhaSchema,
  TEXTO_RECUPERACAO_ENVIADA,
} from "@triade/domain";
import type { Portador, ProvedorAuth, SessaoAuth } from "./auth.ts";
import type { Banco } from "./banco.ts";
import { apagarCookie, gravarCookie, lerCookie } from "./cookies.ts";
import { base64url, deBase64url, sha256Hex } from "./cripto.ts";
import { ipDaChamada } from "./repasse.ts";
import { registrar } from "./registro.ts";
import { lerCorpo } from "./validar.ts";

/** Igual ao timebox das sessões no config.toml (12 h). */
const SESSAO_SEGUNDOS = 12 * 60 * 60;

export interface ConfigSistema {
  sistema: "plataforma" | "console";
  cookie: string;
  /** Console: sempre. Plataforma: só de quem cadastrou um autenticador. */
  autenticadorObrigatorio: boolean;
  /** Função do banco que diz se a pessoa entra neste sistema. */
  funcaoAcesso: "acesso_plataforma" | "acesso_console";
  /** Endereço do app, para o link de redefinir senha. */
  urlApp: string;
}

export interface DepsSessao {
  banco: Banco;
  auth: ProvedorAuth;
}

export interface Sessao {
  pessoaId: string;
  sessaoId: string;
  accessToken: string;
}

export type VarsSessao = { Variables: { sessao: Sessao } };

/** Qualquer app cujas variáveis incluem a sessão (a Plataforma soma o condomínio). */
type ComSessao = { Variables: VarsSessao["Variables"] };

function empacotar(s: Pick<SessaoAuth, "accessToken" | "refreshToken">): string {
  return `v1.${base64url(JSON.stringify({ a: s.accessToken, r: s.refreshToken }))}`;
}

function desempacotar(valor: string | null): { a: string; r: string } | null {
  if (!valor?.startsWith("v1.")) return null;
  try {
    const v = JSON.parse(deBase64url(valor.slice(3)));
    return typeof v?.a === "string" && typeof v?.r === "string" ? v : null;
  } catch {
    return null;
  }
}

async function acesso(deps: DepsSessao, cfg: ConfigSistema, pessoa: string | null, acao: string, dados: Record<string, unknown> = {}) {
  await deps.banco.rpc("registrar_acesso", { p_pessoa: pessoa, p_acao: acao, p_dados: { sistema: cfg.sistema, ...dados } });
}

export function criarSessao(cfg: ConfigSistema, deps: DepsSessao) {
  function gravarSessao(c: Context, s: SessaoAuth): void {
    c.header("set-cookie", gravarCookie(cfg.cookie, empacotar(s), SESSAO_SEGUNDOS), { append: true });
  }

  /** Sessão do cookie, renovada se o token venceu. Ainda não confere autenticador nem acesso. */
  async function sessaoDoCookie(c: Context): Promise<(Portador & { accessToken: string }) | null> {
    const s = desempacotar(lerCookie(c.req.raw.headers, cfg.cookie));
    if (!s) return null;
    const p = await deps.auth.portador(s.a);
    if (p) return { ...p, accessToken: s.a };
    const nova = await deps.auth.renovar(s.r);
    if (!nova) return null;
    const pn = await deps.auth.portador(nova.accessToken);
    if (!pn) return null;
    gravarSessao(c, nova);
    return { ...pn, accessToken: nova.accessToken };
  }

  /** Toda rota fora do login: sessão completa de quem ainda tem acesso a este sistema. */
  const exigirSessao: MiddlewareHandler<ComSessao> = async (c, next) => {
    const s = await sessaoDoCookie(c);
    if (!s) throw new ErroDominio("UNAUTHORIZED");
    if (!s.emailVerificado) throw new ErroDominio("EMAIL_NOT_VERIFIED");
    if (cfg.autenticadorObrigatorio && !s.temAutenticador) throw new ErroDominio("MFA_REQUIRED");
    if ((cfg.autenticadorObrigatorio || s.temAutenticador) && s.aal !== "aal2") throw new ErroDominio("MFA_REQUIRED");
    // Conferido a cada chamada: vínculo revogado ou equipe desativada param na hora (CF-04).
    if (!(await deps.banco.rpc<boolean>(cfg.funcaoAcesso, { p_pessoa: s.userId }))) throw new ErroDominio("FORBIDDEN");
    c.set("sessao", { pessoaId: s.userId, sessaoId: s.sessaoId, accessToken: s.accessToken });
    await next();
  };

  function rotas<E extends ComSessao>(app: Hono<E>): void {
    app.post("/v1/auth/entrar", async (c) => {
      const { email, senha } = await lerCorpo(c, entrarSchema);
      const chave = await sha256Hex(`${email}|${ipDaChamada(c.req.raw.headers) ?? "sem-ip"}`);
      if (!(await deps.banco.rpc<boolean>("limite_ok", { p_tipo: "login", p_chave: chave }))) throw new ErroDominio("RATE_LIMITED");

      const r = await deps.auth.entrarComSenha(email, senha);
      if (r === "EMAIL_NAO_VERIFICADO") throw new ErroDominio("EMAIL_NOT_VERIFIED");
      const temAcesso = r !== "CREDENCIAIS" && (await deps.banco.rpc<boolean>(cfg.funcaoAcesso, { p_pessoa: r.userId }));
      if (r === "CREDENCIAIS" || !temAcesso) {
        // Conta sem acesso a este sistema responde igual a senha errada.
        if (r !== "CREDENCIAIS") await deps.auth.sair(r.accessToken).catch(() => undefined);
        await deps.banco.rpc("limite_contar", { p_tipo: "login", p_chave: chave });
        await acesso(deps, cfg, null, r === "CREDENCIAIS" ? "acesso.senha_errada" : "acesso.sem_acesso");
        throw new ErroDominio("INVALID_CREDENTIALS");
      }

      const temAutenticador = (await deps.auth.fatores(r.accessToken)).some((f) => f.verificado);
      gravarSessao(c, r);
      const etapa = temAutenticador ? "CODIGO" : cfg.autenticadorObrigatorio ? "CADASTRAR_AUTENTICADOR" : "PRONTO";
      await acesso(deps, cfg, r.userId, etapa === "PRONTO" ? "acesso.entrou" : "acesso.senha_conferida");
      return c.json({ etapa });
    });

    // Cadastrar um autenticador: o primeiro, logo depois da senha; os seguintes, já com o código.
    app.post("/v1/auth/autenticador/cadastrar", async (c) => {
      const s = await sessaoDoCookie(c);
      if (!s) throw new ErroDominio("UNAUTHORIZED");
      if (s.temAutenticador && s.aal !== "aal2") throw new ErroDominio("MFA_REQUIRED");
      return c.json(await deps.auth.cadastrarTotp(s.accessToken));
    });

    app.post("/v1/auth/autenticador/verificar", async (c) => {
      const s = await sessaoDoCookie(c);
      if (!s) throw new ErroDominio("UNAUTHORIZED");
      const { codigo, factorId } = await lerCorpo(c, codigoAutenticadorSchema);
      if (!(await deps.banco.rpc<boolean>("limite_contar", { p_tipo: "autenticador", p_chave: s.userId }))) {
        throw new ErroDominio("RATE_LIMITED");
      }
      const fatores = await deps.auth.fatores(s.accessToken);
      const fator = factorId ? fatores.find((f) => f.id === factorId) : fatores.find((f) => f.verificado);
      if (!fator) throw new ErroDominio("MFA_INVALID");
      const primeiroCadastro = !fator.verificado;
      const nova = await deps.auth.verificarTotp(s.accessToken, fator.id, codigo);
      if (!nova) throw new ErroDominio("MFA_INVALID");
      gravarSessao(c, nova);
      await acesso(deps, cfg, s.userId, primeiroCadastro ? "acesso.autenticador_cadastrado" : "acesso.entrou");
      return c.json({ ok: true });
    });

    app.post("/v1/auth/sair", async (c) => {
      const s = desempacotar(lerCookie(c.req.raw.headers, cfg.cookie));
      if (s) await deps.auth.sair(s.a).catch(() => undefined);
      c.header("set-cookie", apagarCookie(cfg.cookie), { append: true });
      return c.json({ ok: true });
    });

    // Sessões revogáveis: encerra a conta em todos os aparelhos.
    app.post("/v1/auth/sair-de-todas", exigirSessao, async (c) => {
      const s = c.get("sessao");
      await deps.auth.sairDeTodas(s.accessToken);
      await acesso(deps, cfg, s.pessoaId, "acesso.sessoes_encerradas");
      c.header("set-cookie", apagarCookie(cfg.cookie), { append: true });
      return c.json({ ok: true });
    });

    app.post("/v1/auth/recuperar", async (c) => {
      const { email } = await lerCorpo(c, recuperarSenhaSchema);
      const chave = await sha256Hex(email);
      if (await deps.banco.rpc<boolean>("limite_contar", { p_tipo: "recuperacao", p_chave: chave })) {
        try {
          await deps.auth.pedirRecuperacao(email, `${cfg.urlApp}/redefinir`);
        } catch (e) {
          registrar("erro", { funcao: cfg.sistema, rota: "recuperar", erro: e });
        }
      }
      // Mesma resposta para conta que existe, que não existe e para quem passou do limite.
      return c.json({ mensagem: TEXTO_RECUPERACAO_ENVIADA });
    });

    app.post("/v1/auth/redefinir", async (c) => {
      const { tokenHash, novaSenha } = await lerCorpo(c, redefinirSenhaSchema);
      const s = await deps.auth.usarRecuperacao(tokenHash);
      if (!s) throw new ErroDominio("TOKEN_INVALID");
      if ((await deps.auth.trocarSenha(s.accessToken, novaSenha)) === "FRACA") {
        await deps.auth.sair(s.accessToken).catch(() => undefined);
        throw new ErroDominio("PASSWORD_WEAK");
      }
      // Depois de redefinir, as sessões antigas caem (inclusive a desta troca): entra de novo.
      await deps.auth.sairDeTodas(s.accessToken);
      await acesso(deps, cfg, s.userId, "acesso.senha_redefinida");
      c.header("set-cookie", apagarCookie(cfg.cookie), { append: true });
      return c.json({ ok: true });
    });
  }

  return { rotas, exigirSessao };
}
