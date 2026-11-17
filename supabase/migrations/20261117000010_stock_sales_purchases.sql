-- =====================================================================
-- Módulo de Estoque — integração com vendas e notas de entrada
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vendas: baixa e estorno automáticos (trigger, mesma transação do insert/update)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_stock_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid uuid;
  _stock numeric;
  _cost numeric;
  _block boolean;
  _mov public.stock_movements%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'ATIVA' OR trim(COALESCE(NEW.barcode, '')) = '' OR COALESCE(NEW.quantidade, 0) <= 0 THEN
      RETURN NEW;
    END IF;

    _pid := public.resolve_product(NEW.barcode);
    IF _pid IS NULL THEN
      _pid := public._create_stock_product(
        NEW.barcode, COALESCE(NULLIF(trim(NEW.product_name), ''), 'Produto sem nome'), NEW.valor_unitario, false
      );
    END IF;

    SELECT stock, cost_avg INTO _stock, _cost FROM public.products WHERE id = _pid FOR UPDATE;
    SELECT bloquear_venda_sem_saldo INTO _block FROM public.stock_settings WHERE id = 1;

    IF COALESCE(_block, false) AND _stock < NEW.quantidade THEN
      RAISE EXCEPTION 'SALDO_INSUFICIENTE: % — disponível %, solicitado %',
        NEW.product_name, _stock, NEW.quantidade
        USING ERRCODE = 'P0001';
    END IF;

    _mov := public._apply_stock_movement(_pid, 'SAIDA_VENDA', -NEW.quantidade, _cost, NEW.id, 'sale',
      CASE WHEN NEW.order_id IS NOT NULL THEN 'Pedido ' || NEW.order_id ELSE '' END);

    -- Custo da mercadoria vendida congelado no custo médio vigente
    NEW.unit_cost := _cost;
    NEW.total_cost := round(_cost * NEW.quantidade, 2);
    RETURN NEW;
  END IF;

  -- UPDATE: cancelamento -> estorno (somente se houve baixa e ainda não houve estorno)
  IF OLD.status = 'ATIVA' AND NEW.status = 'CANCELADA' THEN
    SELECT product_id INTO _pid FROM public.stock_movements
    WHERE reference_id = NEW.id AND movement_type = 'SAIDA_VENDA'
    ORDER BY created_at DESC LIMIT 1;

    IF _pid IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.stock_movements WHERE reference_id = NEW.id AND movement_type = 'ESTORNO_VENDA'
    ) THEN
      PERFORM public._apply_stock_movement(_pid, 'ESTORNO_VENDA', NEW.quantidade, NULL, NEW.id, 'sale',
        COALESCE(NEW.cancel_motivo, ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_stock_insert ON public.sales;
CREATE TRIGGER trg_sales_stock_insert
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_stock_trigger();

DROP TRIGGER IF EXISTS trg_sales_stock_cancel ON public.sales;
CREATE TRIGGER trg_sales_stock_cancel
  BEFORE UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_stock_trigger();

-- A baixa agora é feita pelo trigger. Mantida como no-op para clientes antigos em cache.
CREATE OR REPLACE FUNCTION public.register_sale_movement(
  _sale_id uuid,
  _barcode text,
  _product_name text,
  _quantidade numeric
)
RETURNS void
LANGUAGE sql
AS $$ SELECT NULL::void $$;

-- ---------------------------------------------------------------------
-- 2. Pedido de venda transacional (pedido + itens + baixa)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(_order jsonb, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _item jsonb;
  _sales jsonb := '[]'::jsonb;
  _s public.sales%ROWTYPE;
BEGIN
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'O pedido não tem itens';
  END IF;

  INSERT INTO public.orders (
    vendedor, forma_pagamento, status, total_bruto, total_desconto, total_liquido, valor_pago, troco,
    pgto_pix, pgto_cartao, pgto_dinheiro, pgto_boleto, pgto_outros, observacoes, client_id, client_nome
  ) VALUES (
    _order->>'vendedor',
    COALESCE(_order->>'forma_pagamento', 'PIX'),
    'ATIVA',
    COALESCE((_order->>'total_bruto')::numeric, 0),
    COALESCE((_order->>'total_desconto')::numeric, 0),
    COALESCE((_order->>'total_liquido')::numeric, 0),
    COALESCE((_order->>'valor_pago')::numeric, 0),
    COALESCE((_order->>'troco')::numeric, 0),
    COALESCE((_order->>'pgto_pix')::numeric, 0),
    COALESCE((_order->>'pgto_cartao')::numeric, 0),
    COALESCE((_order->>'pgto_dinheiro')::numeric, 0),
    COALESCE((_order->>'pgto_boleto')::numeric, 0),
    COALESCE((_order->>'pgto_outros')::numeric, 0),
    COALESCE(_order->>'observacoes', ''),
    NULLIF(_order->>'client_id', '')::uuid,
    COALESCE(_order->>'client_nome', '')
  )
  RETURNING * INTO _o;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO public.sales (
      order_id, vendedor, barcode, product_name, quantidade, valor_unitario, desconto_percentual,
      total_bruto, desconto, total_liquido, valor_pago, troco, forma_pagamento, status,
      pgto_pix, pgto_cartao, pgto_dinheiro, pgto_boleto, pgto_outros, observacoes, client_id, client_nome
    ) VALUES (
      _o.id, _o.vendedor,
      COALESCE(_item->>'barcode', ''),
      COALESCE(_item->>'product_name', ''),
      COALESCE((_item->>'quantidade')::numeric, 1),
      COALESCE((_item->>'valor_unitario')::numeric, 0),
      COALESCE((_item->>'desconto_percentual')::numeric, 0),
      COALESCE((_item->>'total_bruto')::numeric, 0),
      COALESCE((_item->>'desconto')::numeric, 0),
      COALESCE((_item->>'total_liquido')::numeric, 0),
      COALESCE((_item->>'valor_pago')::numeric, 0),
      0, _o.forma_pagamento, 'ATIVA',
      _o.pgto_pix, _o.pgto_cartao, _o.pgto_dinheiro, _o.pgto_boleto, _o.pgto_outros,
      _o.observacoes, _o.client_id, _o.client_nome
    )
    RETURNING * INTO _s;
    _sales := _sales || to_jsonb(_s);
  END LOOP;

  RETURN jsonb_build_object('order', to_jsonb(_o), 'items', _sales);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'CANCELADA', cancel_motivo = COALESCE(_motivo, ''), canceled_at = now(), updated_at = now()
  WHERE id = _order_id AND status = 'ATIVA';

  -- O trigger de vendas estorna cada item
  UPDATE public.sales
  SET status = 'CANCELADA', cancel_motivo = COALESCE(_motivo, ''), canceled_at = now()
  WHERE order_id = _order_id AND status = 'ATIVA';
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Notas de entrada
-- ---------------------------------------------------------------------
ALTER TABLE public.purchase_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'ESTORNADA')),
  ADD COLUMN IF NOT EXISTS estornada_at timestamptz,
  ADD COLUMN IF NOT EXISTS estornada_by uuid;

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
UPDATE public.purchase_items i SET product_id = p.id
  FROM public.products p WHERE i.product_id IS NULL AND p.barcode = i.barcode;
CREATE INDEX IF NOT EXISTS idx_purchase_items_entry ON public.purchase_items (entry_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON public.purchase_items (product_id);

-- Gerentes também consultam as notas
DROP POLICY IF EXISTS "Admins manage purchase_entries select" ON public.purchase_entries;
CREATE POLICY "Managers read purchase_entries" ON public.purchase_entries
  FOR SELECT TO authenticated USING (public.is_manager_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins read purchase_items" ON public.purchase_items;
CREATE POLICY "Managers read purchase_items" ON public.purchase_items
  FOR SELECT TO authenticated USING (public.is_manager_or_admin(auth.uid()));

-- Excluir nota diretamente quebraria o kardex: só pelo estorno
DROP POLICY IF EXISTS "Admins manage purchase_entries delete" ON public.purchase_entries;

CREATE OR REPLACE FUNCTION public.apply_purchase_entry(
  _file_name text,
  _vendedor text,
  _items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry_id uuid;
  _item jsonb;
  _barcode text;
  _name text;
  _qty numeric;
  _cost numeric;
  _price numeric;
  _pid uuid;
  _mov public.stock_movements%ROWTYPE;
  _total_items int := 0;
  _total_qty numeric := 0;
  _total_cost numeric := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar entradas';
  END IF;

  INSERT INTO public.purchase_entries (user_id, vendedor, file_name)
  VALUES (auth.uid(), COALESCE(_vendedor, ''), COALESCE(_file_name, ''))
  RETURNING id INTO _entry_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _barcode := trim(COALESCE(_item->>'barcode', ''));
    _name := trim(COALESCE(_item->>'product_name', ''));
    _qty := COALESCE((_item->>'quantidade')::numeric, 0);
    _cost := COALESCE((_item->>'valor_custo')::numeric, 0);
    _price := COALESCE((_item->>'valor_venda')::numeric, 0);

    IF _barcode = '' OR _qty <= 0 THEN
      CONTINUE;
    END IF;

    _pid := public.resolve_product(_barcode);
    IF _pid IS NULL THEN
      _pid := public._create_stock_product(_barcode, COALESCE(NULLIF(_name, ''), 'Produto sem nome'), _price, false);
    END IF;

    _mov := public._apply_stock_movement(_pid, 'ENTRADA_NOTA', _qty, _cost, _entry_id, 'purchase_entry',
      COALESCE(_file_name, ''));

    -- Atualiza cadastro; nota com descrição identifica produtos pendentes
    UPDATE public.products
    SET product_name = CASE WHEN _name <> '' THEN _name ELSE product_name END,
        price = CASE WHEN _price > 0 THEN _price ELSE price END,
        pendente_identificacao = CASE WHEN _name <> '' THEN false ELSE pendente_identificacao END
    WHERE id = _pid;

    INSERT INTO public.purchase_items (
      entry_id, product_id, barcode, product_name, quantidade, valor_custo, valor_venda,
      custo_medio_apos, estoque_apos
    ) VALUES (
      _entry_id, _pid, _barcode, _name, _qty, _cost, _price, _mov.custo_medio_apos, _mov.estoque_apos
    );

    _total_items := _total_items + 1;
    _total_qty := _total_qty + _qty;
    _total_cost := _total_cost + (_qty * _cost);
  END LOOP;

  UPDATE public.purchase_entries
  SET total_items = _total_items, total_quantity = _total_qty, total_cost = _total_cost
  WHERE id = _entry_id;

  RETURN _entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_purchase_entry(_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _e public.purchase_entries%ROWTYPE;
  _i public.purchase_items%ROWTYPE;
  _pid uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem estornar notas';
  END IF;

  SELECT * INTO _e FROM public.purchase_entries WHERE id = _entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota não encontrada';
  END IF;
  IF _e.status = 'ESTORNADA' THEN
    RAISE EXCEPTION 'Esta nota já foi estornada';
  END IF;

  FOR _i IN SELECT * FROM public.purchase_items WHERE entry_id = _entry_id ORDER BY created_at
  LOOP
    _pid := COALESCE(_i.product_id, public.resolve_product(_i.barcode));
    IF _pid IS NULL THEN
      CONTINUE;
    END IF;
    PERFORM public._apply_stock_movement(_pid, 'ESTORNO_NOTA', -_i.quantidade, _i.valor_custo, _entry_id,
      'purchase_entry', 'Estorno da nota ' || COALESCE(NULLIF(_e.file_name, ''), _entry_id::text));
  END LOOP;

  UPDATE public.purchase_entries
  SET status = 'ESTORNADA', estornada_at = now(), estornada_by = auth.uid()
  WHERE id = _entry_id;
END;
$$;
