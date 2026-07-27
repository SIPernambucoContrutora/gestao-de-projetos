-- Seed opcional das listas fixas (disciplinas e etapas).
-- Idempotente: pode rodar de novo sem duplicar (ON CONFLICT no nome único).
-- Rode DEPOIS de 0000_init, na mesma branch, para validar as FKs de itens_projeto.

INSERT INTO "disciplinas" ("nome") VALUES
  ('Arquitetura'),
  ('Estrutura'),
  ('Fundação'),
  ('Instalações Elétricas'),
  ('Instalações Hidrossanitárias'),
  ('Instalações de Incêndio'),
  ('Ar-condicionado'),
  ('Paisagismo'),
  ('Ambientação'),
  ('Automação'),
  ('Compatibilização')
ON CONFLICT ("nome") DO NOTHING;

INSERT INTO "etapas" ("nome") VALUES
  ('Estudo'),
  ('Anteprojeto'),
  ('Pré-executivo'),
  ('Executivo'),
  ('Detalhamento')
ON CONFLICT ("nome") DO NOTHING;
