// API do Console TRÍADE. Só a equipe ativa, sempre com o autenticador (F0.6, PT-08).
// Passo 1: carteira, ficha, cenário, convite do síndico, notas internas, histórico e equipe.
// Passo 5: a conexão do WhatsApp de cada cliente (piloto pelo Wafly, DC14).
// Planos e pagamentos (peças C3 e C4): plano, conjuntos contratados e liberados, cobranças e recebimentos.
// Quem pode o quê é decidido no banco (funções internas e clientes atribuídos, PI-10); aqui
// só se valida a entrada e se fala com o Auth para os convites.

import type { Context } from "hono";
import {
  abrirSuporteAcessoSchema,
  atribuirSchema,
  atualizarChamadoSchema,
  cadastrarMembroSchema,
  cenarioSchema,
  contratoSchema,
  convidarPessoaSchema,
  COOKIES_CONSOLE,
  criarCondominioSchema,
  decidirSuporteAcessoSchema,
  entregaSchema,
  ErroDominio,
  estagioSchema,
  etapaImplantacaoSchema,
  fichaSchema,
  FILTROS_CHAMADO,
  funcoesSchema,
  mascararEmail,
  notaSchema,
  pedirAcessoExcepcionalSchema,
  pendenciaImplantacaoSchema,
  resolverPendenciaImplantacaoSchema,
  responderChamadoSchema,
  trocaSindicoSchema,
  VALIDADE_LINK_ARQUIVO_S,
  verificarSuporteAcessoSchema,
  versaoSchema,
  credenciaisWhatsappSchema,
  CHAVES_MODELO,
  corpoModeloSchema,
  decidirModeloSchema,
  desconectarWhatsappSchema,
  editarModeloSchema,
  ajusteAnexarSchema,
  ajusteEtapaManutencaoSchema,
  ajusteEtapaSchema,
  ajusteFusoSchema,
  ajusteParecidosSchema,
  conferirParteSchema,
  abrirCompetenciaSchema,
  ajusteCobrancaSchema,
  conferirRecebimentoSchema,
  contratarConjuntoSchema,
  devolverRecebimentoSchema,
  identificarRecebimentoSchema,
  liberarConjuntoSchema,
  planoSchema,
  recebimentoSchema,
  suspenderConjuntoSchema,
  testarConjuntoSchema,
  valorCobrancaSchema,
} from "@triade/domain";
import type { Armazenamento } from "../_shared/arquivos.ts";
import type { AdminAuth } from "../_shared/auth.ts";
import { registrar } from "../_shared/registro.ts";
import { criarApp } from "../_shared/app.ts";
import { criarSessao, type DepsSessao, type VarsSessao } from "../_shared/sessao.ts";
import { lerCorpo } from "../_shared/validar.ts";
import { idDaRota, rotasConfiguracao } from "../_shared/rotas_configuracao.ts";
import { cifrarCredenciais, decifrarCredenciais, type ConectorWhatsapp, type CredenciaisWhatsapp } from "../_shared/whatsapp.ts";

export interface DepsConsole extends DepsSessao {
  admin: AdminAuth;
  /** Endereço do Console (links de senha e convite da equipe). */
  urlApp: string;
  /** Endereço da Plataforma (convite do síndico). */
  urlPlataforma: string;
  /** Imagens dos chamados de suporte (bucket "suporte"), só leitura no Console. */
  armazenamentoSuporte?: Armazenamento;
  /**
   * WhatsApp do condomínio (passo 5): o conector, a chave que cifra as credenciais e o endereço
   * da api-plataforma, onde chegam os avisos do provedor.
   */
  whatsapp?: { conector: ConectorWhatsapp; chave: CryptoKey; urlAvisos: string };
}

/** Área do acesso excepcional na rota (PI-11). */
const AREAS_ROTA: Record<string, "PEDIDOS" | "MORADORES" | "COMUNICADOS" | "MANUTENCAO"> = {
  pedidos: "PEDIDOS",
  moradores: "MORADORES",
  comunicados: "COMUNICADOS",
  manutencao: "MANUTENCAO",
};

interface LinhaCarteira {
  condominio_id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  estagio: string;
  cenario: string | null;
  funcoes: string[];
  situacoes: string[];
  criado_em: string;
}

interface LinhaHistorico {
  id: number;
  ocorrido_em: string;
  autor_tipo?: string;
  autor_id: string | null;
  autor_nome: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  dados: Record<string, unknown>;
  interno?: boolean;
  alvo_nome?: string | null;
}


function paginacao(c: Context): { p_antes: number | null; p_limite: number } {
  const antes = Number(c.req.query("antes"));
  const limite = Number(c.req.query("limite"));
  return {
    p_antes: Number.isInteger(antes) && antes > 0 ? antes : null,
    p_limite: Number.isInteger(limite) && limite > 0 ? Math.min(limite, 200) : 50,
  };
}

function historico(l: LinhaHistorico) {
  return {
    id: l.id,
    ocorridoEm: l.ocorrido_em,
    autor: l.autor_id ? { id: l.autor_id, nome: l.autor_nome } : null,
    acao: l.acao,
    entidade: l.entidade,
    entidadeId: l.entidade_id,
    dados: l.dados,
    ...(l.interno === undefined ? {} : { interno: l.interno }),
  };
}

