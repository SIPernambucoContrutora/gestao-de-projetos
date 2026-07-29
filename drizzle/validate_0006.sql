-- Confere se sobrou algum valor_antigo/valor_novo em formato de uuid nos
-- campos etapa/disciplina/projetista (esperado: idealmente 0 linhas; se
-- houver, é porque a entidade referenciada já não existe mais em nenhuma
-- tabela e o nome não pode ser recuperado).
SELECT id, campo, valor_antigo, valor_novo, created_at
FROM public.historico_alteracoes
WHERE campo IN ('etapa', 'disciplina', 'projetista')
  AND (
    valor_antigo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR valor_novo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
ORDER BY created_at DESC;
