-- 0016_emails_enviados.sql
-- ------------------------------------------------------------------
-- Registro de e-mails disparados para projetistas.
--
-- Serve a DOIS propósitos:
--
--  1) IDEMPOTÊNCIA. O aviso diário de vencimento é disparado por um cron
--     externo (Vercel Cron hoje, cron da VPS depois). Cron reexecuta:
--     por retry da plataforma, por deploy no meio da janela, ou por
--     alguém abrindo a rota na mão. O índice único
--     (tipo, item_id, referencia) faz o segundo disparo do mesmo dia
--     colidir em vez de encher a caixa do projetista.
--
--     `referencia` é o que torna o envio único dentro do tipo:
--       · vencimento_hoje → a data do prazo (YYYY-MM-DD)
--       · revisao_aberta  → o id da revisão
--
--  2) AUDITORIA. `erro` guarda a falha do SMTP quando o envio não sai.
--     A linha é gravada ANTES do envio e atualizada depois, então um
--     e-mail que falhou fica visível em vez de sumir — sem isso, um
--     SMTP fora do ar viraria silêncio, e silêncio aqui é
--     indistinguível de "não havia nada para avisar".
--
-- Sem FK para revisoes_item: `referencia` é text porque guarda tipos
-- diferentes conforme o tipo do e-mail. O item_id tem FK em SET NULL
-- pela mesma razão de historico_alteracoes — o log sobrevive à
-- exclusão do item.
-- ------------------------------------------------------------------

BEGIN;

CREATE TYPE public.tipo_email AS ENUM ('vencimento_hoje', 'revisao_aberta');

CREATE TABLE IF NOT EXISTS public.emails_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_email NOT NULL,
  item_id uuid REFERENCES public.itens_projeto (id) ON DELETE SET NULL,
  referencia text NOT NULL,
  destinatario text NOT NULL,
  assunto text NOT NULL,
  -- Contexto denormalizado: permanece legível depois que o item some.
  projetista_nome text,
  empreendimento_nome text,
  item_numero integer,
  -- NULL enquanto pendente; preenchido no sucesso do SMTP.
  enviado_em timestamptz,
  -- Mensagem de falha do último envio; NULL quando deu certo.
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A trava da idempotência. Uma tentativa por (tipo, item, referência) —
-- inclusive as que falharam: reenviar é decisão manual, não automática.
--
-- NULLS NOT DISTINCT é obrigatório: item_id é anulável (SET NULL na
-- exclusão do item) e, no padrão do Postgres, cada NULL é distinto de
-- todos os outros — a trava deixaria de valer justamente para as linhas
-- órfãs. Exige Postgres 15+ (o Neon está acima disso).
CREATE UNIQUE INDEX IF NOT EXISTS emails_enviados_tipo_item_referencia_key
  ON public.emails_enviados (tipo, item_id, referencia) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS emails_enviados_created_at_idx
  ON public.emails_enviados (created_at DESC);

-- Índice parcial para a pergunta "o que falhou?" — a consulta de suporte.
CREATE INDEX IF NOT EXISTS emails_enviados_erro_idx
  ON public.emails_enviados (created_at DESC)
  WHERE erro IS NOT NULL;

COMMIT;
