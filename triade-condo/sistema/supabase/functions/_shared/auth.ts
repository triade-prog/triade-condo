// Login pelo Supabase Auth (F0.6, PT-08): serviço de identidade mantido, nunca autenticação
// feita em casa. Senha guardada só lá, com hash. As funções falam com o Auth por esta
// interface; os testes usam uma implementação falsa.

import { claimsJwt } from "./jwt.ts";

export interface SessaoAuth {
  accessToken: string;
  refreshToken: string;
  /** Segundos até o accessToken vencer. */
  expiraEm: number;
  userId: string;
}

export interface Fator {
  id: string;
  verificado: boolean;
}

export interface CadastroTotp {
  factorId: string;
  /** QR code em SVG, para o aplicativo autenticador. */
  qrCode: string;
  segredo: string;
}

export interface Portador {
  userId: string;
  /** "aal1" depois da senha; "aal2" depois do código do autenticador. */
  aal: "aal1" | "aal2";
  emailVerificado: boolean;
  /** Tem autenticador confirmado: a partir daí, toda sessão precisa do código. */
  temAutenticador: boolean;
  /** Sessão do Auth (claim session_id): guarda o condomínio escolhido e pode ser revogada. */
  sessaoId: string;
}

export type ResultadoSenha = SessaoAuth | "CREDENCIAIS" | "EMAIL_NAO_VERIFICADO";

export interface ProvedorAuth {
  entrarComSenha(email: string, senha: string): Promise<ResultadoSenha>;
  fatores(accessToken: string): Promise<Fator[]>;
  cadastrarTotp(accessToken: string): Promise<CadastroTotp>;
  /** Sessão nova, já em aal2; null quando o código não confere. */
  verificarTotp(accessToken: string, factorId: string, codigo: string): Promise<SessaoAuth | null>;
  /** Valida o token no Auth; null se vencido ou revogado. */
  portador(accessToken: string): Promise<Portador | null>;
  renovar(refreshToken: string): Promise<SessaoAuth | null>;
  /** Encerra esta sessão. */
  sair(accessToken: string): Promise<void>;
  /** Encerra todas as sessões da conta, em todos os aparelhos. */
  sairDeTodas(accessToken: string): Promise<void>;
  /** Envia o link de uso único. Não diz se a conta existe. */
  pedirRecuperacao(email: string, voltarPara: string): Promise<void>;
  /** Troca o token do link por uma sessão; null se vencido, usado ou substituído por outro pedido. */
  usarRecuperacao(tokenHash: string): Promise<SessaoAuth | null>;
  /** O mesmo para o link do convite: a pessoa convidada cria a senha (CF-02). */
  usarConvite(tokenHash: string): Promise<SessaoAuth | null>;
  trocarSenha(accessToken: string, novaSenha: string): Promise<"OK" | "FRACA">;
}

interface TokenGoTrue {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string };
}

function sessao(t: TokenGoTrue): SessaoAuth {
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiraEm: t.expires_in, userId: t.user.id };
}

