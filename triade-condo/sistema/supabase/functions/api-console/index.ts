// Entrada da Edge Function api-console. As dependências reais ficam aqui; os testes montam o
// mesmo app com dependências falsas.

import { armazenamentoSupabase } from "../_shared/arquivos.ts";
import { adminGoTrue, authGoTrue } from "../_shared/auth.ts";
import { bancoPostgrest } from "../_shared/banco.ts";
import { criarApiConsole } from "./app.ts";

function exigir(nome: string): string {
  const v = Deno.env.get(nome);
  if (!v) throw new Error(`Falta a variável ${nome}`);
  return v;
}

const url = exigir("SUPABASE_URL");
const chaveServico = exigir("SUPABASE_SERVICE_ROLE_KEY");
const app = criarApiConsole(Deno.env.get("REPASSE_SEGREDO"), {
  banco: bancoPostgrest(url, chaveServico),
  auth: authGoTrue(url, exigir("SUPABASE_ANON_KEY")),
  admin: adminGoTrue(url, chaveServico),
  urlApp: exigir("CONSOLE_URL"),
  urlPlataforma: exigir("PLATAFORMA_URL"),
  armazenamentoSuporte: armazenamentoSupabase(url, chaveServico, fetch, "suporte"),
});

Deno.serve(app.fetch);
