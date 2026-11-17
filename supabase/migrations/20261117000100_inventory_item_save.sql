-- =====================================================================
-- Inventário: contagem individual por produto com atualização imediata do saldo
--
-- Cada produto é contado e SALVO individualmente dentro do grupo de contagem.
-- Ao salvar, o saldo do produto é ajustado na hora (AJUSTE_INVENTARIO):
--   novo saldo = quantidade contada + movimentações do produto ocorridas desde a
--                1ª leitura desta rodada (ex.: vendas feitas durante a contagem)
-- Lançamentos de um produto após um "SALVO" abrem nova rodada (recontagem).
-- Encerrar o grupo não reajusta os salvos; no modo TOTAL zera os não salvos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estrutura
-- ---------------------------------------------------------------------
ALTER TABLE public.inventory_count_entries
  ALTER COLUMN created_at SET DEFAULT clock_timestamp(),
  DROP CONSTRAINT IF EXISTS inventory_count_entries_tipo_check,
  ADD CONSTRAINT inventory_count_entries_tipo_check
    CHECK (tipo IN ('LEITURA', 'AJUSTE', 'EXCLUSAO', 'SALVO'));

ALTER TABLE public.inventory_count_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'SALVO' CHECK (status IN ('SALVO', 'ZERADO')),
  ADD COLUMN IF NOT EXISTS rodada_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS movimentos_durante numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS saved_by uuid,
  ADD COLUMN IF NOT EXISTS saved_by_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_count_product
  ON public.inventory_count_items (count_id, product_id) WHERE product_id IS NOT NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_count_items;

-- Chave de trava por produto (ou código ainda não cadastrado) dentro da contagem
CREATE OR REPLACE FUNCTION public._count_item_lock(_count_id uuid, _pid uuid, _barcode text)
RETURNS void
LANGUAGE sql
AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(_count_id::text || ':' || COALESCE(_pid::text, trim(_barcode)), 0))
$$;

