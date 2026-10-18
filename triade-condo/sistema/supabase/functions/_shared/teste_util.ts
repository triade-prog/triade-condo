// Dependências falsas para os testes das APIs: o Auth e o banco em memória, sem rede.

import type { AdminAuth, CadastroTotp, Fator, Portador, ProvedorAuth, ResultadoSenha, SessaoAuth } from "./auth.ts";
import { ErroBanco, type Banco } from "./banco.ts";
import type { Armazenamento } from "./arquivos.ts";
import { base64url } from "./cripto.ts";

export const SEGREDO = "segredo-de-repasse-de-teste";
export const CODIGO_CERTO = "123456";
export const TOKEN_RECUPERACAO = "token-de-recuperacao-valido";
export const TOKEN_CONVITE = "token-de-convite-valido-123";

export interface UsuarioFalso {
  id: string;
  email: string;
  senha: string;
  emailVerificado?: boolean;
  fatores?: Fator[];
}

function jwt(claims: Record<string, unknown>): string {
  return `${base64url('{"alg":"none"}')}.${base64url(JSON.stringify(claims))}.assinatura`;
}

export function authFalso(usuarios: UsuarioFalso[]) {
  const tokens = new Map<string, { userId: string; sessaoId: string; aal: "aal1" | "aal2" }>();
  const refresh = new Map<string, { userId: string; sessaoId: string; aal: "aal1" | "aal2" }>();
  const recuperacoes: string[] = [];
  const recuperacaoUsada = new Set<string>();
  const senhasTrocadas: string[] = [];

  function emitir(userId: string, sessaoId: string = crypto.randomUUID(), aal: "aal1" | "aal2" = "aal1"): SessaoAuth {
    const accessToken = jwt({ sub: userId, session_id: sessaoId, aal, n: crypto.randomUUID() });
    const refreshToken = crypto.randomUUID();
    tokens.set(accessToken, { userId, sessaoId, aal });
    refresh.set(refreshToken, { userId, sessaoId, aal });
    return { accessToken, refreshToken, expiraEm: 3600, userId };
  }
  const porId = (id: string) => usuarios.find((u) => u.id === id)!;

  const auth: ProvedorAuth = {
    entrarComSenha(email, senha): Promise<ResultadoSenha> {
      const u = usuarios.find((x) => x.email === email && x.senha === senha);
      if (!u) return Promise.resolve("CREDENCIAIS");
      if (u.emailVerificado === false) return Promise.resolve("EMAIL_NAO_VERIFICADO");
      return Promise.resolve(emitir(u.id));
    },
    fatores(token) {
      return Promise.resolve(porId(tokens.get(token)!.userId).fatores ?? []);
    },
    cadastrarTotp(token): Promise<CadastroTotp> {
      const u = porId(tokens.get(token)!.userId);
      u.fatores = [...(u.fatores ?? []).filter((f) => f.verificado), { id: crypto.randomUUID(), verificado: false }];
      return Promise.resolve({ factorId: u.fatores.at(-1)!.id, qrCode: "<svg/>", segredo: "SEGREDO" });
    },
    verificarTotp(token, factorId, codigo) {
      const t = tokens.get(token)!;
      const fator = porId(t.userId).fatores?.find((f) => f.id === factorId);
      if (!fator || codigo !== CODIGO_CERTO) return Promise.resolve(null);
      fator.verificado = true;
      return Promise.resolve(emitir(t.userId, t.sessaoId, "aal2"));
    },
    portador(token): Promise<Portador | null> {
      const t = tokens.get(token);
      if (!t) return Promise.resolve(null);
      const u = porId(t.userId);
      return Promise.resolve({
        userId: u.id,
        aal: t.aal,
        emailVerificado: u.emailVerificado !== false,
        temAutenticador: (u.fatores ?? []).some((f) => f.verificado),
        sessaoId: t.sessaoId,
      });
    },
    renovar(r) {
      const t = refresh.get(r);
      return Promise.resolve(t ? emitir(t.userId, t.sessaoId, t.aal) : null);
    },
    sair(token) {
      const t = tokens.get(token);
      if (t) for (const [k, v] of tokens) if (v.sessaoId === t.sessaoId) tokens.delete(k);
      return Promise.resolve();
    },
    sairDeTodas(token) {
      const t = tokens.get(token);
      if (t) {
        for (const [k, v] of tokens) if (v.userId === t.userId) tokens.delete(k);
        for (const [k, v] of refresh) if (v.userId === t.userId) refresh.delete(k);
      }
      return Promise.resolve();
    },
    pedirRecuperacao(email) {
      recuperacoes.push(email);
      return Promise.resolve();
    },
    usarRecuperacao(tokenHash) {
      if (tokenHash !== TOKEN_RECUPERACAO || recuperacaoUsada.has(tokenHash)) return Promise.resolve(null);
      recuperacaoUsada.add(tokenHash);
      return Promise.resolve(emitir(usuarios[0]!.id));
    },
    usarConvite(tokenHash) {
      if (tokenHash !== TOKEN_CONVITE || recuperacaoUsada.has(tokenHash)) return Promise.resolve(null);
      recuperacaoUsada.add(tokenHash);
      return Promise.resolve(emitir(usuarios.at(-1)!.id));
    },
    trocarSenha(token, novaSenha) {
      if (novaSenha.includes("vazada")) return Promise.resolve("FRACA" as const);
      senhasTrocadas.push(tokens.get(token)!.userId);
      return Promise.resolve("OK" as const);
    },
  };
  /** O access_token que o modelo padrão do Supabase põe no link (depois do #), com o amr do tipo de link. */
  function linkImplicito(metodo: "recovery" | "invite" | "password", userId = metodo === "invite" ? usuarios.at(-1)!.id : usuarios[0]!.id): string {
    const sessaoId = crypto.randomUUID();
    const accessToken = jwt({ sub: userId, session_id: sessaoId, aal: "aal1", amr: [{ method: metodo, timestamp: 1 }], n: crypto.randomUUID() });
    tokens.set(accessToken, { userId, sessaoId, aal: "aal1" });
    return accessToken;
  }
  return { auth, recuperacoes, senhasTrocadas, tokens, linkImplicito };
}

