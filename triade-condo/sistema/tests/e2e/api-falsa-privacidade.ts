// Privacidade e dados falsa (F0.11; quadros 350 a 359): o catálogo dos 32 tipos, a última rodada,
// o que vence nos próximos 30 dias, as guardas por obrigação legal (guardar, tirar a marca e o selo
// da ficha) e Dados de uma pessoa (buscar, baixar a planilha e remover). Pessoas, telefones e
// e-mails são fictícios (PT-14). As regras de verdade estão no banco (pgTAP 044) e na API (Deno);
// aqui se confere a tela.
import type { Route } from "@playwright/test";

type Json = Record<string, unknown>;

const t = (numero: number, codigo: string, sistema: string, grupo: string, nome: string, oQue: string, paraQue: string, base: string, quem: string,
  prazo: string, noFim: string, situacao: string) => ({ numero, codigo, sistema, grupo, nome, oQue, paraQue, base, quem, prazo, noFim, situacao });

/** Os 32 tipos, como em 0301_retencao_dados.sql. */
export const TIPOS_RETENCAO = [
  t(1, "EQUIPE_CONDOMINIO", "PLATAFORMA", "Pessoas", "Equipe do condomínio", "Nome e e-mail de entrada", "Entrar e responder pelo que fez", "Execução do contrato", "Condomínio; TRÍADE opera", "90 dias depois de perder o acesso", "A entrada é apagada; o nome fica no histórico", "A_FAZER"),
  t(2, "SESSAO", "PLATAFORMA", "Pessoas", "Sessões de entrada", "Em que condomínio a pessoa está", "Manter a pessoa conectada", "Execução do contrato", "Condomínio; TRÍADE opera", "30 dias sem uso", "Apagadas", "A_FAZER"),
  t(3, "CONTATO", "PLATAFORMA", "Pessoas", "Contato de morador", "Nome, telefone, e-mail, aniversário", "Comunicar e atender", "Execução do contrato; legítimo interesse", "Condomínio; TRÍADE opera", "180 dias depois de sair da última unidade", "Os dados são apagados; fica “contato removido”", "NA_ROTINA"),
  t(4, "FAMILIA", "PLATAFORMA", "Pessoas", "Família", "Nome, parentesco, aniversário", "Saber quem mora", "Legítimo interesse", "Condomínio; TRÍADE opera", "90 dias depois de sair", "Nome e aniversário apagados", "NA_ROTINA"),
  t(5, "PET", "PLATAFORMA", "Pessoas", "Pets", "Nome, espécie, raça", "Saber quem mora", "Legítimo interesse", "Condomínio; TRÍADE opera", "90 dias depois de sair", "Nome, raça e observação apagados", "NA_ROTINA"),
  t(6, "VEICULO", "PLATAFORMA", "Pessoas", "Veículos", "Placa e modelo", "Garagem e portaria", "Legítimo interesse", "Condomínio; TRÍADE opera", "90 dias depois de retirado", "Placa e modelo apagados", "NA_ROTINA"),
  t(7, "CADASTRO_LINK", "PLATAFORMA", "Pessoas", "Cadastro por link", "O que o morador mandou", "Receber o cadastro", "Execução do contrato", "Condomínio; TRÍADE opera", "30 dias depois de aprovado", "A cópia é apagada; o cadastro fica na unidade", "NA_ROTINA"),
  t(8, "PEDIDO", "PLATAFORMA", "Pedidos e manutenção", "Pedidos", "Relato, local, unidade, quem pediu", "Atender e provar o que foi feito", "Execução do contrato; legítimo interesse", "Condomínio; TRÍADE opera", "Enquanto o condomínio for cliente", "Ficam; quem pediu some quando o contato é removido", "FICA"),
  t(9, "ARQUIVO_SERVICO", "PLATAFORMA", "Pedidos e manutenção", "Fotos e arquivos", "De pedidos, manutenções e prestadores", "Prova do serviço", "Legítimo interesse", "Condomínio; TRÍADE opera", "5 anos depois de encerrado", "O arquivo é apagado; fica “apagado pelo prazo”", "A_FAZER"),
  t(10, "MANUTENCAO", "PLATAFORMA", "Pedidos e manutenção", "Manutenções e preventivas", "O que foi feito, por quem, quando", "Memória do prédio", "Legítimo interesse; obrigação legal", "Condomínio; TRÍADE opera", "Enquanto o condomínio for cliente", "Ficam", "FICA"),
  t(11, "MENSAGEM", "PLATAFORMA", "Comunicação", "Mensagens de WhatsApp", "Texto, áudio, foto, número", "Virar pedido", "Execução do contrato", "Condomínio; TRÍADE e Wafly operam", "90 dias se não virou pedido; se virou, segue o pedido", "Texto, mídia e número apagados", "NA_ROTINA"),
  t(12, "CONVERSA", "PLATAFORMA", "Comunicação", "Conversas em andamento", "Em que passo a conversa está", "Continuar a conversa", "Execução do contrato", "Condomínio; TRÍADE opera", "30 dias sem mensagem", "Apagadas", "NA_ROTINA"),
  t(13, "TRANSCRICAO", "PLATAFORMA", "Comunicação", "Transcrição de áudio", "O texto do áudio", "Ler o áudio", "Execução do contrato", "Condomínio; TRÍADE opera", "Segue a mensagem", "Apagada junto", "NA_ROTINA"),
  t(14, "ENVIO", "PLATAFORMA", "Comunicação", "Envios de WhatsApp e e-mail", "Número, endereço, texto", "Enviar e provar que enviou", "Execução do contrato", "Condomínio; TRÍADE, Wafly e Resend operam", "12 meses", "Ficam só a data e a situação", "NA_ROTINA"),
  t(15, "AVISO", "PLATAFORMA", "Comunicação", "Avisos do app", "Aviso para a equipe", "Avisar", "Execução do contrato", "Condomínio; TRÍADE opera", "12 meses depois de visto", "Apagados", "NA_ROTINA"),
  t(16, "COMUNICADO", "PLATAFORMA", "Comunicação", "Comunicados", "Texto e para quem foi", "Comunicar", "Execução do contrato", "Condomínio; TRÍADE opera", "Enquanto o condomínio for cliente", "Ficam", "FICA"),
  t(17, "DOCUMENTO", "PLATAFORMA", "Documentos e memória", "Documentos e atas", "Arquivos e versões", "Memória do prédio", "Legítimo interesse; obrigação legal", "Condomínio; TRÍADE opera", "Enquanto o condomínio for cliente", "Ficam", "FICA"),
  t(18, "PEDIDO_DOCUMENTO", "PLATAFORMA", "Comunicação", "Pedidos de documento", "E-mail de quem pediu", "Enviar o documento", "Execução do contrato", "Condomínio; TRÍADE opera", "12 meses", "E-mail apagado", "NA_ROTINA"),
  t(19, "RESERVA", "PLATAFORMA", "Portaria e vida em condomínio", "Reservas", "Unidade, quem reservou, observação", "Usar a área comum", "Execução do contrato", "Condomínio; TRÍADE opera", "24 meses depois da data", "Ficam só a unidade e a data", "NA_ROTINA"),
  t(20, "VOTACAO", "PLATAFORMA", "Portaria e vida em condomínio", "Enquetes e assembleias", "Presença, procurador, votos", "Provar a decisão", "Obrigação legal", "Condomínio; TRÍADE opera", "Enquanto o condomínio for cliente", "Ficam; o voto secreto não mostra quem votou", "FICA"),
  t(21, "CLASSIFICADO", "PLATAFORMA", "Portaria e vida em condomínio", "Classificados", "Texto, foto, telefone", "Anunciar no prédio", "Legítimo interesse", "Condomínio; TRÍADE opera", "90 dias depois de sair do mural", "Texto e foto apagados", "NA_ROTINA"),
  t(22, "ENCOMENDA", "PLATAFORMA", "Portaria e vida em condomínio", "Encomendas", "Remetente, quem retirou, foto da etiqueta", "Provar a entrega", "Legítimo interesse", "Condomínio; TRÍADE opera", "Foto: 90 dias depois de entregue; nomes: 12 meses", "Apagados", "NA_ROTINA"),
  t(23, "PRESTADOR", "PLATAFORMA", "Pedidos e manutenção", "Prestadores", "Nome, telefone, e-mail, CPF ou CNPJ", "Contratar e chamar", "Execução do contrato", "Condomínio; TRÍADE opera", "5 anos depois de arquivado", "Contato e documento apagados; o nome fica", "A_FAZER"),
  t(24, "CHAMADO", "PLATAFORMA", "Documentos e memória", "Chamados de suporte", "Mensagens, imagens, dados conferidos", "Suporte da TRÍADE", "Execução do contrato", "Condomínio; TRÍADE opera", "Imagens: 24 meses depois de resolvido", "Imagens apagadas", "NA_ROTINA"),
  t(25, "EXPORTACAO", "PLATAFORMA", "Documentos e memória", "Exportações", "O arquivo com tudo", "Entregar os dados ao condomínio", "Execução do contrato", "Condomínio; TRÍADE opera", "7 dias", "O arquivo é apagado", "NA_ROTINA"),
  t(26, "LINK", "PLATAFORMA", "Documentos e memória", "Links e códigos sem conta", "Só o resumo do código", "Abrir sem conta", "Execução do contrato", "Condomínio; TRÍADE opera", "90 dias depois de vencer", "Apagados", "NA_ROTINA"),
  t(27, "HISTORICO", "PLATAFORMA", "Documentos e memória", "Histórico", "Quem fez o quê e quando, sem dado pessoal", "Nada some em silêncio", "Legítimo interesse", "Condomínio; TRÍADE opera", "Enquanto o condomínio for cliente", "Fica", "FICA"),
  t(28, "RELATORIO", "PLATAFORMA", "Documentos e memória", "Relatórios do mês e dossiês", "Resumo do que aconteceu", "Prestar contas", "Execução do contrato", "Condomínio; TRÍADE opera", "Enquanto o condomínio for cliente", "Ficam", "FICA"),
  t(29, "EQUIPE_TRIADE", "CONSOLE", "Console TRÍADE", "Equipe TRÍADE", "Nome, entrada, funções", "Trabalhar e responder pelo que fez", "Execução do contrato", "TRÍADE", "90 dias depois de sair", "A entrada é apagada; o nome fica", "A_FAZER"),
  t(30, "CLIENTE", "CONSOLE", "Console TRÍADE", "Clientes, contratos e cobrança", "Plano, cobranças, recebimentos", "Cobrar e cumprir o fisco", "Obrigação legal", "TRÍADE", "5 anos depois do fim do contrato", "Apagados", "A_FAZER"),
  t(31, "NOTA_INTERNA", "CONSOLE", "Console TRÍADE", "Notas internas e acessos excepcionais", "O que a equipe anotou", "Atender o cliente", "Legítimo interesse", "TRÍADE", "Até o fim do contrato", "Seguem o fim do contrato", "FICA"),
  t(32, "COMERCIAL", "CONSOLE", "Console TRÍADE", "Comercial", "Interessados e propostas", "Vender", "Legítimo interesse", "TRÍADE", "12 meses sem contato", "Apagados", "A_FAZER"),
];