// Na equipe, o evento diz de quem fala: o nome atual da pessoa, lido na hora pelo banco (D4.28).
function historicoEquipe(l: LinhaHistorico) {
  return { ...historico(l), alvo: l.alvo_nome && l.entidade_id ? { id: l.entidade_id, nome: l.alvo_nome } : null };
}

export function criarApiConsole(segredo: string | undefined, deps: DepsConsole) {
  const app = criarApp<VarsSessao>("api-console", segredo);
  const sessao = criarSessao(
    { sistema: "console", cookie: COOKIES_CONSOLE.sessao, autenticadorObrigatorio: true, funcaoAcesso: "acesso_console", urlApp: deps.urlApp },
    deps,
  );
  const rpc = deps.banco.rpc.bind(deps.banco);

  /** Convite pelo Auth, com limite por pessoa da equipe. */
  async function convidar(pessoaId: string, email: string, voltarPara: string) {
    if (!(await rpc<boolean>("limite_contar", { p_tipo: "convite", p_chave: pessoaId }))) throw new ErroDominio("RATE_LIMITED");
    return await deps.admin.convidar(email, `${voltarPara}/convite`);
  }

  app.get("/v1/saude", (c) => c.json({ ok: true, servico: "api-console" }));
  sessao.rotas(app);

  for (const rota of ["/v1/sessao", "/v1/clientes", "/v1/clientes/*", "/v1/equipe", "/v1/equipe/*", "/v1/contagens", "/v1/implantacoes",
                      "/v1/suporte-acesso", "/v1/chamados", "/v1/whatsapp", "/v1/whatsapp/*",
                      "/v1/pagamentos", "/v1/pagamentos/*"]) app.use(rota, sessao.exigirSessao);
  const pessoa = (c: Context<VarsSessao>) => c.get("sessao").pessoaId;

  // Quem está no Console: nome, funções e o que pode fazer fora de um cliente.
  app.get("/v1/sessao", async (c) => c.json(await rpc("console_sessao", { p_pessoa: pessoa(c) })));

  // Carteira (PI-01, V-10): só os clientes atribuídos.
  app.get("/v1/clientes", async (c) => {
    const linhas = await rpc<LinhaCarteira[]>("console_carteira", { p_pessoa: pessoa(c) });
    return c.json({
      clientes: linhas.map((l) => ({
        id: l.condominio_id,
        nome: l.nome,
        cidade: l.cidade,
        uf: l.uf,
        estagio: l.estagio,
        cenario: l.cenario,
        funcoes: l.funcoes,
        situacoes: l.situacoes,
        criadoEm: l.criado_em,
      })),
    });
  });

  app.post("/v1/clientes", async (c) => {
    const d = await lerCorpo(c, criarCondominioSchema);
    const id = await rpc<string>("console_criar_condominio", {
      p_pessoa: pessoa(c), p_nome: d.nome, p_cidade: d.cidade, p_uf: d.uf, p_cenario: d.cenario,
    });
    return c.json({ id }, 201);
  });

  // Ficha (PI-02, CF-01).
  app.get("/v1/clientes/:id", async (c) =>
    c.json(await rpc("console_ficha", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") })));

  app.put("/v1/clientes/:id/ficha", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, fichaSchema);
    const versao = await rpc<number>("console_editar_ficha", {
      p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_nome: d.nome, p_cidade: d.cidade, p_uf: d.uf,
      p_endereco: d.endereco, p_numero_whatsapp: d.numeroWhatsapp, p_contatos: d.contatos,
    });
    return c.json({ versao });
  });

  // Cenário (V-04, V-05, V-06, CF-12).
  app.put("/v1/clientes/:id/cenario", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, cenarioSchema);
    return c.json({ versao: await rpc<number>("console_escolher_cenario", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_cenario: d.cenario }) });
  });

  // Referência do contrato (PI-02): só administração.
  app.put("/v1/clientes/:id/contrato", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, contratoSchema);
    return c.json({
      versao: await rpc<number>("console_alterar_contrato", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_referencia: d.referenciaContrato }),
    });
  });

  // Estágio (PI-01).
  app.put("/v1/clientes/:id/estagio", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, estagioSchema);
    return c.json({
      versao: await rpc<number>("console_mudar_estagio", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_estagio: d.estagio, p_motivo: d.motivo }),
    });
  });

  // Convidar o síndico (CF-02): conta própria, ligada ao condomínio. A permissão é conferida
  // no banco antes do convite sair (console_ficha falha para quem não está atribuído).
  app.post("/v1/clientes/:id/sindicos", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, convidarPessoaSchema);
    const ficha = await rpc<{ permissoes: string[] }>("console_ficha", { p_pessoa: pessoa(c), p_condominio: id });
    if (!ficha.permissoes.includes("console.sindicos.convidar")) throw new ErroDominio("FORBIDDEN");
    const conta = await convidar(pessoa(c), d.email, deps.urlPlataforma);
    const vinculoId = await rpc<string>("console_vincular_sindico", {
      p_pessoa: pessoa(c), p_condominio: id, p_convidado: conta.userId, p_nome: d.nome,
    });
    return c.json({ vinculoId, contaNova: conta.contaNova }, 201);
  });

  // Notas internas (PI-06).
  app.get("/v1/clientes/:id/notas", async (c) => {
    const linhas = await rpc<{ id: string; texto: string; criado_em: string; autor_id: string; autor_nome: string | null }[]>(
      "console_notas", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") });
    return c.json({ notas: linhas.map((n) => ({ id: n.id, texto: n.texto, criadoEm: n.criado_em, autor: { id: n.autor_id, nome: n.autor_nome } })) });
  });

  app.post("/v1/clientes/:id/notas", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, notaSchema);
    return c.json({ id: await rpc<string>("console_escrever_nota", { p_pessoa: pessoa(c), p_condominio: id, p_texto: d.texto }) }, 201);
  });

  // Histórico administrativo do cliente (PI-12).
  app.get("/v1/clientes/:id/historico", async (c) => {
    const linhas = await rpc<LinhaHistorico[]>("console_historico", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id"), ...paginacao(c) });
    return c.json({ eventos: linhas.map(historico) });
  });

  // Atribuir e retirar pessoas da equipe no cliente (PI-10).
  app.post("/v1/clientes/:id/equipe", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, atribuirSchema);
    return c.json({ vinculoId: await rpc<string>("console_atribuir", { p_pessoa: pessoa(c), p_condominio: id, p_membro: d.pessoaId, p_funcao: d.funcao }) }, 201);
  });

  app.post("/v1/clientes/:id/equipe/:vinculo/retirar", async (c) => {
    const id = idDaRota(c, "id");
    const vinculo = idDaRota(c, "vinculo");
    const d = await lerCorpo(c, versaoSchema);
    return c.json({
      versao: await rpc<number>("console_retirar_atribuicao", { p_pessoa: pessoa(c), p_condominio: id, p_vinculo: vinculo, p_versao: d.versao }),
    });
  });

  // Equipe (PI-10): só administração.
  app.get("/v1/equipe", async (c) => {
    const linhas = await rpc<{ pessoa_id: string; nome: string; ativa: boolean; funcoes: string[]; desde: string }[]>(
      "console_equipe", { p_pessoa: pessoa(c) });
    return c.json({ pessoas: linhas.map((l) => ({ id: l.pessoa_id, nome: l.nome, ativa: l.ativa, funcoes: l.funcoes, desde: l.desde })) });
  });

  app.post("/v1/equipe", async (c) => {
    const d = await lerCorpo(c, cadastrarMembroSchema);
    // Confere a permissão antes de o convite sair.
    await rpc("console_equipe", { p_pessoa: pessoa(c) });
    const conta = await convidar(pessoa(c), d.email, deps.urlApp);
    await rpc("console_cadastrar_membro", { p_pessoa: pessoa(c), p_membro: conta.userId, p_nome: d.nome, p_funcoes: d.funcoes });
    return c.json({ pessoaId: conta.userId, contaNova: conta.contaNova }, 201);
  });

  app.put("/v1/equipe/:pessoa/funcoes", async (c) => {
    const membro = idDaRota(c, "pessoa");
    const d = await lerCorpo(c, funcoesSchema);
    await rpc("console_definir_funcoes", { p_pessoa: pessoa(c), p_membro: membro, p_funcoes: d.funcoes });
    return c.json({ ok: true });
  });

  app.post("/v1/equipe/:pessoa/desativar", async (c) => {
    await rpc("console_desativar_membro", { p_pessoa: pessoa(c), p_membro: idDaRota(c, "pessoa") });
    return c.json({ ok: true });
  });

  app.get("/v1/equipe/historico", async (c) => {
    const linhas = await rpc<LinhaHistorico[]>("console_historico_equipe", { p_pessoa: pessoa(c), ...paginacao(c) });
    return c.json({ eventos: linhas.map(historicoEquipe) });
  });


  // ---------------------------------------------------------------------------------------
  // Peça R4: implantação, troca de síndico, suporte de acesso, acesso excepcional e chamados.
  // A permissão de cada função interna (PI-10) é conferida no banco.

  app.get("/v1/contagens", async (c) => c.json(await rpc("console_contagens", { p_pessoa: pessoa(c) })));

  // Implantação (PI-04, PI-05, SH-01).
  app.get("/v1/implantacoes", async (c) => c.json({ implantacoes: await rpc("console_implantacoes", { p_pessoa: pessoa(c) }) }));

  app.get("/v1/clientes/:id/implantacao", async (c) =>
    c.json(await rpc("console_implantacao", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") })));

  app.put("/v1/clientes/:id/implantacao/etapas/:numero", async (c) => {
    const id = idDaRota(c, "id");
    const numero = Number(c.req.param("numero"));
    if (!Number.isInteger(numero) || numero < 1 || numero > 20) throw new ErroDominio("NOT_FOUND");
    const d = await lerCorpo(c, etapaImplantacaoSchema);
    return c.json({
      versao: await rpc<number>("console_salvar_etapa", {
        p_pessoa: pessoa(c), p_condominio: id, p_numero: numero, p_versao: d.versao, p_situacao: d.situacao,
        p_responsavel: d.responsavelId, p_substituto: d.substitutoId, p_feito: d.feito, p_motivo: d.motivo,
        p_modalidade: d.modalidade, p_quando: d.quando,
      }),
    });
  });

  async function salvarPendencia(c: Context<VarsSessao>, pendencia: string | null) {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, pendenciaImplantacaoSchema);
    if (pendencia && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc<{ id: string; versao: number }>("console_salvar_pendencia", {
      p_pessoa: pessoa(c), p_condominio: id, p_id: pendencia, p_versao: d.versao, p_etapa: d.etapa, p_texto: d.texto,
      p_com_quem: d.comQuem, p_responsavel: d.responsavelId, p_proximo_retorno: d.proximoRetorno,
    });
  }
  app.post("/v1/clientes/:id/implantacao/pendencias", async (c) => c.json(await salvarPendencia(c, null), 201));
  app.put("/v1/clientes/:id/implantacao/pendencias/:pendencia", async (c) => c.json(await salvarPendencia(c, idDaRota(c, "pendencia"))));

  app.post("/v1/clientes/:id/implantacao/pendencias/:pendencia/resolver", async (c) => {
    const id = idDaRota(c, "id");
    const pendencia = idDaRota(c, "pendencia");
    const d = await lerCorpo(c, resolverPendenciaImplantacaoSchema);
    return c.json({
      versao: await rpc<number>("console_resolver_pendencia", {
        p_pessoa: pessoa(c), p_condominio: id, p_id: pendencia, p_versao: d.versao, p_resolucao: d.resolucao,
      }),
    });
  });

  app.post("/v1/clientes/:id/implantacao/entregar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, entregaSchema);
    return c.json({ versao: await rpc<number>("console_entregar_implantacao", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_recado: d.recado }) });
  });

  // Configuração na implantação (PI-04, CF-01, CF-09, CF-12): a aba Configuração da ficha. As
  // partes do app passam pelas mesmas rotas e funções que a Plataforma usa; o banco só deixa
  // mudar enquanto o cliente está em implantação. Fuso, etapas e janelas são ajustes técnicos,
  // só daqui, com motivo depois da entrega. A fila de e-mail sai no próximo ciclo.
  const cliente = (c: Context<VarsSessao>) => ({ p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") });
  app.get("/v1/clientes/:id/configuracao", async (c) => c.json(await rpc("console_configuracao", cliente(c))));
  app.post("/v1/clientes/:id/configuracao/conferir", async (c) => {
    const d = await lerCorpo(c, conferirParteSchema);
    return c.json(await rpc("console_conferir_parte", { ...cliente(c), p_parte: d.parte, p_nota: d.nota ?? null }));
  });
  rotasConfiguracao(app, "/v1/clientes/:id/condominio", cliente, deps.banco);

  app.put("/v1/clientes/:id/condominio/fuso", async (c) => {
    const d = await lerCorpo(c, ajusteFusoSchema);
    return c.json({ versao: await rpc<number>("console_definir_fuso", { ...cliente(c), p_versao: d.versao, p_fuso: d.fuso, p_motivo: d.motivo ?? null }) });
  });
  app.put("/v1/clientes/:id/condominio/regras-parecidos", async (c) => {
    const d = await lerCorpo(c, ajusteParecidosSchema);
    return c.json({
      versao: await rpc<number>("console_definir_parecidos", { ...cliente(c), p_versao: d.versao, p_dias: d.dias, p_motivo: d.motivo ?? null }),
    });
  });
  app.put("/v1/clientes/:id/condominio/whatsapp/anexar", async (c) => {
    const d = await lerCorpo(c, ajusteAnexarSchema);
    return c.json({
      versao: await rpc<number>("console_definir_anexar", { ...cliente(c), p_versao: d.versao, p_minutos: d.minutos, p_motivo: d.motivo ?? null }),
    });
  });
  const salvarEtapaPedido = async (c: Context<VarsSessao>, etapa: string | null) => {
    const d = await lerCorpo(c, ajusteEtapaSchema);
    if (etapa && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc<{ id: string; versao: number }>("console_salvar_etapa_pedido", {
      ...cliente(c), p_id: etapa, p_versao: etapa ? d.versao : null, p_nome: d.nome, p_situacao: d.situacao ?? null,
      p_categoria: d.categoriaId ?? null, p_pausa_prazo: d.pausaPrazo ?? null, p_ativa: d.ativa ?? null, p_motivo: d.motivo ?? null,
    });
  };
  app.post("/v1/clientes/:id/condominio/etapas", async (c) => c.json(await salvarEtapaPedido(c, null), 201));
  app.put("/v1/clientes/:id/condominio/etapas/:etapa", async (c) => c.json(await salvarEtapaPedido(c, idDaRota(c, "etapa"))));
  const salvarEtapaManutencao = async (c: Context<VarsSessao>, etapa: string | null) => {
    const d = await lerCorpo(c, ajusteEtapaManutencaoSchema);
    if (etapa && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc<{ id: string; versao: number }>("console_salvar_etapa_manutencao", {
      ...cliente(c), p_id: etapa, p_versao: etapa ? d.versao : null, p_nome: d.nome, p_situacao: d.situacao ?? null,
      p_ativa: d.ativa ?? null, p_motivo: d.motivo ?? null,
    });
  };
  app.post("/v1/clientes/:id/condominio/etapas-manutencao", async (c) => c.json(await salvarEtapaManutencao(c, null), 201));
  app.put("/v1/clientes/:id/condominio/etapas-manutencao/:etapa", async (c) => c.json(await salvarEtapaManutencao(c, idDaRota(c, "etapa"))));

  // Troca de síndico (CT-01). Confere a permissão antes do convite; a troca é uma só operação no banco.
  app.post("/v1/clientes/:id/troca-sindico", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, trocaSindicoSchema);
    const ficha = await rpc<{ permissoes: string[] }>("console_ficha", { p_pessoa: pessoa(c), p_condominio: id });
    if (!ficha.permissoes.includes("console.troca.fazer")) throw new ErroDominio("FORBIDDEN");
    const conta = await convidar(pessoa(c), d.email, deps.urlPlataforma);
    const r = await rpc<{ trocaId: string; vinculoId: string; autorizados: unknown[] }>("console_trocar_sindico", {
      p_pessoa: pessoa(c), p_condominio: id, p_vinculo: d.vinculoId, p_versao: d.versao, p_novo: conta.userId, p_nome: d.nome,
      p_pedido_por: d.pedidoPor, p_canal: d.canal, p_conferido: d.conferido,
    });
    return c.json({ ...r, contaNova: conta.contaNova }, 201);
  });

  app.get("/v1/clientes/:id/trocas", async (c) =>
    c.json({ trocas: await rpc("console_trocas", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") }) }));

  // Suporte de acesso (PI-09). A equipe nunca vê nem escolhe senha: o link vai para o e-mail
  // já cadastrado, que aparece mascarado.
  app.get("/v1/suporte-acesso", async (c) => c.json({ pedidos: await rpc("console_suportes_acesso", { p_pessoa: pessoa(c) }) }));

  app.get("/v1/clientes/:id/pessoas-plataforma", async (c) =>
    c.json({ pessoas: await rpc("console_pessoas_plataforma", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") }) }));

  app.post("/v1/clientes/:id/suporte-acesso", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, abrirSuporteAcessoSchema);
    return c.json({
      id: await rpc<string>("console_abrir_suporte_acesso", {
        p_pessoa: pessoa(c), p_condominio: id, p_alvo: d.pessoaId, p_tipo: d.tipo, p_canal: d.canal, p_descricao: d.descricao,
      }),
    }, 201);
  });

  const pedidoSuporte = (c: Context<VarsSessao>) => ({ p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id"), p_id: idDaRota(c, "pedido") });

  app.get("/v1/clientes/:id/suporte-acesso/:pedido", async (c) => {
    const r = await rpc<{ pessoaId: string }>("console_suporte_acesso", pedidoSuporte(c));
    const email = await deps.admin.emailDe(r.pessoaId);
    return c.json({ ...r, emailMascarado: email ? mascararEmail(email) : null });
  });

  app.put("/v1/clientes/:id/suporte-acesso/:pedido/verificar", async (c) => {
    const ids = pedidoSuporte(c);
    const d = await lerCorpo(c, verificarSuporteAcessoSchema);
    return c.json({
      versao: await rpc<number>("console_verificar_suporte_acesso", {
        ...ids, p_versao: d.versao, p_tipo: d.tipo, p_dados_conferidos: d.dadosConferidos, p_canal_conhecido: d.canalConhecido,
      }),
    });
  });

  app.post("/v1/clientes/:id/suporte-acesso/:pedido/decidir", async (c) => {
    const ids = pedidoSuporte(c);
    const d = await lerCorpo(c, decidirSuporteAcessoSchema);
    const r = await rpc<{ situacao: string; pessoaId: string; versao: number }>("console_decidir_suporte_acesso", {
      ...ids, p_versao: d.versao, p_decisao: d.decisao, p_motivo: d.motivo,
    });
    if (r.situacao !== "ENVIADO" && r.situacao !== "AUTENTICADOR_TIRADO") return c.json(r);
    try {
      if (r.situacao === "ENVIADO") {
        const email = await deps.admin.emailDe(r.pessoaId);
        if (!email) throw new Error("conta sem e-mail");
        await deps.auth.pedirRecuperacao(email, `${deps.urlPlataforma}/redefinir`);
      } else {
        await deps.admin.removerAutenticadores(r.pessoaId);
      }
    } catch (e) {
      registrar("erro", { funcao: "api-console", rota: "suporte-acesso", erro: e });
      await rpc("console_falha_suporte_acesso", ids);
      throw new ErroDominio("INTERNAL_ERROR");
    }
    return c.json(r);
  });

  // Acesso excepcional (PI-11): pedido ao síndico; com a aprovação, só leitura e cada abertura
  // registrada no histórico do condomínio.
  app.get("/v1/clientes/:id/acessos-excepcionais", async (c) =>
    c.json(await rpc("console_acessos_excepcionais", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") })));

  app.post("/v1/clientes/:id/acessos-excepcionais", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, pedirAcessoExcepcionalSchema);
    return c.json({
      id: await rpc<string>("console_pedir_acesso_excepcional", {
        p_pessoa: pessoa(c), p_condominio: id, p_motivo: d.motivo, p_areas: d.areas, p_horas: d.horas, p_chamado: d.chamadoId,
      }),
    }, 201);
  });

  app.get("/v1/clientes/:id/excepcional/:area", async (c) => {
    const id = idDaRota(c, "id");
    const area = AREAS_ROTA[c.req.param("area") ?? ""];
    if (!area) throw new ErroDominio("NOT_FOUND");
    const quem = { p_pessoa: pessoa(c), p_condominio: id };
    const acesso = await rpc<{ validoAte: string }>("console_ler_excepcional", { ...quem, p_area: area });
    const pagina = Math.max(1, Number(c.req.query("pagina")) || 1);
    const busca = (c.req.query("busca") ?? "").trim().slice(0, 60) || null;
    let dados: unknown;
    if (area === "PEDIDOS") {
      dados = await rpc("plataforma_pedidos", {
        ...quem, p_situacao: "TODOS", p_responsavel: null, p_prioridade: null, p_categoria: null, p_atencao: null, p_busca: busca, p_pagina: pagina,
      });
    } else if (area === "MORADORES") {
      dados = await rpc("plataforma_moradores", { ...quem, p_busca: busca, p_estado: null, p_pagina: pagina });
    } else if (area === "MANUTENCAO") {
      dados = await rpc("plataforma_manutencoes", {
        ...quem, p_situacao: null, p_tipo: null, p_prestador: null, p_atencao: null, p_busca: busca, p_pagina: pagina,
      });
    } else {
      dados = {
        comunicados: await rpc("plataforma_comunicados", { ...quem, p_filtro: null, p_assunto: null, p_atencao: null, p_busca: busca, p_pagina: pagina }),
        documentos: await rpc("plataforma_documentos", { ...quem, p_filtro: null, p_busca: busca }),
      };
    }
    return c.json({ area, validoAte: acesso.validoAte, dados });
  });

  // Plano e conjuntos do cliente (peça C3; PI-03, CF-11, PI-16, PI-19, NG-06).
  app.get("/v1/clientes/:id/plano", async (c) => c.json(await rpc("console_plano", cliente(c))));

  app.put("/v1/clientes/:id/plano", async (c) => {
    const d = await lerCorpo(c, planoSchema);
    return c.json(await rpc("console_salvar_plano", {
      ...cliente(c), p_versao: d.versao, p_nome: d.nome, p_unidades_de: d.unidadesDe, p_unidades_ate: d.unidadesAte, p_valor: d.valor,
      p_ciclo: d.ciclo, p_dia_vencimento: d.diaVencimento, p_implantacao_valor: d.implantacaoValor,
      p_implantacao_sem_cobranca: d.implantacaoSemCobranca, p_implantacao_referencia: d.implantacaoReferencia,
      p_inicio_competencia: d.inicioCompetencia,
    }));
  });

  /** O conjunto da rota: só os quatro que se vendem; a base não tem rota. */
  function conjunto(c: Context<VarsSessao>) {
    const codigo = c.req.param("conjunto") ?? "";
    if (!["AGENDA", "MANUTENCAO", "VIDA", "COMUNICACAO_AMPLIADA"].includes(codigo)) throw new ErroDominio("NOT_FOUND");
    return { ...cliente(c), p_conjunto: codigo };
  }

  app.put("/v1/clientes/:id/conjuntos/:conjunto/contrato", async (c) => {
    const ids = conjunto(c);
    const d = await lerCorpo(c, contratarConjuntoSchema);
    return c.json(await rpc("console_contratar_conjunto", {
      ...ids, p_versao: d.versao, p_contratado: d.contratado, p_referencia: d.referencia ?? null, p_motivo: d.motivo ?? null,
    }));
  });

  app.post("/v1/clientes/:id/conjuntos/:conjunto/liberar", async (c) => {
    const ids = conjunto(c);
    const d = await lerCorpo(c, liberarConjuntoSchema);
    return c.json(await rpc("console_liberar_conjunto", { ...ids, p_versao: d.versao, p_referencia: d.referencia, p_motivo: d.motivo }));
  });

  app.post("/v1/clientes/:id/conjuntos/:conjunto/teste", async (c) => {
    const ids = conjunto(c);
    const d = await lerCorpo(c, testarConjuntoSchema);
    return c.json(await rpc("console_testar_conjunto", { ...ids, p_versao: d.versao, p_ate: d.ate, p_motivo: d.motivo }));
  });

  app.post("/v1/clientes/:id/conjuntos/:conjunto/suspender", async (c) => {
    const ids = conjunto(c);
    const d = await lerCorpo(c, suspenderConjuntoSchema);
    return c.json(await rpc("console_suspender_conjunto", { ...ids, p_versao: d.versao, p_porque: d.porque, p_motivo: d.motivo }));
  });

  // Pagamentos dos clientes (peça C4; PI-07, PI-08): só a equipe que pode; nada vai para o cliente.
  app.get("/v1/pagamentos", async (c) => c.json(await rpc("console_pagamentos", { p_pessoa: pessoa(c) })));

  app.post("/v1/pagamentos/competencias", async (c) => {
    const d = await lerCorpo(c, abrirCompetenciaSchema);
    return c.json(await rpc("console_abrir_competencia", { p_pessoa: pessoa(c), p_competencia: d.competencia }));
  });

  app.post("/v1/pagamentos/recebimentos", async (c) => {
    const d = await lerCorpo(c, recebimentoSchema);
    return c.json(await rpc("console_registrar_recebimento", {
      p_pessoa: pessoa(c), p_condominio: d.condominioId, p_cobranca: d.cobrancaId, p_valor: d.valor, p_recebido_em: d.recebidoEm,
      p_forma: d.forma, p_referencia: d.referencia,
    }), 201);
  });

  app.post("/v1/pagamentos/nao-identificados/:avulso/identificar", async (c) => {
    const d = await lerCorpo(c, identificarRecebimentoSchema);
    return c.json(await rpc("console_identificar_recebimento", {
      p_pessoa: pessoa(c), p_avulso: idDaRota(c, "avulso"), p_condominio: d.condominioId, p_cobranca: d.cobrancaId,
    }));
  });

  const recebimento = (c: Context<VarsSessao>) => ({ ...cliente(c), p_id: idDaRota(c, "recebimento") });

  app.post("/v1/clientes/:id/recebimentos/:recebimento/conferir", async (c) => {
    const ids = recebimento(c);
    const d = await lerCorpo(c, conferirRecebimentoSchema);
    return c.json(await rpc("console_conferir_recebimento", { ...ids, p_versao: d.versao }));
  });

  app.post("/v1/clientes/:id/recebimentos/:recebimento/devolver", async (c) => {
    const ids = recebimento(c);
    const d = await lerCorpo(c, devolverRecebimentoSchema);
    return c.json(await rpc("console_devolver_recebimento", { ...ids, p_versao: d.versao, p_motivo: d.motivo }));
  });

  const cobranca = (c: Context<VarsSessao>) => ({ ...cliente(c), p_id: idDaRota(c, "cobranca") });

  app.get("/v1/clientes/:id/cobrancas/:cobranca", async (c) => c.json(await rpc("console_cobranca", cobranca(c))));

  app.post("/v1/clientes/:id/cobrancas/:cobranca/ajustes", async (c) => {
    const ids = cobranca(c);
    const d = await lerCorpo(c, ajusteCobrancaSchema);
    return c.json(await rpc("console_ajustar_cobranca", { ...ids, p_tipo: d.tipo, p_valor: d.valor, p_motivo: d.motivo }), 201);
  });

  app.put("/v1/clientes/:id/cobrancas/:cobranca/valor", async (c) => {
    const ids = cobranca(c);
    const d = await lerCorpo(c, valorCobrancaSchema);
    return c.json(await rpc("console_definir_valor_cobranca", { ...ids, p_valor: d.valor, p_motivo: d.motivo }));
  });

  // Chamados (PI-17, PI-20).
  app.get("/v1/chamados", async (c) => {
    const filtro = c.req.query("filtro") ?? "ABERTOS";
    if (!(filtro in FILTROS_CHAMADO)) throw new ErroDominio("VALIDATION_ERROR", { campos: ["filtro"] });
    return c.json({ chamados: await rpc("console_chamados", { p_pessoa: pessoa(c), p_filtro: filtro }) });
  });

  const chamado = (c: Context<VarsSessao>) => ({ p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id"), p_id: idDaRota(c, "chamado") });

  app.get("/v1/clientes/:id/chamados/:chamado", async (c) => c.json(await rpc("console_chamado", chamado(c))));

  app.post("/v1/clientes/:id/chamados/:chamado/responder", async (c) => {
    const ids = chamado(c);
    const d = await lerCorpo(c, responderChamadoSchema);
    return c.json(await rpc("console_responder_chamado", { ...ids, p_texto: d.texto, p_interna: d.interna }), 201);
  });

  app.put("/v1/clientes/:id/chamados/:chamado", async (c) => {
    const ids = chamado(c);
    const d = await lerCorpo(c, atualizarChamadoSchema);
    return c.json({
      versao: await rpc<number>("console_atualizar_chamado", { ...ids, p_versao: d.versao, p_situacao: d.situacao, p_responsavel: d.responsavelId }),
    });
  });

  app.get("/v1/clientes/:id/chamados/:chamado/imagens/:arquivo/link", async (c) => {
    if (!deps.armazenamentoSuporte) throw new ErroDominio("INTERNAL_ERROR");
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("console_abrir_arquivo_chamado", { ...chamado(c), p_arquivo: idDaRota(c, "arquivo") });
    const url = await deps.armazenamentoSuporte.linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S);
    return c.json({ url, tipo: a.tipo, expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString() });
  });

  // WhatsApp do condomínio (passo 5; W-01, DC14): credenciais cifradas que nunca voltam para a
  // tela, conexão pelo QR ou por código e conferência do aparelho. Quem pode é o banco que diz.
  const whatsapp = () => {
    if (!deps.whatsapp) throw new ErroDominio("UPSTREAM_UNAVAILABLE");
    return deps.whatsapp;
  };
  interface AcessoWhatsapp { instancia: string; credenciais: string; numero: string | null; situacao: string }
  async function credenciais(c: Context<VarsSessao>, para: "CONSULTAR" | "CONECTAR" | "DESCONECTAR"): Promise<CredenciaisWhatsapp & { numero: string | null }> {
    const a = await rpc<AcessoWhatsapp>("console_whatsapp_acesso", { ...cliente(c), p_para: para });
    const cred = await decifrarCredenciais(whatsapp().chave, a.credenciais);
    return { instancia: a.instancia || cred.instancia, token: cred.token, numero: a.numero };
  }
  /** Falha do provedor vira "indisponível", sem o endereço (que tem o token) no registro. */
  async function noProvedor<T>(oQue: string, f: () => Promise<T>): Promise<T> {
    try {
      return await f();
    } catch (erro) {
      registrar("aviso", { funcao: "api-console", rota: `whatsapp/${oQue}`, erro: erro instanceof Error ? erro.message : "falha" });
      throw new ErroDominio("UPSTREAM_UNAVAILABLE", { motivo: "PROVEDOR" });
    }
  }

  app.get("/v1/whatsapp", async (c) => c.json({ numeros: await rpc("console_whatsapp_lista", { p_pessoa: pessoa(c) }) }));

  // Modelos de mensagem (F5.4, W-20): iguais para todos os clientes; só a administração escreve
  // e decide. No piloto, a administração aprova; no oficial, registra a resposta da Meta.
  const chaveModelo = (c: Context) => {
    const ch = c.req.param("chave") ?? "";
    if (!(CHAVES_MODELO as readonly string[]).includes(ch)) throw new ErroDominio("NOT_FOUND");
    return ch;
  };
  const numeroModelo = (c: Context) => {
    const n = Number(c.req.param("numero"));
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw new ErroDominio("NOT_FOUND");
    return n;
  };
  app.get("/v1/whatsapp/modelos", async (c) => c.json(await rpc("console_modelos_whatsapp", { p_pessoa: pessoa(c) })));
  app.get("/v1/whatsapp/modelos/:chave", async (c) =>
    c.json(await rpc("console_modelo_whatsapp", { p_pessoa: pessoa(c), p_chave: chaveModelo(c) })));
  app.post("/v1/whatsapp/modelos/:chave/versoes", async (c) => {
    const ch = chaveModelo(c);
    const d = await lerCorpo(c, corpoModeloSchema);
    return c.json(await rpc("console_salvar_modelo_whatsapp", { p_pessoa: pessoa(c), p_chave: ch, p_numero: null, p_versao: null, p_corpo: d.corpo }), 201);
  });
  app.put("/v1/whatsapp/modelos/:chave/versoes/:numero", async (c) => {
    const ch = chaveModelo(c);
    const n = numeroModelo(c);
    const d = await lerCorpo(c, editarModeloSchema);
    return c.json(await rpc("console_salvar_modelo_whatsapp", { p_pessoa: pessoa(c), p_chave: ch, p_numero: n, p_versao: d.versao, p_corpo: d.corpo }));
  });
  app.post("/v1/whatsapp/modelos/:chave/versoes/:numero/situacao", async (c) => {
    const ch = chaveModelo(c);
    const n = numeroModelo(c);
    const d = await lerCorpo(c, decidirModeloSchema);
    return c.json(await rpc("console_decidir_modelo_whatsapp", {
      p_pessoa: pessoa(c), p_chave: ch, p_numero: n, p_versao: d.versao, p_situacao: d.situacao, p_motivo: d.motivo,
    }));
  });

  app.get("/v1/clientes/:id/whatsapp", async (c) => c.json(await rpc("console_whatsapp", cliente(c))));

  app.put("/v1/clientes/:id/whatsapp/credenciais", async (c) => {
    const d = await lerCorpo(c, credenciaisWhatsappSchema);
    const w = whatsapp();
    const r = await rpc<{ segredo: string; versao: number }>("console_whatsapp_credenciais", {
      ...cliente(c), p_versao: d.versao, p_instancia: d.instancia,
      p_credenciais: await cifrarCredenciais(w.chave, { instancia: d.instancia, token: d.token }),
    });
    // O segredo vai só para o provedor, no endereço dos avisos; nunca volta para a tela.
    let avisos = true;
    try {
      await w.conector.ligarAvisos({ instancia: d.instancia, token: d.token }, `${w.urlAvisos}/v1/whatsapp/${r.segredo}`);
    } catch (erro) {
      registrar("aviso", { funcao: "api-console", rota: "whatsapp/avisos", erro: erro instanceof Error ? erro.message : "falha" });
      avisos = false;
    }
    return c.json({ versao: r.versao, avisos });
  });

  app.post("/v1/clientes/:id/whatsapp/conectar", async (c) => {
    const modo = (await c.req.json().catch(() => ({})) as { modo?: string }).modo === "CODIGO" ? "CODIGO" : "QR";
    const cred = await credenciais(c, "CONECTAR");
    const w = whatsapp();
    if (modo === "CODIGO") {
      const codigo = await noProvedor("codigo", () => w.conector.codigoPareamento(cred, cred.numero ?? ""));
      await rpc("console_whatsapp_situacao", { ...cliente(c), p_situacao: "CONECTANDO", p_aparelho: null, p_motivo: null });
      return c.json({ codigo });
    }
    const qr = await noProvedor("qr", () => w.conector.qrCode(cred));
    if (qr.conectado) return c.json({ conectado: true });
    await rpc("console_whatsapp_situacao", { ...cliente(c), p_situacao: "CONECTANDO", p_aparelho: null, p_motivo: null });
    return c.json({ qr: qr.imagem });
  });

  // Confere no provedor: conectado só vale com o aparelho do número da ficha; outro aparelho é
  // desconectado na hora.
  app.post("/v1/clientes/:id/whatsapp/verificar", async (c) => {
    const cred = await credenciais(c, "CONSULTAR");
    const w = whatsapp();
    const s = await noProvedor("situacao", () => w.conector.situacao(cred));
    if (!s.conectado) {
      return c.json(await rpc("console_whatsapp_situacao", { ...cliente(c), p_situacao: "DESCONECTADO", p_aparelho: null, p_motivo: null }));
    }
    const r = await rpc<{ aparelhoDiferente?: boolean }>("console_whatsapp_situacao", {
      ...cliente(c), p_situacao: "CONECTADO", p_aparelho: s.aparelho, p_motivo: null,
    });
    if (r.aparelhoDiferente) await noProvedor("desconectar", () => w.conector.desconectar(cred));
    return c.json(r);
  });

  app.post("/v1/clientes/:id/whatsapp/desconectar", async (c) => {
    const d = await lerCorpo(c, desconectarWhatsappSchema);
    const cred = await credenciais(c, "DESCONECTAR");
    await noProvedor("desconectar", () => whatsapp().conector.desconectar(cred));
    return c.json(await rpc("console_whatsapp_situacao", { ...cliente(c), p_situacao: "DESCONECTADO", p_aparelho: null, p_motivo: d.motivo }));
  });

  return app;
}
