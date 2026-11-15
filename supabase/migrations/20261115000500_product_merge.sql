-- =====================================================================
-- Módulo de Estoque — Produtos a identificar: completar cadastro e mesclar
-- =====================================================================

-- Completar cadastro de um produto pendente (nome, categoria, preço, custo)
CREATE OR REPLACE FUNCTION public.identify_product(
  _product_id uuid,
  _product_name text,
  _category text,
  _price numeric,
  _cost numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.products%ROWTYPE;
BEGIN
  IF NOT public.is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores ou gerentes podem identificar produtos';
  END IF;
  IF trim(COALESCE(_product_name, '')) = '' THEN
    RAISE EXCEPTION 'Informe o nome do produto';
  END IF;

  SELECT * INTO _p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  UPDATE public.products
  SET product_name = trim(_product_name),
      category = COALESCE(trim(_category), ''),
      price = COALESCE(_price, price),
      cost_avg = round(COALESCE(_cost, cost_avg), 4),
      pendente_identificacao = false
  WHERE id = _product_id;

  IF round(COALESCE(_cost, _p.cost_avg), 4) <> _p.cost_avg THEN
    INSERT INTO public.stock_movements (
      movement_type, product_id, barcode, product_name, quantidade, custo_unitario,
      saldo_anterior, estoque_apos, custo_medio_anterior, custo_medio_apos,
      reference_id, reference_type, observacoes, usuario_id, usuario_nome
    ) VALUES (
      'AJUSTE_MANUAL', _product_id, _p.barcode, trim(_product_name), 0, round(_cost, 4),
      _p.stock, _p.stock, _p.cost_avg, round(_cost, 4),
      _product_id, 'identify_product', 'Custo informado na identificação do produto',
      auth.uid(), public.current_user_display_name()
    );
  END IF;
END;
$$;

-- Mescla um produto (origem, normalmente "A IDENTIFICAR") em outro já existente (destino):
--  * transfere saldo e movimentações;
--  * o código da origem vira código alternativo do destino;
--  * remove a origem.
CREATE OR REPLACE FUNCTION public.merge_products(_source_id uuid, _target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s public.products%ROWTYPE;
  _t public.products%ROWTYPE;
  _new_cost numeric;
  _mov_id uuid;
BEGIN
  IF NOT public.is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores ou gerentes podem mesclar produtos';
  END IF;
  IF _source_id = _target_id THEN
    RAISE EXCEPTION 'Escolha produtos diferentes';
  END IF;

  -- Trava os dois em ordem fixa para evitar deadlock
  PERFORM 1 FROM public.products WHERE id IN (_source_id, _target_id) ORDER BY id FOR UPDATE;
  SELECT * INTO _s FROM public.products WHERE id = _source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto de origem não encontrado'; END IF;
  SELECT * INTO _t FROM public.products WHERE id = _target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto de destino não encontrado'; END IF;

  -- Movimentações e referências passam para o destino
  UPDATE public.stock_movements
  SET product_id = _target_id,
      observacoes = trim(observacoes || ' [mesclado de ' || _s.barcode || ']')
  WHERE product_id = _source_id;
  UPDATE public.purchase_items SET product_id = _target_id WHERE product_id = _source_id;
  UPDATE public.inventory_count_items SET product_id = _target_id WHERE product_id = _source_id;
  UPDATE public.inventory_count_entries e SET product_id = _target_id
  FROM public.inventory_counts c
  WHERE e.count_id = c.id AND e.product_id = _source_id AND c.status IN ('ABERTA', 'EM_CONFERENCIA');
  UPDATE public.product_barcodes SET product_id = _target_id WHERE product_id = _source_id;

  -- Remove a origem antes de registrar o código dela como alternativo
  PERFORM set_config('app.stock_ctx', 'on', true);
  DELETE FROM public.products WHERE id = _source_id;
  PERFORM set_config('app.stock_ctx', 'off', true);

  INSERT INTO public.product_barcodes (product_id, barcode, created_by)
  VALUES (_target_id, _s.barcode, auth.uid())
  ON CONFLICT (barcode) DO NOTHING;

  -- Saldo transferido; custo ponderado apenas se a origem tinha custo
  IF _s.stock <> 0 THEN
    SELECT (public._apply_stock_movement(
      _target_id, 'MESCLAGEM', _s.stock, _s.cost_avg, _source_id, 'product_merge',
      'Saldo transferido de ' || _s.barcode || ' (' || _s.product_name || ')'
    )).id INTO _mov_id;
    IF _s.cost_avg > 0 AND _t.stock > 0 AND _s.stock > 0 THEN
      _new_cost := round((_t.stock * _t.cost_avg + _s.stock * _s.cost_avg) / (_t.stock + _s.stock), 4);
    ELSIF _s.cost_avg > 0 AND _t.stock <= 0 AND _t.cost_avg = 0 THEN
      _new_cost := _s.cost_avg;
    END IF;
    IF _new_cost IS NOT NULL AND _new_cost <> _t.cost_avg THEN
      PERFORM set_config('app.stock_ctx', 'on', true);
      UPDATE public.products SET cost_avg = _new_cost WHERE id = _target_id;
      PERFORM set_config('app.stock_ctx', 'off', true);
      UPDATE public.stock_movements SET custo_medio_apos = _new_cost
      WHERE id = _mov_id;
    END IF;
  END IF;
END;
$$;
