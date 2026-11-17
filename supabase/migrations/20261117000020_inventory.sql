-- =====================================================================
-- Módulo de Estoque — Inventário (contagem de estoque)
-- =====================================================================

CREATE TYPE public.inventory_status AS ENUM ('ABERTA', 'EM_CONFERENCIA', 'FINALIZADA', 'CANCELADA');
CREATE TYPE public.inventory_type AS ENUM ('TOTAL', 'PARCIAL');

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
CREATE TABLE public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial UNIQUE,
  status public.inventory_status NOT NULL DEFAULT 'ABERTA',
  tipo public.inventory_type,
  observacoes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_by_nome text NOT NULL DEFAULT '',
  finalized_at timestamptz,
  finalized_by uuid,
  finalized_by_nome text NOT NULL DEFAULT '',
  canceled_at timestamptz,
  canceled_by uuid,
  valor_antes numeric(14,2),
  valor_depois numeric(14,2),
  valor_divergencia numeric(14,2),
  total_itens integer,
  total_divergencias integer
);
CREATE INDEX idx_inventory_counts_created ON public.inventory_counts (created_at DESC);

-- Lançamentos de contagem: append-only. quantidade é um delta (+1, +12, ou negativo
-- para corrigir/excluir). O id é gerado no dispositivo (idempotência da fila offline).
CREATE TABLE public.inventory_count_entries (
  id uuid PRIMARY KEY,
  count_id uuid NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  barcode text NOT NULL,
  quantidade numeric NOT NULL,
  tipo text NOT NULL DEFAULT 'LEITURA' CHECK (tipo IN ('LEITURA', 'AJUSTE', 'EXCLUSAO')),
  user_id uuid,
  user_nome text NOT NULL DEFAULT '',
  device_id text NOT NULL DEFAULT '',
  device_label text NOT NULL DEFAULT '',
  client_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_entries_count ON public.inventory_count_entries (count_id, created_at);
CREATE INDEX idx_inventory_entries_barcode ON public.inventory_count_entries (count_id, barcode);
ALTER TABLE public.inventory_count_entries REPLICA IDENTITY FULL;

-- Fotografia do fechamento
CREATE TABLE public.inventory_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  barcode text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  contado boolean NOT NULL DEFAULT true,
  a_identificar boolean NOT NULL DEFAULT false,
  saldo_sistema_no_fechamento numeric NOT NULL DEFAULT 0,
  quantidade_contada numeric NOT NULL DEFAULT 0,
  diferenca numeric NOT NULL DEFAULT 0,
  custo_medio numeric(14,4) NOT NULL DEFAULT 0,
  valor_diferenca numeric(14,2) NOT NULL DEFAULT 0,
  movement_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_items_count ON public.inventory_count_items (count_id);
CREATE INDEX idx_inventory_items_product ON public.inventory_count_items (product_id);

-- ---------------------------------------------------------------------
-- 2. RLS: leitura para usuários aprovados; escrita somente via funções
-- ---------------------------------------------------------------------
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users read inventory_counts" ON public.inventory_counts
  FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "Active users read inventory_count_entries" ON public.inventory_count_entries
  FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "Active users read inventory_count_items" ON public.inventory_count_items
  FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));

-- Permissões explícitas (o projeto não concede acesso automático a tabelas novas)
GRANT SELECT ON public.inventory_counts, public.inventory_count_entries, public.inventory_count_items TO authenticated;
GRANT ALL ON public.inventory_counts, public.inventory_count_entries, public.inventory_count_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.inventory_counts_numero_seq TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_count_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_counts;

