-- 0050 · Caminho de busca fixo em todas as funções (aviso do verificador de segurança do Supabase)
-- Função sem search_path fixo pode ser enganada por um objeto de mesmo nome em outro esquema.
-- O teste 001 confere que nenhuma função do public fica sem.

alter function controle_versao() set search_path = public;
alter function vinculos_sem_exclusao() set search_path = public;
alter function vinculos_revogacao_definitiva() set search_path = public;
alter function historico_somente_insercao() set search_path = public;
alter function historico_tem_dado_proibido(jsonb) set search_path = public;

call fechar_acesso();
