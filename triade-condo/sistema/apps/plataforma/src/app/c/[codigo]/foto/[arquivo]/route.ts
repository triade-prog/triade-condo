// Foto do comunicado dentro do e-mail (CD-13): o programa de e-mail pede a imagem por este
// endereço fixo e recebe um link de 5 minutos do armazenamento privado. Abrir a foto não conta
// como leitura: não é rastreio.
import { criarRepasse, opcoesPlataforma } from "@triade/servidor/repasse";

export const dynamic = "force-dynamic";

const repassar = criarRepasse(() => opcoesPlataforma(process.env));
const CODIGO = /^[A-Za-z0-9_-]{14,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, ctx: { params: Promise<{ codigo: string; arquivo: string }> }) {
  const { codigo, arquivo } = await ctx.params;
  if (!CODIGO.test(codigo) || !UUID.test(arquivo)) return new Response(null, { status: 404 });
  const r = await repassar(new Request(new URL(`/api/v1/publico/c/${codigo}/arquivos/${arquivo}`, req.url), { headers: req.headers }), {
    params: Promise.resolve({ path: ["v1", "publico", "c", codigo, "arquivos", arquivo] }),
  });
  const d = (await r.json().catch(() => null)) as { url?: string } | null;
  if (!r.ok || !d?.url) return new Response(null, { status: r.status === 200 ? 404 : r.status, headers: { "cache-control": "no-store" } });
  return new Response(null, { status: 302, headers: { location: d.url, "cache-control": "no-store" } });
}