-- ---------------------------------------------------------------------
-- 3. Abertura, status e lançamentos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_inventory_count(_observacoes text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Usuário sem permissão';
  END IF;
  INSERT INTO public.inventory_counts (observacoes, created_by, created_by_nome)
  VALUES (COALESCE(_observacoes, ''), auth.uid(), public.current_user_display_name())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_inventory_status(_count_id uuid, _status public.inventory_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c public.inventory_counts%ROWTYPE;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Usuário sem permissão';
  END IF;
  IF _status NOT IN ('ABERTA', 'EM_CONFERENCIA') THEN
    RAISE EXCEPTION 'Use as funções de finalizar ou cancelar';
  END IF;
  SELECT * INTO _c FROM public.inventory_counts WHERE id = _count_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contagem não encontrada';
  END IF;
  IF _c.status NOT IN ('ABERTA', 'EM_CONFERENCIA') THEN
    RAISE EXCEPTION 'Contagem % está % e não pode ser alterada', _c.numero, _c.status;
  END IF;
  UPDATE public.inventory_counts SET status = _status WHERE id = _count_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_count_entry(
  _id uuid,
  _count_id uuid,
  _barcode text,
  _quantidade numeric,
  _tipo text DEFAULT 'LEITURA',
  _device_id text DEFAULT '',
  _device_label text DEFAULT '',
  _client_created_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status public.inventory_status;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Usuário sem permissão';
  END IF;
  IF trim(COALESCE(_barcode, '')) = '' THEN
    RAISE EXCEPTION 'Código de barras vazio';
  END IF;

  -- Já gravado (reenvio da fila offline): ignora
  IF EXISTS (SELECT 1 FROM public.inventory_count_entries WHERE id = _id) THEN
    RETURN;
  END IF;

  SELECT status INTO _status FROM public.inventory_counts WHERE id = _count_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contagem não encontrada';
  END IF;
  IF _status NOT IN ('ABERTA', 'EM_CONFERENCIA') THEN
    RAISE EXCEPTION 'CONTAGEM_FECHADA: a contagem está % e não aceita lançamentos', _status;
  END IF;

  INSERT INTO public.inventory_count_entries (
    id, count_id, product_id, barcode, quantidade, tipo, user_id, user_nome,
    device_id, device_label, client_created_at
  ) VALUES (
    _id, _count_id, public.resolve_product(_barcode), trim(_barcode), _quantidade,
    COALESCE(NULLIF(_tipo, ''), 'LEITURA'), auth.uid(), public.current_user_display_name(),
    COALESCE(_device_id, ''), COALESCE(_device_label, ''), _client_created_at
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Conferência (cálculo ao vivo)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_inventory_conference(_count_id uuid, _tipo public.inventory_type DEFAULT 'PARCIAL')
RETURNS TABLE (
  product_id uuid,
  barcode text,
  product_name text,
  category text,
  a_identificar boolean,
  pendente_identificacao boolean,
  contado boolean,
  saldo_sistema numeric,
  quantidade_contada numeric,
  diferenca numeric,
  custo_medio numeric,
  valor_diferenca numeric,
  ajusta boolean,
  leituras bigint,
  ultimo_lancamento timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH e AS (
    SELECT COALESCE(ce.product_id, public.resolve_product(ce.barcode)) AS pid,
           ce.barcode, ce.quantidade, ce.tipo, ce.created_at
    FROM public.inventory_count_entries ce
    WHERE ce.count_id = _count_id AND public.is_active_user(auth.uid())
  ),
  agg AS (
    SELECT pid,
           CASE WHEN pid IS NULL THEN barcode END AS unknown_barcode,
           min(barcode) AS any_barcode,
           sum(quantidade) AS qtd,
           count(*) AS leituras,
           max(created_at) AS ultimo,
           (array_agg(tipo ORDER BY created_at DESC))[1] AS ultimo_tipo
    FROM e
    GROUP BY pid, CASE WHEN pid IS NULL THEN barcode END
  ),
  counted AS (
    SELECT * FROM agg WHERE ultimo_tipo <> 'EXCLUSAO' OR qtd <> 0
  )
  -- Produtos cadastrados
  SELECT p.id, p.barcode, p.product_name, p.category, false, p.pendente_identificacao,
         (c.pid IS NOT NULL),
         p.stock,
         COALESCE(c.qtd, 0),
         CASE WHEN c.pid IS NOT NULL OR _tipo = 'TOTAL' THEN COALESCE(c.qtd, 0) - p.stock ELSE 0 END,
         p.cost_avg,
         round(CASE WHEN c.pid IS NOT NULL OR _tipo = 'TOTAL' THEN (COALESCE(c.qtd, 0) - p.stock) * p.cost_avg ELSE 0 END, 2),
         (c.pid IS NOT NULL OR _tipo = 'TOTAL'),
         COALESCE(c.leituras, 0),
         c.ultimo
  FROM public.products p
  LEFT JOIN counted c ON c.pid = p.id
  WHERE public.is_active_user(auth.uid())
  UNION ALL
  -- Códigos não cadastrados
  SELECT NULL, c.unknown_barcode, 'PRODUTO A IDENTIFICAR', '', true, true, true,
         0, c.qtd, c.qtd, 0, 0, true, c.leituras, c.ultimo
  FROM counted c
  WHERE c.pid IS NULL
$$;

-- ---------------------------------------------------------------------
-- 5. Finalização (transação única, protegida contra execução dupla)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_inventory(_count_id uuid, _tipo public.inventory_type)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c public.inventory_counts%ROWTYPE;
  _r record;
  _pid uuid;
  _stock numeric;
  _cost numeric;
  _diff numeric;
  _mov_id uuid;
  _valor_antes numeric;
  _valor_depois numeric;
  _valor_div numeric := 0;
  _itens int := 0;
  _divs int := 0;
  _criados int := 0;
BEGIN
  IF NOT public.is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores ou gerentes podem finalizar o inventário';
  END IF;
  IF _tipo IS NULL THEN
    RAISE EXCEPTION 'Informe o tipo de contagem (TOTAL ou PARCIAL)';
  END IF;

  -- Trava a contagem: um segundo clique espera aqui e depois encontra FINALIZADA
  SELECT * INTO _c FROM public.inventory_counts WHERE id = _count_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contagem não encontrada';
  END IF;
  IF _c.status NOT IN ('ABERTA', 'EM_CONFERENCIA') THEN
    RAISE EXCEPTION 'CONTAGEM_FECHADA: a contagem % já está %', _c.numero, _c.status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.get_inventory_conference(_count_id, _tipo) g
    WHERE g.contado AND g.quantidade_contada < 0
  ) THEN
    RAISE EXCEPTION 'Há itens com quantidade contada negativa. Corrija antes de finalizar.';
  END IF;

  SELECT COALESCE(sum(greatest(stock, 0) * cost_avg), 0) INTO _valor_antes FROM public.products;

  FOR _r IN
    SELECT * FROM public.get_inventory_conference(_count_id, _tipo) g
    WHERE g.ajusta
    ORDER BY g.product_id NULLS LAST, g.barcode
  LOOP
    _pid := _r.product_id;

    IF _r.a_identificar THEN
      IF _r.quantidade_contada = 0 THEN
        CONTINUE;
      END IF;
      -- Pode ter sido cadastrado por outra pessoa no meio tempo
      _pid := public.resolve_product(_r.barcode);
      IF _pid IS NULL THEN
        _pid := public._create_stock_product(_r.barcode, 'A IDENTIFICAR - ' || _r.barcode, 0, true);
        _criados := _criados + 1;
      END IF;
    END IF;

    -- Saldo do sistema no momento exato do fechamento (com trava de linha)
    SELECT stock, cost_avg INTO _stock, _cost FROM public.products WHERE id = _pid FOR UPDATE;
    _diff := _r.quantidade_contada - _stock;
    _mov_id := NULL;

    IF _diff <> 0 THEN
      SELECT (public._apply_stock_movement(
        _pid, 'AJUSTE_INVENTARIO', _diff, NULL, _count_id, 'inventory_count',
        'Inventário nº ' || _c.numero || ' (' || _tipo || ')'
      )).id INTO _mov_id;
      _divs := _divs + 1;
      _valor_div := _valor_div + round(_diff * _cost, 2);
    END IF;

    INSERT INTO public.inventory_count_items (
      count_id, product_id, barcode, product_name, contado, a_identificar,
      saldo_sistema_no_fechamento, quantidade_contada, diferenca, custo_medio, valor_diferenca, movement_id
    )
    SELECT _count_id, p.id, p.barcode, p.product_name, _r.contado, _r.a_identificar,
           _stock, _r.quantidade_contada, _diff, _cost, round(_diff * _cost, 2), _mov_id
    FROM public.products p WHERE p.id = _pid;

    IF _r.contado THEN
      _itens := _itens + 1;
    END IF;
  END LOOP;

  SELECT COALESCE(sum(greatest(stock, 0) * cost_avg), 0) INTO _valor_depois FROM public.products;

  UPDATE public.inventory_counts
  SET status = 'FINALIZADA',
      tipo = _tipo,
      finalized_at = now(),
      finalized_by = auth.uid(),
      finalized_by_nome = public.current_user_display_name(),
      valor_antes = round(_valor_antes, 2),
      valor_depois = round(_valor_depois, 2),
      valor_divergencia = round(_valor_div, 2),
      total_itens = _itens,
      total_divergencias = _divs
  WHERE id = _count_id;

  RETURN jsonb_build_object(
    'itens', _itens, 'divergencias', _divs, 'produtos_criados', _criados,
    'valor_antes', round(_valor_antes, 2), 'valor_depois', round(_valor_depois, 2),
    'valor_divergencia', round(_valor_div, 2)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_inventory(_count_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c public.inventory_counts%ROWTYPE;
BEGIN
  IF NOT public.is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores ou gerentes podem cancelar o inventário';
  END IF;
  SELECT * INTO _c FROM public.inventory_counts WHERE id = _count_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contagem não encontrada';
  END IF;
  IF _c.status NOT IN ('ABERTA', 'EM_CONFERENCIA') THEN
    RAISE EXCEPTION 'CONTAGEM_FECHADA: a contagem % já está %', _c.numero, _c.status;
  END IF;
  UPDATE public.inventory_counts
  SET status = 'CANCELADA', canceled_at = now(), canceled_by = auth.uid()
  WHERE id = _count_id;
END;
$$;

-- Resumo para a lista de contagens
CREATE OR REPLACE VIEW public.inventory_counts_summary
WITH (security_invoker = true) AS
SELECT c.*,
       COALESCE(s.itens_contados, 0) AS itens_contados,
       COALESCE(s.lancamentos, 0) AS lancamentos
FROM public.inventory_counts c
LEFT JOIN (
  SELECT count_id,
         count(DISTINCT COALESCE(product_id::text, barcode)) AS itens_contados,
         count(*) AS lancamentos
  FROM public.inventory_count_entries
  GROUP BY count_id
) s ON s.count_id = c.id;

GRANT SELECT ON public.inventory_counts_summary TO authenticated;
GRANT ALL ON public.inventory_counts_summary TO service_role;

-- Contagem finalizada/cancelada é somente leitura (inclusive para funções)
CREATE OR REPLACE FUNCTION public.protect_closed_inventory()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _status public.inventory_status;
BEGIN
  IF TG_TABLE_NAME = 'inventory_counts' THEN
    IF OLD.status IN ('FINALIZADA', 'CANCELADA') THEN
      RAISE EXCEPTION 'Contagem % está % e é somente leitura', OLD.numero, OLD.status;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT status INTO _status FROM public.inventory_counts WHERE id = COALESCE(NEW.count_id, OLD.count_id);
  IF _status IN ('FINALIZADA', 'CANCELADA') THEN
    RAISE EXCEPTION 'Contagem % é somente leitura', _status;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_inventory_counts_readonly
  BEFORE UPDATE OR DELETE ON public.inventory_counts
  FOR EACH ROW EXECUTE FUNCTION public.protect_closed_inventory();
CREATE TRIGGER trg_inventory_entries_readonly
  BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_count_entries
  FOR EACH ROW EXECUTE FUNCTION public.protect_closed_inventory();
