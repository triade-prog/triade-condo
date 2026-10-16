// Repasse /api → Edge Function api-console (F0.8). A sessão é um cookie de primeira parte.
import { criarRepasse, opcoesConsole } from "@triade/servidor/repasse";

export const dynamic = "force-dynamic";

const repassar = criarRepasse(() => opcoesConsole(process.env));

export { repassar as GET, repassar as POST, repassar as PUT, repassar as PATCH, repassar as DELETE };