-- ---------------------------------------------------------------------
-- 2. Lançamento (mesma assinatura; agora serializado com o "salvar" do produto)
-- ---------------------------------------------------------------------
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
  _pid uuid;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Usuário sem permissão';
  END IF;
  IF trim(COALESCE(_barcode, '')) = '' THEN
    RAISE EXCEPTION 'Código de barras vazio';
  END IF;
  IF COALESCE(_tipo, 'LEITURA') NOT IN ('LEITURA', 'AJUSTE', 'EXCLUSAO') THEN
    RAISE EXCEPTION 'Tipo de lançamento inválido';
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

  _pid := public.resolve_product(_barcode);
  -- Espera um "salvar" em andamento do mesmo produto; o lançamento cai na rodada seguinte
  PERFORM public._count_item_lock(_count_id, _pid, _barcode);

  INSERT INTO public.inventory_count_entries (
    id, count_id, product_id, barcode, quantidade, tipo, user_id, user_nome,
    device_id, device_label, client_created_at, created_at
  ) VALUES (
    _id, _count_id, _pid, trim(_barcode), _quantidade,
    COALESCE(NULLIF(_tipo, ''), 'LEITURA'), auth.uid(), public.current_user_display_name(),
    COALESCE(_device_id, ''), COALESCE(_device_label, ''), _client_created_at, clock_timestamp()
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Rodadas abertas (lançamentos após o último SALVO de cada produto)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._inventory_open_rounds(_count_id uuid)
RETURNS TABLE (
  pid uuid,
  barcode text,
  qtd numeric,
  leituras bigint,
  inicio timestamptz,
  ultimo timestamptz,
  movimentos_durante numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ent AS (
    SELECT COALESCE(ce.product_id, public.resolve_product(ce.barcode)) AS pid,
           ce.barcode, ce.quantidade, ce.tipo, ce.created_at,
           -- Leitura feita offline: vale a hora do aparelho, limitada à abertura da contagem
           greatest(c.created_at, least(ce.created_at, COALESCE(ce.client_created_at, ce.created_at))) AS t0
    FROM public.inventory_count_entries ce
    JOIN public.inventory_counts c ON c.id = ce.count_id
    WHERE ce.count_id = _count_id
  ),
  keyed AS (
    SELECT *, COALESCE(pid::text, 'code:' || barcode) AS k FROM ent
  ),
  lastsave AS (
    SELECT k, max(created_at) AS ts FROM keyed WHERE tipo = 'SALVO' GROUP BY k
  ),
  rnd AS (
    SELECT kd.k,
           (array_agg(kd.pid))[1] AS pid,
           min(kd.barcode) AS barcode,
           sum(kd.quantidade) AS qtd,
           count(*) AS leituras,
           min(kd.t0) AS inicio,
           max(kd.created_at) AS ultimo,
           (array_agg(kd.tipo ORDER BY kd.created_at DESC))[1] AS ultimo_tipo
    FROM keyed kd
    LEFT JOIN lastsave ls ON ls.k = kd.k
    WHERE kd.tipo <> 'SALVO' AND (ls.ts IS NULL OR kd.created_at > ls.ts)
    GROUP BY kd.k
  )
  SELECT r.pid, r.barcode, r.qtd, r.leituras, r.inicio, r.ultimo,
         COALESCE((
           SELECT sum(m.quantidade) FROM public.stock_movements m
           WHERE r.pid IS NOT NULL AND m.product_id = r.pid AND m.created_at >= r.inicio
             AND NOT (m.movement_type = 'AJUSTE_INVENTARIO' AND m.reference_id = _count_id)
         ), 0)
  FROM rnd r
  WHERE r.ultimo_tipo <> 'EXCLUSAO' OR r.qtd <> 0
$$;
REVOKE ALL ON FUNCTION public._inventory_open_rounds(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Salvar a contagem de um produto (atualiza o saldo na hora)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_count_item(_count_id uuid, _barcode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c public.inventory_counts%ROWTYPE;
  _pid uuid;
  _created boolean := false;
  _r record;
  _stock numeric;
  _cost numeric;
  _novo numeric;
  _diff numeric;
  _mov_id uuid;
  _nome text;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Usuário sem permissão';
  END IF;
  IF trim(COALESCE(_barcode, '')) = '' THEN
    RAISE EXCEPTION 'Código de barras vazio';
  END IF;

  SELECT * INTO _c FROM public.inventory_counts WHERE id = _count_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contagem não encontrada';
  END IF;
  IF _c.status NOT IN ('ABERTA', 'EM_CONFERENCIA') THEN
    RAISE EXCEPTION 'CONTAGEM_FECHADA: a contagem % já está %', _c.numero, _c.status;
  END IF;

  _pid := public.resolve_product(_barcode);
  PERFORM public._count_item_lock(_count_id, _pid, _barcode);

  SELECT * INTO _r FROM public._inventory_open_rounds(_count_id) o
  WHERE (_pid IS NOT NULL AND o.pid = _pid) OR (_pid IS NULL AND o.pid IS NULL AND o.barcode = trim(_barcode));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma leitura pendente deste produto para salvar';
  END IF;
  IF _r.qtd < 0 THEN
    RAISE EXCEPTION 'Quantidade contada negativa (%). Corrija antes de salvar.', _r.qtd;
  END IF;

  -- Código não cadastrado: cria o produto pendente de identificação
  IF _pid IS NULL THEN
    _pid := public._create_stock_product(trim(_barcode), 'A IDENTIFICAR - ' || trim(_barcode), 0, true);
    _created := true;
  END IF;

  SELECT stock, cost_avg, product_name INTO _stock, _cost, _nome
  FROM public.products WHERE id = _pid FOR UPDATE;

  _novo := _r.qtd + _r.movimentos_durante;
  _diff := _novo - _stock;

  IF _diff <> 0 THEN
    SELECT (public._apply_stock_movement(
      _pid, 'AJUSTE_INVENTARIO', _diff, NULL, _count_id, 'inventory_count',
      'Inventário nº ' || _c.numero || ' — contado ' || _r.qtd ||
      CASE WHEN _r.movimentos_durante <> 0 THEN ', movimentado durante a contagem ' || _r.movimentos_durante ELSE '' END
    )).id INTO _mov_id;
  END IF;

  INSERT INTO public.inventory_count_items AS i (
    count_id, product_id, barcode, product_name, contado, a_identificar, status,
    saldo_sistema_no_fechamento, quantidade_contada, diferenca, custo_medio, valor_diferenca,
    movement_id, rodada_inicio, movimentos_durante, saved_at, saved_by, saved_by_nome, updated_at
  )
  SELECT _count_id, p.id, p.barcode, p.product_name, true, _created OR p.pendente_identificacao, 'SALVO',
         _stock, _r.qtd, _diff, _cost, round(_diff * _cost, 2),
         _mov_id, _r.inicio, _r.movimentos_durante, now(), auth.uid(), public.current_user_display_name(), now()
  FROM public.products p WHERE p.id = _pid
  ON CONFLICT (count_id, product_id) WHERE product_id IS NOT NULL DO UPDATE SET
    product_name = EXCLUDED.product_name,
    contado = true,
    status = 'SALVO',
    saldo_sistema_no_fechamento = EXCLUDED.saldo_sistema_no_fechamento,
    quantidade_contada = EXCLUDED.quantidade_contada,
    diferenca = i.diferenca + EXCLUDED.diferenca,
    custo_medio = EXCLUDED.custo_medio,
    valor_diferenca = i.valor_diferenca + EXCLUDED.valor_diferenca,
    movement_id = COALESCE(EXCLUDED.movement_id, i.movement_id),
    rodada_inicio = EXCLUDED.rodada_inicio,
    movimentos_durante = EXCLUDED.movimentos_durante,
    saved_at = EXCLUDED.saved_at,
    saved_by = EXCLUDED.saved_by,
    saved_by_nome = EXCLUDED.saved_by_nome,
    updated_at = now();

  -- Marcador que fecha a rodada (novas leituras = recontagem)
  INSERT INTO public.inventory_count_entries (
    id, count_id, product_id, barcode, quantidade, tipo, user_id, user_nome, created_at
  ) VALUES (
    gen_random_uuid(), _count_id, _pid, trim(_barcode), 0, 'SALVO', auth.uid(),
    public.current_user_display_name(), clock_timestamp()
  );

  RETURN jsonb_build_object(
    'product_id', _pid,
    'product_name', _nome,
    'produto_criado', _created,
    'contado', _r.qtd,
    'movimentos_durante', _r.movimentos_durante,
    'saldo_anterior', _stock,
    'saldo_novo', _novo,
    'diferenca', _diff,
    'valor_diferenca', round(_diff * _cost, 2)
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Conferência
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_inventory_conference(uuid, public.inventory_type);
CREATE FUNCTION public.get_inventory_conference(_count_id uuid, _tipo public.inventory_type DEFAULT 'PARCIAL')
RETURNS TABLE (
  product_id uuid,
  barcode text,
  product_name text,
  category text,
  a_identificar boolean,
  pendente_identificacao boolean,
  situacao text,             -- SALVO | CONTANDO | NAO_CONTADO
  salvo boolean,
  contando boolean,
  saldo_sistema numeric,
  quantidade_contada numeric, -- rodada aberta (contando) ou última quantidade salva
  quantidade_salva numeric,
  movimentos_durante numeric,
  diferenca numeric,          -- salvo: ajuste já aplicado; contando/encerramento: ajuste previsto
  custo_medio numeric,
  valor_diferenca numeric,
  ajusta boolean,             -- ainda vai alterar o estoque (salvar pendente ou zerar no TOTAL)
  leituras bigint,
  ultimo_lancamento timestamptz,
  saved_at timestamptz,
  saved_by_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH o AS (SELECT * FROM public._inventory_open_rounds(_count_id)),
  i AS (SELECT * FROM public.inventory_count_items WHERE count_id = _count_id AND status = 'SALVO')
  SELECT p.id, p.barcode, p.product_name, p.category, false, p.pendente_identificacao,
         CASE WHEN o.pid IS NOT NULL THEN 'CONTANDO' WHEN i.id IS NOT NULL THEN 'SALVO' ELSE 'NAO_CONTADO' END,
         i.id IS NOT NULL,
         o.pid IS NOT NULL,
         p.stock,
         COALESCE(o.qtd, i.quantidade_contada, 0),
         i.quantidade_contada,
         COALESCE(o.movimentos_durante, i.movimentos_durante, 0),
         CASE
           WHEN o.pid IS NOT NULL THEN o.qtd + o.movimentos_durante - p.stock
           WHEN i.id IS NOT NULL THEN i.diferenca
           WHEN _tipo = 'TOTAL' THEN -p.stock
           ELSE 0
         END,
         p.cost_avg,
         round(CASE
           WHEN o.pid IS NOT NULL THEN (o.qtd + o.movimentos_durante - p.stock) * p.cost_avg
           WHEN i.id IS NOT NULL THEN i.valor_diferenca
           WHEN _tipo = 'TOTAL' THEN -p.stock * p.cost_avg
           ELSE 0
         END, 2),
         (o.pid IS NOT NULL AND o.qtd + o.movimentos_durante <> p.stock)
           OR (o.pid IS NULL AND i.id IS NULL AND _tipo = 'TOTAL' AND p.stock <> 0),
         COALESCE(o.leituras, 0),
         o.ultimo,
         i.saved_at,
         i.saved_by_nome
  FROM public.products p
  LEFT JOIN o ON o.pid = p.id
  LEFT JOIN i ON i.product_id = p.id
  WHERE public.is_active_user(auth.uid())
  UNION ALL
  SELECT NULL, o.barcode, 'PRODUTO A IDENTIFICAR', '', true, true, 'CONTANDO', false, true,
         0, o.qtd, NULL, 0, o.qtd, 0, 0, true, o.leituras, o.ultimo, NULL, NULL
  FROM o
  WHERE o.pid IS NULL AND public.is_active_user(auth.uid())
$$;

-- ---------------------------------------------------------------------
-- 6. Encerrar o grupo de contagem
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_inventory(_count_id uuid, _tipo public.inventory_type)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c public.inventory_counts%ROWTYPE;
  _p record;
  _abertos int;
  _zerados int := 0;
  _mov_id uuid;
  _valor_depois numeric;
  _valor_div numeric;
  _divs int;
  _itens int;
BEGIN
  IF NOT public.is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores ou gerentes podem encerrar o inventário';
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

  SELECT count(*) INTO _abertos FROM public._inventory_open_rounds(_count_id);
  IF _abertos > 0 THEN
    RAISE EXCEPTION 'ITENS_NAO_SALVOS: há % produto(s) com contagem não salva. Salve ou exclua antes de encerrar.', _abertos;
  END IF;

  -- TOTAL: zera os produtos que não foram salvos nesta contagem
  IF _tipo = 'TOTAL' THEN
    FOR _p IN
      SELECT pr.id, pr.stock, pr.cost_avg FROM public.products pr
      WHERE pr.stock <> 0
        AND NOT EXISTS (
          SELECT 1 FROM public.inventory_count_items i
          WHERE i.count_id = _count_id AND i.product_id = pr.id AND i.status = 'SALVO'
        )
      ORDER BY pr.id
    LOOP
      SELECT (public._apply_stock_movement(
        _p.id, 'AJUSTE_INVENTARIO', -_p.stock, NULL, _count_id, 'inventory_count',
        'Inventário nº ' || _c.numero || ' (TOTAL) — não contado, saldo zerado'
      )).id INTO _mov_id;

      INSERT INTO public.inventory_count_items (
        count_id, product_id, barcode, product_name, contado, a_identificar, status,
        saldo_sistema_no_fechamento, quantidade_contada, diferenca, custo_medio, valor_diferenca,
        movement_id, saved_at, saved_by, saved_by_nome
      )
      SELECT _count_id, pr.id, pr.barcode, pr.product_name, false, pr.pendente_identificacao, 'ZERADO',
             _p.stock, 0, -_p.stock, _p.cost_avg, round(-_p.stock * _p.cost_avg, 2),
             _mov_id, now(), auth.uid(), public.current_user_display_name()
      FROM public.products pr WHERE pr.id = _p.id
      ON CONFLICT (count_id, product_id) WHERE product_id IS NOT NULL DO NOTHING;
      _zerados := _zerados + 1;
    END LOOP;
  END IF;

  -- Totais a partir dos ajustes efetivamente aplicados por esta contagem
  SELECT COALESCE(sum(round(m.quantidade * m.custo_unitario, 2)), 0), count(DISTINCT m.product_id)
  INTO _valor_div, _divs
  FROM public.stock_movements m
  WHERE m.reference_id = _count_id AND m.movement_type = 'AJUSTE_INVENTARIO';

  SELECT count(*) INTO _itens FROM public.inventory_count_items WHERE count_id = _count_id AND status = 'SALVO';
  SELECT COALESCE(sum(greatest(stock, 0) * cost_avg), 0) INTO _valor_depois FROM public.products;

  UPDATE public.inventory_counts
  SET status = 'FINALIZADA',
      tipo = _tipo,
      finalized_at = now(),
      finalized_by = auth.uid(),
      finalized_by_nome = public.current_user_display_name(),
      valor_antes = round(_valor_depois - _valor_div, 2),
      valor_depois = round(_valor_depois, 2),
      valor_divergencia = round(_valor_div, 2),
      total_itens = _itens,
      total_divergencias = _divs
  WHERE id = _count_id;

  RETURN jsonb_build_object(
    'itens', _itens, 'divergencias', _divs, 'zerados', _zerados, 'produtos_criados', 0,
    'valor_antes', round(_valor_depois - _valor_div, 2), 'valor_depois', round(_valor_depois, 2),
    'valor_divergencia', round(_valor_div, 2)
  );
END;
$$;
