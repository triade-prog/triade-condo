-- 0004 · Tipos comuns
-- Quem fez: uma pessoa com login, o próprio sistema (rotinas) ou um provedor (mensagem que chegou).
create type tipo_autor as enum ('PESSOA', 'SISTEMA', 'PROVEDOR');

-- Dinheiro exato (PT-09, F0.10): centavos inteiros e a moeda sempre junto. Toda coluna de
-- valor usa estes dois tipos, nunca numeric solto nem ponto flutuante.
create domain centavos as bigint;
create domain moeda as text check (value in ('BRL'));
