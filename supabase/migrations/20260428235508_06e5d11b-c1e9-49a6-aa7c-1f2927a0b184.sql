-- 1. Add cost/stock to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_avg NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock NUMERIC NOT NULL DEFAULT 0;

-- 2. Add CMV columns to sales (frozen at sale time)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC NOT NULL DEFAULT 0;

-- 3. Purchase entries (header)
CREATE TABLE IF NOT EXISTS public.purchase_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  vendedor TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  total_items INTEGER NOT NULL DEFAULT 0,
  total_quantity NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.purchase_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage purchase_entries select"
  ON public.purchase_entries FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage purchase_entries insert"
  ON public.purchase_entries FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage purchase_entries delete"
  ON public.purchase_entries FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 4. Purchase items
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.purchase_entries(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  quantidade NUMERIC NOT NULL DEFAULT 0,
  valor_custo NUMERIC NOT NULL DEFAULT 0,
  valor_venda NUMERIC NOT NULL DEFAULT 0,
  custo_medio_apos NUMERIC NOT NULL DEFAULT 0,
  estoque_apos NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read purchase_items"
  ON public.purchase_items FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert purchase_items"
  ON public.purchase_items FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. Stock movements (Kardex)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('ENTRADA','SAIDA','AJUSTE')),
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  quantidade NUMERIC NOT NULL,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  custo_medio_apos NUMERIC NOT NULL DEFAULT 0,
  estoque_apos NUMERIC NOT NULL DEFAULT 0,
  reference_id UUID,
  reference_type TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_barcode ON public.stock_movements(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read stock_movements"
  ON public.stock_movements FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated insert stock_movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 6. RPC: apply purchase entry — updates/creates products, applies weighted avg cost, returns entry_id
CREATE OR REPLACE FUNCTION public.apply_purchase_entry(
  _file_name TEXT,
  _vendedor TEXT,
  _items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry_id UUID;
  _item JSONB;
  _barcode TEXT;
  _name TEXT;
  _qty NUMERIC;
  _cost NUMERIC;
  _price NUMERIC;
  _current_stock NUMERIC;
  _current_cost NUMERIC;
  _new_cost NUMERIC;
  _new_stock NUMERIC;
  _total_items INT := 0;
  _total_qty NUMERIC := 0;
  _total_cost NUMERIC := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar entradas';
  END IF;

  INSERT INTO public.purchase_entries (user_id, vendedor, file_name)
  VALUES (auth.uid(), COALESCE(_vendedor,''), COALESCE(_file_name,''))
  RETURNING id INTO _entry_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _barcode := trim(COALESCE(_item->>'barcode',''));
    _name := trim(COALESCE(_item->>'product_name',''));
    _qty := COALESCE((_item->>'quantidade')::NUMERIC, 0);
    _cost := COALESCE((_item->>'valor_custo')::NUMERIC, 0);
    _price := COALESCE((_item->>'valor_venda')::NUMERIC, 0);

    IF _barcode = '' OR _qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT stock, cost_avg INTO _current_stock, _current_cost
    FROM public.products WHERE barcode = _barcode;

    IF NOT FOUND THEN
      _current_stock := 0;
      _current_cost := 0;
      INSERT INTO public.products (barcode, product_name, price, cost_avg, stock)
      VALUES (_barcode, COALESCE(NULLIF(_name,''),'Produto sem nome'), _price, _cost, 0);
    END IF;

    IF _current_stock <= 0 THEN
      _new_cost := _cost;
    ELSE
      _new_cost := ((_current_stock * _current_cost) + (_qty * _cost)) / (_current_stock + _qty);
    END IF;
    _new_stock := _current_stock + _qty;

    UPDATE public.products
    SET stock = _new_stock,
        cost_avg = _new_cost,
        product_name = CASE WHEN _name <> '' THEN _name ELSE product_name END,
        price = CASE WHEN _price > 0 THEN _price ELSE price END
    WHERE barcode = _barcode;

    INSERT INTO public.purchase_items (
      entry_id, barcode, product_name, quantidade, valor_custo, valor_venda,
      custo_medio_apos, estoque_apos
    ) VALUES (
      _entry_id, _barcode, _name, _qty, _cost, _price, _new_cost, _new_stock
    );

    INSERT INTO public.stock_movements (
      movement_type, barcode, product_name, quantidade, custo_unitario,
      custo_medio_apos, estoque_apos, reference_id, reference_type
    ) VALUES (
      'ENTRADA', _barcode, _name, _qty, _cost, _new_cost, _new_stock, _entry_id, 'purchase_entry'
    );

    _total_items := _total_items + 1;
    _total_qty := _total_qty + _qty;
    _total_cost := _total_cost + (_qty * _cost);
  END LOOP;

  UPDATE public.purchase_entries
  SET total_items = _total_items,
      total_quantity = _total_qty,
      total_cost = _total_cost
  WHERE id = _entry_id;

  RETURN _entry_id;
END;
$$;

-- 7. RPC: register sale movement (called from client after a sale insert)
CREATE OR REPLACE FUNCTION public.register_sale_movement(
  _sale_id UUID,
  _barcode TEXT,
  _product_name TEXT,
  _quantidade NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cost NUMERIC := 0;
  _new_stock NUMERIC := 0;
  _total_cost NUMERIC := 0;
BEGIN
  SELECT cost_avg, stock - _quantidade
    INTO _cost, _new_stock
    FROM public.products WHERE barcode = _barcode;

  IF NOT FOUND THEN
    _cost := 0;
    _new_stock := -_quantidade;
  ELSE
    UPDATE public.products SET stock = _new_stock WHERE barcode = _barcode;
  END IF;

  _total_cost := _cost * _quantidade;

  UPDATE public.sales
  SET unit_cost = _cost, total_cost = _total_cost
  WHERE id = _sale_id;

  INSERT INTO public.stock_movements (
    movement_type, barcode, product_name, quantidade, custo_unitario,
    custo_medio_apos, estoque_apos, reference_id, reference_type
  ) VALUES (
    'SAIDA', _barcode, COALESCE(_product_name,''), _quantidade, _cost, _cost, _new_stock, _sale_id, 'sale'
  );
END;
$$;