type Handler = (args: Record<string, unknown>) => unknown;

/** Banco falso: cada função responde pelo handler; as chamadas ficam registradas. */
export function bancoFalso(handlers: Record<string, Handler>) {
  const chamadas: { funcao: string; args: Record<string, unknown> }[] = [];
  const banco: Banco = {
    rpc<T>(funcao: string, args: Record<string, unknown> = {}): Promise<T> {
      chamadas.push({ funcao, args });
      const h = handlers[funcao];
      if (!h) return Promise.reject(new Error(`função não prevista no teste: ${funcao}`));
      try {
        return Promise.resolve(h(args) as T);
      } catch (e) {
        return Promise.reject(e);
      }
    },
  };
  const acessos = () => chamadas.filter((c) => c.funcao === "registrar_acesso").map((c) => c.args.p_acao);
  return { banco, chamadas, acessos };
}

/** Limites de uso contados em memória, como o banco faz. */
export function limitesFalsos(max: Record<string, number>) {
  const usos = new Map<string, number>();
  return {
    limite_ok: (a: Record<string, unknown>) => (usos.get(`${a.p_tipo}:${a.p_chave}`) ?? 0) < max[String(a.p_tipo)]!,
    limite_contar: (a: Record<string, unknown>) => {
      const k = `${a.p_tipo}:${a.p_chave}`;
      usos.set(k, (usos.get(k) ?? 0) + 1);
      return usos.get(k)! <= max[String(a.p_tipo)]!;
    },
  };
}

export function erroBanco(codigo: string, detalhe?: unknown): never {
  throw new ErroBanco(codigo, "erro do banco", detalhe === undefined ? undefined : JSON.stringify(detalhe));
}

export function pedido(app: { request: (url: string, init?: RequestInit) => Response | Promise<Response> }, base: string) {
  return async (caminho: string, opcoes: { metodo?: string; corpo?: unknown; cookie?: string; segredo?: string | null } = {}) => {
    const headers = new Headers({ "x-cliente-ip": "200.1.2.3" });
    if (opcoes.segredo !== null) headers.set("x-repasse-segredo", opcoes.segredo ?? SEGREDO);
    if (opcoes.cookie) headers.set("cookie", opcoes.cookie);
    if (opcoes.corpo !== undefined) headers.set("content-type", "application/json");
    return await app.request(`/${base}${caminho}`, {
      method: opcoes.metodo ?? (opcoes.corpo === undefined ? "GET" : "POST"),
      headers,
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    });
  };
}

/** O cookie de sessão gravado na resposta, pronto para a próxima chamada. */
export function cookieDe(r: Response): string {
  const set = r.headers.get("set-cookie") ?? "";
  return set.split(";")[0]!;
}

export async function erro(r: Response): Promise<{ codigo: string; detalhes?: Record<string, unknown> }> {
  return ((await r.json()) as { erro: { codigo: string; detalhes?: Record<string, unknown> } }).erro;
}

/** Convites em memória: e-mail já cadastrado devolve a mesma conta, sem e-mail novo. */
export function adminFalso(contas: Record<string, string> = {}) {
  const enviados: { email: string; voltarPara: string }[] = [];
  const autenticadoresTirados: string[] = [];
  const admin: AdminAuth = {
    emailDe(userId) {
      return Promise.resolve(Object.entries(contas).find(([, id]) => id === userId)?.[0] ?? null);
    },
    removerAutenticadores(userId) {
      autenticadoresTirados.push(userId);
      return Promise.resolve(1);
    },
    convidar(email, voltarPara) {
      if (contas[email]) return Promise.resolve({ userId: contas[email]!, contaNova: false });
      contas[email] = crypto.randomUUID();
      enviados.push({ email, voltarPara });
      return Promise.resolve({ userId: contas[email]!, contaNova: true });
    },
  };
  return { admin, enviados, contas, autenticadoresTirados };
}

/** Armazenamento em memória: guarda o que foi "enviado" e registra o que a API pediu. */
export function armazenamentoFalso() {
  const objetos = new Map<string, Uint8Array>();
  const apagados: string[] = [];
  const links: { caminho: string; segundos: number; baixarComo?: string }[] = [];
  const armazenamento: Armazenamento = {
    linkEnvio: (caminho) => Promise.resolve(`https://armazenamento.exemplo/envio/${caminho}?token=t`),
    ler: (caminho) => Promise.resolve(objetos.get(caminho) ?? null),
    gravar: (caminho, bytes) => {
      objetos.set(caminho, bytes);
      return Promise.resolve();
    },
    apagar: (caminho) => {
      objetos.delete(caminho);
      apagados.push(caminho);
      return Promise.resolve();
    },
    linkLeitura: (caminho, segundos, baixarComo) => {
      links.push({ caminho, segundos, baixarComo });
      return Promise.resolve(`https://armazenamento.exemplo/ler/${caminho}?token=t${baixarComo ? "&download=" + baixarComo : ""}`);
    },
  };
  return { armazenamento, objetos, apagados, links };
}
