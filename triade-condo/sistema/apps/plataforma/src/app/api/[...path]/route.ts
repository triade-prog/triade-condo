// Repasse /api → Edge Function api-plataforma (F0.8). A sessão é um cookie de primeira parte.
import { criarRepasse, opcoesPlataforma } from "@triade/servidor/repasse";

export const dynamic = "force-dynamic";

const repassar = criarRepasse(() => opcoesPlataforma(process.env));

export { repassar as GET, repassar as POST, repassar as PUT, repassar as PATCH, repassar as DELETE };
