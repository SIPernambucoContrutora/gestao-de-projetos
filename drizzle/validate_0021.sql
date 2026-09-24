-- validate_0021.sql — confira antes de aplicar na branch principal.

-- 1) Coluna adicionada, tipo date, anulável.
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'empreendimentos'
 ORDER BY ordinal_position;

-- 2) Empreendimentos já "Aprovado" ficam sem data e NÃO recebem o aviso
--    até alguém preencher a data na tela (o card mostra o alerta).
SELECT nome, fase, data_aprovacao
  FROM public.empreendimentos
 WHERE fase = 'aprovado'
 ORDER BY nome;
