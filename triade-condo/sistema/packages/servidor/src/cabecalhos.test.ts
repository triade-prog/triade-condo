import { describe, expect, it } from "vitest";
import { cabecalhosSeguranca, gerarNonce, montarCsp, origemArmazenamento } from "./cabecalhos.ts";

describe("F0.8: cabeçalhos de segurança e CSP com nonce", () => {
  it("o nonce muda a cada requisição", () => {
    const a = gerarNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(gerarNonce()).not.toBe(a);
  });

  it("scripts só com o nonce; nada de frame, objeto ou origem de fora", () => {
    const csp = montarCsp({ nonce: "abc" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/https?:\/\//);
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("PT-07: a Plataforma libera só o caminho dos objetos do armazenamento privado", () => {
    const origem = origemArmazenamento("https://projeto.supabase.co/functions/v1");
    expect(origem).toBe("https://projeto.supabase.co/storage/v1/object/");
    const csp = montarCsp({ nonce: "abc", armazenamento: origem });
    expect(csp).toContain("connect-src 'self' https://projeto.supabase.co/storage/v1/object/");
    expect(csp).toContain("img-src 'self' data: blob: https://projeto.supabase.co/storage/v1/object/");
    expect(csp).toContain("frame-src 'none'");
    expect(origemArmazenamento(undefined)).toBeUndefined();
    expect(origemArmazenamento("http://projeto.supabase.co/functions/v1")).toBeUndefined();
    expect(montarCsp({ nonce: "abc" })).toContain("connect-src 'self';");
  });

  it("em desenvolvimento libera só o necessário para o recarregamento", () => {
    const csp = montarCsp({ nonce: "abc", dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("os dois sistemas fora de frame, de busca e de cache compartilhado", () => {
    for (const app of ["plataforma", "console"] as const) {
      const h = cabecalhosSeguranca(app);
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["X-Robots-Tag"]).toBe("noindex, nofollow");
      expect(h["Cache-Control"]).toBe("private, no-store");
      expect(h["Strict-Transport-Security"]).toMatch(/max-age=\d{8}/);
    }
  });

  it("o link de redefinir senha não vaza o token pelo referrer", () => {
    expect(cabecalhosSeguranca("plataforma", "/redefinir")["Referrer-Policy"]).toBe("no-referrer");
    expect(cabecalhosSeguranca("plataforma", "/")["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(cabecalhosSeguranca("console", "/o/Xr4abcdefghijklmnopqrstu")["Referrer-Policy"]).toBe("no-referrer");
    expect(cabecalhosSeguranca("console", "/a/abc23def45gh")["Referrer-Policy"]).toBe("no-referrer");
    expect(cabecalhosSeguranca("console", "/comercial/propostas")["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("MP-08: a câmera só no link do prestador, para ler a etiqueta", () => {
    expect(cabecalhosSeguranca("plataforma", "/p/codigo")["Permissions-Policy"]).toMatch(/^camera=\(self\),/);
    expect(cabecalhosSeguranca("plataforma", "/")["Permissions-Policy"]).toMatch(/^camera=\(\),/);
    expect(cabecalhosSeguranca("plataforma", "/pedidos")["Permissions-Policy"]).toMatch(/^camera=\(\),/);
  });

  it("a janela da Meta só na página do WhatsApp das Configurações da Plataforma (quadro 466)", () => {
    expect(cabecalhosSeguranca("plataforma", "/configuracoes/whatsapp")["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
    expect(cabecalhosSeguranca("plataforma", "/configuracoes")["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(cabecalhosSeguranca("console", "/configuracoes/whatsapp")["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    const csp = montarCsp({ nonce: "abc", janelaMeta: true });
    expect(csp).toContain("frame-src https://www.facebook.com https://web.facebook.com https://staticxx.facebook.com;");
    expect(csp).toContain("https://graph.facebook.com");
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic';");
    expect(montarCsp({ nonce: "abc" })).toContain("frame-src 'none';");
    // O SDK da Meta põe <style> sem nonce: só nessa página o estilo inline vale.
    expect(csp).toContain("style-src 'self' 'unsafe-inline';");
    expect(montarCsp({ nonce: "abc" })).toContain("style-src 'self' 'nonce-abc';");
  });
});