function erro(route: Route, status: number, codigo: string, detalhes?: Json) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

/** Hoje às 03:10 em Brasília (06:10 UTC), para a última rodada aparecer como "Hoje, 03:10". */
export function hojeAs0310(diasAtras = 0): string {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.now() - diasAtras * 86_400_000));
  return `${dia}T06:10:00Z`;
}

const ID_PAULO = "5c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e51";
const ID_HELENA = "5c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e52";
const ID_RITA = "5c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e53";
export const ENCOMENDA_GUARDADA = "6d2e3f4a-5b6c-4d7e-8f9a-1b2c3d4e5f61";

const parte = (p: string, quantos: number, extra: Json = {}) => ({ parte: p, quantos, ...extra });

export function criarPrivacidade() {
  const guardas: Json[] = [
    { id: "7e3f4a5b-6c7d-4e8f-9a0b-2c3d4e5f6a71", entidade: "ENCOMENDA", alvoId: ENCOMENDA_GUARDADA, motivo: "AUTORIDADE", detalhe: "ofício da delegacia",
      guardadaEm: "2026-08-20T13:00:00Z", guardadaPor: "Ana Souza", versao: 1, titulo: "Encomenda de 14/08/2026", detalheAlvo: "Torre A · 101" },
  ];
  const pessoas = [
    {
      contato: { id: ID_PAULO, nome: "Paulo Souza", telefone: "+5561998765432", email: "paulo.souza@exemplo.com.br", aniversarioDia: 12, aniversarioMes: 3, versao: 2 },
      situacao: { mora: false, pedidoAberto: null, guarda: null, saiuEm: "2026-08-15T15:00:00Z", apagaEm: "2027-02-11T15:00:00Z" },
      onde: [
        parte("UNIDADES", 1, { ativos: 0, itens: [{ unidade: "Torre A · 302", estado: "ENCERRADO", relacao: "INQUILINO", desde: "2024-02-01T12:00:00Z", saiuEm: "2026-08-15T15:00:00Z" }] }),
        parte("PEDIDOS", 4, { abertos: 0 }), parte("MENSAGENS", 27, { semPedido: 12 }), parte("ENVIOS", 41), parte("RESERVAS", 3), parte("ENCOMENDAS", 6),
        parte("ENQUETES", 2), parte("CLASSIFICADOS", 0),
        parte("VEICULOS", 1, { itens: [{ placa: "JKL4B21", modelo: "Hatch prata", retiradoEm: "2026-08-15T15:00:00Z" }] }),
      ],
    },
    {
      contato: { id: ID_HELENA, nome: "Helena Prado", telefone: "+5561997776655", email: null, aniversarioDia: null, aniversarioMes: null, versao: 1 },
      situacao: { mora: true, pedidoAberto: null, guarda: null, saiuEm: null, apagaEm: null },
      onde: [
        parte("UNIDADES", 1, { ativos: 1, itens: [{ unidade: "Torre B · 801", estado: "CONFIRMADO", relacao: "PROPRIETARIO", desde: "2023-05-10T12:00:00Z", saiuEm: null }] }),
        parte("PEDIDOS", 2, { abertos: 0 }), parte("MENSAGENS", 5, { semPedido: 1 }), parte("ENVIOS", 9), parte("RESERVAS", 0), parte("ENCOMENDAS", 0),
        parte("ENQUETES", 1), parte("CLASSIFICADOS", 0), parte("VEICULOS", 0, { itens: [] }),
      ],
    },
    {
      contato: { id: ID_RITA, nome: "Rita Campos", telefone: "+5561996665544", email: "rita.campos@exemplo.com.br", aniversarioDia: null, aniversarioMes: null, versao: 1 },
      situacao: { mora: false, pedidoAberto: "2026-0003", guarda: null, saiuEm: "2026-09-30T15:00:00Z", apagaEm: null },
      onde: [
        parte("UNIDADES", 1, { ativos: 0, itens: [{ unidade: "Torre A · 201", estado: "ENCERRADO", relacao: "PROPRIETARIO", desde: "2022-01-10T12:00:00Z", saiuEm: "2026-09-30T15:00:00Z" }] }),
        parte("PEDIDOS", 1, { abertos: 1 }), parte("MENSAGENS", 0, { semPedido: 0 }), parte("ENVIOS", 3), parte("RESERVAS", 0), parte("ENCOMENDAS", 0),
        parte("ENQUETES", 0), parte("CLASSIFICADOS", 0), parte("VEICULOS", 0, { itens: [] }),
      ],
    },
  ];
  return {
    modo: "CONTANDO" as "CONTANDO" | "APAGANDO",
    ultimaRodada: { em: hojeAs0310(), modo: "CONTANDO", total: 46 } as Json | null,
    vencidos: 46,
    proximos30: 128,
    guardas,
    pessoas,
    /** Quem teve os dados removidos, com o motivo, para o teste conferir. */
    removidos: [] as { id: string; motivo: string }[],
    /** As guardas tiradas, com o motivo. */
    tiradas: [] as { id: string; motivo: string }[],
    buscas: [] as string[],
  };
}