export function authGoTrue(url: string, apiKey: string, buscar: typeof fetch = fetch): ProvedorAuth {
  async function chamar(caminho: string, init: { method?: string; token?: string; corpo?: unknown } = {}): Promise<Response> {
    return await buscar(`${url}/auth/v1${caminho}`, {
      method: init.method ?? (init.corpo === undefined ? "GET" : "POST"),
      headers: {
        apikey: apiKey,
        authorization: `Bearer ${init.token ?? apiKey}`,
        "content-type": "application/json",
      },
      body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo),
      signal: AbortSignal.timeout(8000),
    });
  }

  async function exigirOk(r: Response): Promise<unknown> {
    if (!r.ok) throw new Error(`Auth respondeu ${r.status}`);
    return await r.json();
  }

  async function codigoDoErro(r: Response): Promise<string> {
    const e = (await r.json().catch(() => ({}))) as { error_code?: string; code?: string; msg?: string };
    return e.error_code ?? e.code ?? e.msg ?? "";
  }

  return {
    async entrarComSenha(email, senha) {
      const r = await chamar("/token?grant_type=password", { corpo: { email, password: senha } });
      if (r.status === 400) {
        return /email_not_confirmed|not confirmed/i.test(await codigoDoErro(r)) ? "EMAIL_NAO_VERIFICADO" : "CREDENCIAIS";
      }
      return sessao((await exigirOk(r)) as TokenGoTrue);
    },

    async fatores(token) {
      const u = (await exigirOk(await chamar("/user", { token }))) as { factors?: { id: string; factor_type: string; status: string }[] };
      return (u.factors ?? []).filter((f) => f.factor_type === "totp").map((f) => ({ id: f.id, verificado: f.status === "verified" }));
    },

    async cadastrarTotp(token) {
      // Cadastros que ficaram pela metade saem antes (o Auth deixa remover um fator não confirmado).
      const u = (await exigirOk(await chamar("/user", { token }))) as { factors?: { id: string; factor_type: string; status: string }[] };
      for (const f of u.factors ?? []) {
        if (f.factor_type === "totp" && f.status !== "verified") {
          await chamar(`/factors/${encodeURIComponent(f.id)}`, { method: "DELETE", token });
        }
      }
      const nome = `TRÍADE ${new Date().toISOString().slice(0, 19).replace("T", " ")} ${crypto.randomUUID().slice(0, 4)}`;
      const f = (await exigirOk(await chamar("/factors", { token, corpo: { factor_type: "totp", friendly_name: nome } }))) as {
        id: string;
        totp: { qr_code: string; secret: string };
      };
      return { factorId: f.id, qrCode: f.totp.qr_code, segredo: f.totp.secret };
    },

    async verificarTotp(token, factorId, codigo) {
      const id = encodeURIComponent(factorId);
      const desafio = (await exigirOk(await chamar(`/factors/${id}/challenge`, { token, corpo: {} }))) as { id: string };
      const r = await chamar(`/factors/${id}/verify`, { token, corpo: { challenge_id: desafio.id, code: codigo } });
      if (r.status === 400 || r.status === 422) return null;
      return sessao((await exigirOk(r)) as TokenGoTrue);
    },

    async portador(token) {
      const r = await chamar("/user", { token });
      if (r.status === 401 || r.status === 403) return null;
      const u = (await exigirOk(r)) as { id: string; email_confirmed_at?: string | null; factors?: { factor_type: string; status: string }[] };
      const claims = claimsJwt(token);
      if (typeof claims.session_id !== "string") return null;
      return {
        userId: u.id,
        aal: claims.aal === "aal2" ? "aal2" : "aal1",
        emailVerificado: Boolean(u.email_confirmed_at),
        temAutenticador: (u.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified"),
        sessaoId: claims.session_id,
      };
    },

    async renovar(refreshToken) {
      const r = await chamar("/token?grant_type=refresh_token", { corpo: { refresh_token: refreshToken } });
      if (r.status === 400 || r.status === 401) return null;
      return sessao((await exigirOk(r)) as TokenGoTrue);
    },

    async sair(token) {
      await chamar("/logout?scope=local", { token, corpo: {} });
    },

    async sairDeTodas(token) {
      const r = await chamar("/logout?scope=global", { token, corpo: {} });
      if (!r.ok && r.status !== 204) throw new Error(`Auth respondeu ${r.status}`);
    },

    async pedirRecuperacao(email, voltarPara) {
      const r = await chamar(`/recover?redirect_to=${encodeURIComponent(voltarPara)}`, { corpo: { email } });
      // 429 é o limite do próprio Auth; para quem pediu, a resposta continua a mesma.
      if (!r.ok && r.status !== 429) throw new Error(`Auth respondeu ${r.status}`);
    },

    async usarRecuperacao(tokenHash) {
      const r = await chamar("/verify", { corpo: { type: "recovery", token_hash: tokenHash } });
      if (r.status >= 400 && r.status < 500) return null;
      return sessao((await exigirOk(r)) as TokenGoTrue);
    },

    async usarConvite(tokenHash) {
      const r = await chamar("/verify", { corpo: { type: "invite", token_hash: tokenHash } });
      if (r.status >= 400 && r.status < 500) return null;
      return sessao((await exigirOk(r)) as TokenGoTrue);
    },

    async trocarSenha(token, novaSenha) {
      const r = await chamar("/user", { method: "PUT", token, corpo: { password: novaSenha } });
      if (r.status === 422 || r.status === 400) return "FRACA"; // weak_password (inclui senha vazada) ou same_password
      await exigirOk(r);
      return "OK";
    },
  };
}

/**
 * Convites (CF-02, PI-10), com a chave de serviço e só no servidor. Quem já tem conta (síndico
 * profissional, MU-04) não recebe e-mail novo: o acesso aparece no próximo login.
 */
export interface AdminAuth {
  convidar(email: string, voltarPara: string): Promise<{ userId: string; contaNova: boolean }>;
}

export function adminGoTrue(url: string, chaveServico: string, buscar: typeof fetch = fetch): AdminAuth {
  async function chamar(caminho: string, corpo?: unknown): Promise<Response> {
    return await buscar(`${url}/auth/v1${caminho}`, {
      method: corpo === undefined ? "GET" : "POST",
      headers: { apikey: chaveServico, authorization: `Bearer ${chaveServico}`, "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(8000),
    });
  }

  async function acharPorEmail(email: string): Promise<string | null> {
    const r = await chamar(`/admin/users?filter=${encodeURIComponent(email)}&per_page=50`);
    if (!r.ok) throw new Error(`Auth respondeu ${r.status}`);
    const corpo = (await r.json()) as { users?: { id: string; email?: string }[] };
    return corpo.users?.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  }

  return {
    async convidar(email, voltarPara) {
      const existente = await acharPorEmail(email);
      if (existente) return { userId: existente, contaNova: false };
      const r = await chamar(`/invite?redirect_to=${encodeURIComponent(voltarPara)}`, { email });
      if (r.status === 422) {
        // Criada entre a busca e o convite: é conta existente.
        const id = await acharPorEmail(email);
        if (id) return { userId: id, contaNova: false };
      }
      if (!r.ok) throw new Error(`Auth respondeu ${r.status}`);
      const u = (await r.json()) as { id: string };
      return { userId: u.id, contaNova: true };
    },
  };
}
