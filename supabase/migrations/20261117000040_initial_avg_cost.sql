-- =====================================================================
-- Módulo de Estoque — custo médio inicial a partir do histórico
-- Reprocessa, por produto e em ordem cronológica, as notas de entrada já lançadas
-- (exceto estornadas) e as vendas ativas, aplicando a regra do custo médio ponderado:
--   entrada: saldo <= 0 -> custo da entrada; senão (saldo*custo + qtd*custo_e)/(saldo+qtd)
--   venda:   só reduz o saldo
-- preview_* apenas calcula; apply_* grava (somente admin).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.preview_initial_avg_cost()
RETURNS TABLE (
  product_id uuid,
  barcode text,
  product_name text,
  saldo_atual numeric,
  custo_atual numeric,
  custo_calculado numeric,
  media_simples numeric,
  qtd_entradas bigint,
  qtd_comprada numeric,
  diferenca numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p record;
  _ev record;
  _saldo numeric;
  _custo numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem calcular o custo médio inicial';
  END IF;

  FOR _p IN
    SELECT pr.id, pr.barcode, pr.product_name, pr.stock, pr.cost_avg,
           count(pi.id) AS n, sum(pi.quantidade) AS q,
           sum(pi.quantidade * pi.valor_custo) / NULLIF(sum(pi.quantidade), 0) AS media
    FROM public.products pr
    JOIN public.purchase_items pi
      ON COALESCE(pi.product_id, public.resolve_product(pi.barcode)) = pr.id
    JOIN public.purchase_entries pe ON pe.id = pi.entry_id AND pe.status <> 'ESTORNADA'
    WHERE pi.quantidade > 0
    GROUP BY pr.id
  LOOP
    _saldo := 0;
    _custo := 0;
    FOR _ev IN
      SELECT * FROM (
        SELECT pi.created_at AS dt, pi.quantidade AS qtd, pi.valor_custo AS custo, 1 AS ord
        FROM public.purchase_items pi
        JOIN public.purchase_entries pe ON pe.id = pi.entry_id AND pe.status <> 'ESTORNADA'
        WHERE COALESCE(pi.product_id, public.resolve_product(pi.barcode)) = _p.id AND pi.quantidade > 0
        UNION ALL
        SELECT s.created_at, -s.quantidade, NULL, 2
        FROM public.sales s
        WHERE s.status = 'ATIVA' AND public.resolve_product(s.barcode) = _p.id
      ) ev
      ORDER BY dt, ord
    LOOP
      IF _ev.qtd > 0 THEN
        IF _saldo <= 0 THEN
          _custo := _ev.custo;
        ELSE
          _custo := (_saldo * _custo + _ev.qtd * _ev.custo) / (_saldo + _ev.qtd);
        END IF;
      END IF;
      _saldo := _saldo + _ev.qtd;
    END LOOP;

    product_id := _p.id;
    barcode := _p.barcode;
    product_name := _p.product_name;
    saldo_atual := _p.stock;
    custo_atual := _p.cost_avg;
    custo_calculado := round(_custo, 4);
    media_simples := round(COALESCE(_p.media, 0), 4);
    qtd_entradas := _p.n;
    qtd_comprada := _p.q;
    diferenca := round(_custo - _p.cost_avg, 4);
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_initial_avg_cost(_product_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r record;
  _n integer := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem gravar o custo médio inicial';
  END IF;

  FOR _r IN
    SELECT pv.* FROM public.preview_initial_avg_cost() pv
    WHERE pv.product_id = ANY (_product_ids) AND pv.custo_calculado <> pv.custo_atual
  LOOP
    PERFORM 1 FROM public.products WHERE id = _r.product_id FOR UPDATE;
    PERFORM set_config('app.stock_ctx', 'on', true);
    UPDATE public.products SET cost_avg = _r.custo_calculado WHERE id = _r.product_id;
    PERFORM set_config('app.stock_ctx', 'off', true);

    INSERT INTO public.stock_movements (
      movement_type, product_id, barcode, product_name, quantidade, custo_unitario,
      saldo_anterior, estoque_apos, custo_medio_anterior, custo_medio_apos,
      reference_type, observacoes, usuario_id, usuario_nome
    ) VALUES (
      'AJUSTE_MANUAL', _r.product_id, _r.barcode, _r.product_name, 0, _r.custo_calculado,
      _r.saldo_atual, _r.saldo_atual, _r.custo_atual, _r.custo_calculado,
      'initial_avg_cost', 'Custo médio inicial recalculado pelo histórico de notas',
      auth.uid(), public.current_user_display_name()
    );
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;