export type PrivacidadeFalsa = ReturnType<typeof criarPrivacidade>;

const digitos = (s: string) => s.replace(/\D/g, "");
/** DDD e os 8 últimos dígitos: acha com ou sem o nono dígito. */
const chaveTelefone = (s: string) => { const d = digitos(s).replace(/^55(?=\d{10,11}$)/, ""); return d.length >= 10 ? `${d.slice(0, 2)}${d.slice(-8)}` : null; };

/** As rotas de /v1/condominio/privacidade. Devolve null quando o caminho não é daqui. */
export async function rotasPrivacidade(route: Route, p: PrivacidadeFalsa, caminho: string, metodo: string, corpo: Json, pode: (a: string) => boolean,
  ctx: { eu: string; pedido: (id: string) => { protocolo: string; assunto: string } | undefined }) {
  if (!caminho.startsWith("/v1/condominio/privacidade")) return null;
  const resto = caminho.slice("/v1/condominio/privacidade".length);
  const ativas = () => p.guardas.filter((g) => !g.retiradaEm);
  if (resto === "" && metodo === "GET") {
    if (!pode("privacidade.ver")) return erro(route, 403, "FORBIDDEN");
    return route.fulfill({ json: {
      modo: p.modo, ultimaRodada: p.ultimaRodada, vencidos: p.vencidos, proximos30: p.proximos30, podeCuidar: pode("privacidade.cuidar"),
      guardados: ativas(), tipos: TIPOS_RETENCAO.filter((x) => x.sistema === "PLATAFORMA").map(({ sistema: _s, quem: _q, ...x }) => x),
    } });
  }
  const g1 = /^\/guardas\/(PEDIDO|MANUTENCAO|ENCOMENDA|CONTATO)\/([^/]+)$/.exec(resto);
  if (g1 && metodo === "GET") {
    if (!pode("privacidade.ver")) return erro(route, 403, "FORBIDDEN");
    return route.fulfill({ json: { guarda: ativas().find((g) => g.entidade === g1[1] && g.alvoId === g1[2]) ?? null } });
  }
  if (!pode("privacidade.cuidar")) return erro(route, 403, "FORBIDDEN");
  if (resto === "/guardas" && metodo === "POST") {
    const entidade = String(corpo.entidade);
    const motivo = String(corpo.motivo ?? "");
    const detalhe = typeof corpo.detalhe === "string" ? corpo.detalhe.trim() : "";
    if (!["PEDIDO", "MANUTENCAO", "ENCOMENDA", "CONTATO"].includes(entidade)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["entidade"] });
    if (!["PROCESSO", "SINISTRO", "AUTORIDADE", "OUTRO"].includes(motivo)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    if ((motivo === "OUTRO" && detalhe.length < 3) || (detalhe && (detalhe.length < 3 || detalhe.length > 500))) return erro(route, 400, "VALIDATION_ERROR", { campos: ["detalhe"] });
    if (ativas().some((g) => g.entidade === entidade && g.alvoId === corpo.alvoId)) return erro(route, 422, "VALIDATION_ERROR", { motivo: "JA_GUARDADO" });
    const ped = entidade === "PEDIDO" ? ctx.pedido(String(corpo.alvoId)) : undefined;
    const pessoa = entidade === "CONTATO" ? p.pessoas.find((x) => x.contato.id === corpo.alvoId) : undefined;
    const rotulo = ped ? { titulo: `Pedido ${ped.protocolo}`, detalheAlvo: ped.assunto }
      : pessoa ? { titulo: pessoa.contato.nome, detalheAlvo: "Pessoa" }
        : entidade === "MANUTENCAO" ? { titulo: "Manutenção", detalheAlvo: "Manutenção do prédio" } : { titulo: "Encomenda", detalheAlvo: "Portaria" };
    const g: Json = { id: crypto.randomUUID(), entidade, alvoId: corpo.alvoId, motivo, detalhe: detalhe || null, guardadaEm: new Date().toISOString(),
      guardadaPor: ctx.eu, versao: 1, ...rotulo };
    p.guardas.unshift(g);
    if (pessoa) (pessoa.situacao as Json).guarda = g;
    return route.fulfill({ status: 201, json: g });
  }
  const tirar = /^\/guardas\/([^/]+)\/tirar$/.exec(resto);
  if (tirar && metodo === "POST") {
    const g = p.guardas.find((x) => x.id === tirar[1]);
    if (!g) return erro(route, 404, "NOT_FOUND");
    if (g.retiradaEm) return erro(route, 422, "VALIDATION_ERROR", { motivo: "GUARDA_RETIRADA" });
    if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    if (corpo.versao !== g.versao) return erro(route, 409, "VERSION_CONFLICT");
    g.retiradaEm = new Date().toISOString();
    p.tiradas.push({ id: String(g.id), motivo: String(corpo.motivo) });
    for (const x of p.pessoas) if ((x.situacao.guarda as Json | null)?.id === g.id) (x.situacao as Json).guarda = null;
    return route.fulfill({ json: { ok: true } });
  }
  if (resto === "/dados-pessoa" && metodo === "POST") {
    const busca = String(corpo.busca ?? "").trim();
    const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(busca) ? busca.toLowerCase() : null;
    const tel = email ? null : chaveTelefone(busca);
    if (!email && !tel) return erro(route, 400, "VALIDATION_ERROR", { campos: ["busca"] });
    p.buscas.push(busca);
    const achadas = p.pessoas.filter((x) => !p.removidos.some((r) => r.id === x.contato.id))
      .filter((x) => (email ? x.contato.email?.toLowerCase() === email : chaveTelefone(x.contato.telefone) === tel));
    return route.fulfill({ json: { pessoas: achadas } });
  }
  const planilha = /^\/dados-pessoa\/([^/]+)\/planilha$/.exec(resto);
  if (planilha && metodo === "GET") {
    const x = p.pessoas.find((y) => y.contato.id === planilha[1]);
    if (!x) return erro(route, 404, "NOT_FOUND");
    const csv = `Parte;Quando;O que\r\nCadastro;2024-02-01;${x.contato.nome} · ${x.contato.telefone}\r\n`;
    return route.fulfill({ status: 200, body: csv, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="dados-${x.contato.nome.toLowerCase().replace(/\s+/g, "-")}.csv"` } });
  }
  const remover = /^\/dados-pessoa\/([^/]+)\/remover$/.exec(resto);
  if (remover && metodo === "POST") {
    const x = p.pessoas.find((y) => y.contato.id === remover[1]);
    if (!x || p.removidos.some((r) => r.id === x.contato.id)) return erro(route, 404, "NOT_FOUND");
    if (!["PEDIDO", "OUTRO"].includes(String(corpo.motivo))) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    if (corpo.versao !== x.contato.versao) return erro(route, 409, "VERSION_CONFLICT");
    if (x.situacao.mora) return erro(route, 422, "VALIDATION_ERROR", { motivo: "CONTATO_COM_UNIDADE" });
    if (x.situacao.pedidoAberto) return erro(route, 422, "VALIDATION_ERROR", { motivo: "CONTATO_COM_PEDIDO_ABERTO" });
    if (x.situacao.guarda) return erro(route, 422, "VALIDATION_ERROR", { motivo: "CONTATO_GUARDADO" });
    p.removidos.push({ id: x.contato.id, motivo: String(corpo.motivo) });
    return route.fulfill({ json: { arquivos: 3 } });
  }
  return erro(route, 404, "NOT_FOUND");
}
