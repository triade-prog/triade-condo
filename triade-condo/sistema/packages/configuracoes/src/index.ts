// Configurações do condomínio, as mesmas no app e na aba Configuração do Console (PI-04, CF-01,
// CF-12; decisão 7 do desenho "Configuração na implantação"), por tarefa: uma entrada e uma página
// por tarefa (decisões A.1 a D.1 da análise de Configurações).
export { PaginaConfiguracao, EntradaConfiguracoes, APOIO_CONFIGURACOES, type PropsAba } from "./Configuracoes.tsx";
export { PAGINAS_CONFIGURACAO, GRUPOS_TAREFA, PAGINAS_DA_TRIADE, paginaDe, grupoDaPagina, type IdPagina, type IdGrupo } from "./paginas.ts";
export { PaginaSalvavel, useParte, useVersao, contarMudancas, type Parte } from "./salvar.tsx";
export { PaginaMeusAvisos } from "./AbaWhatsapp.tsx";
export { ProvedorConfiguracao, useAmbiente, naBase, enderecoPlataforma, useCarregar, assinatura, type Ambiente, type Carga } from "./contexto.tsx";
export { ImprimirEtiquetas, enderecoEtiqueta } from "./ImprimirEtiquetas.tsx";
export { Janela, type Campo, type Valores } from "./Janela.tsx";
export { QrCode, enderecoMural } from "./QrCode.tsx";
export { ListaLocais, esquecerLocais } from "./Locais.tsx";
export { Caixa, Escolha, diaHora } from "./comum.tsx";
export { SituacaoDaConexao, TOM_CONEXAO, type Conexao } from "./conexao.tsx";
export { AjusteTecnico, BlocoTriade, FaixaTriade, PedirMudanca, SeloTriade, type Tecnica } from "./tecnica.tsx";
export type * from "./tipos.ts";
