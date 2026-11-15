-- =====================================================================
-- Módulo de Estoque — núcleo
--  * papéis (gerente), helpers de permissão
--  * produtos: categoria, pendência de identificação, custo numeric(14,4)
--  * códigos alternativos (product_barcodes)
--  * kardex (stock_movements) ampliado: product_id, saldo anterior, usuário, dispositivo
--  * configuração de estoque (bloquear/avisar venda sem saldo)
--  * _apply_stock_movement: ÚNICA porta de escrita de saldo e custo médio
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helpers de permissão
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'manager')
  )
$$;

-- Usuário aprovado (perfil ativo e com algum papel)
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
     AND COALESCE((SELECT is_active FROM public.profiles WHERE id = _user_id), false)
$$;

-- ---------------------------------------------------------------------
-- 2. Produtos
-- ---------------------------------------------------------------------
ALTER TABLE public.products
  ALTER COLUMN cost_avg TYPE numeric(14,4) USING round(COALESCE(cost_avg, 0), 4),
  ALTER COLUMN cost_avg SET DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pendente_identificacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Código de barras único (só cria se não houver duplicados; lista os duplicados caso existam)
DO $$
DECLARE
  _dups text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
    WHERE i.indrelid = 'public.products'::regclass AND i.indisunique
      AND i.indnatts = 1 AND a.attname = 'barcode'
  ) THEN
    SELECT string_agg(barcode, ', ') INTO _dups
    FROM (SELECT barcode FROM public.products GROUP BY barcode HAVING count(*) > 1) d;
    IF _dups IS NULL THEN
      CREATE UNIQUE INDEX products_barcode_key ON public.products (barcode);
    ELSE
      RAISE NOTICE 'Códigos de barras duplicados em products (índice único NÃO criado): %', _dups;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_pendente ON public.products (pendente_identificacao) WHERE pendente_identificacao;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);

-- Leitura de produtos para usuários autenticados (a venda e o inventário precisam do saldo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "Authenticated can view products" ON public.products
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Códigos alternativos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product ON public.product_barcodes (product_id);

ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view product_barcodes" ON public.product_barcodes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert product_barcodes" ON public.product_barcodes
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_admin(auth.uid()));
CREATE POLICY "Managers delete product_barcodes" ON public.product_barcodes
  FOR DELETE TO authenticated USING (public.is_manager_or_admin(auth.uid()));

-- Um código não pode existir ao mesmo tempo como principal e alternativo
CREATE OR REPLACE FUNCTION public.check_barcode_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.barcode := trim(NEW.barcode);
  IF TG_TABLE_NAME = 'product_barcodes' THEN
    IF EXISTS (SELECT 1 FROM public.products WHERE barcode = NEW.barcode) THEN
      RAISE EXCEPTION 'O código % já é o código principal de um produto', NEW.barcode;
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.product_barcodes WHERE barcode = NEW.barcode AND product_id <> NEW.id) THEN
      RAISE EXCEPTION 'O código % já é código alternativo de outro produto', NEW.barcode;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_barcodes_unique ON public.product_barcodes;
CREATE TRIGGER trg_product_barcodes_unique
  BEFORE INSERT OR UPDATE OF barcode ON public.product_barcodes
  FOR EACH ROW EXECUTE FUNCTION public.check_barcode_uniqueness();

DROP TRIGGER IF EXISTS trg_products_barcode_unique ON public.products;
CREATE TRIGGER trg_products_barcode_unique
  BEFORE INSERT OR UPDATE OF barcode ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.check_barcode_uniqueness();

-- Resolve um código (principal ou alternativo) para o produto
CREATE OR REPLACE FUNCTION public.resolve_product(_barcode text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.products WHERE barcode = trim(_barcode) LIMIT 1),
    (SELECT product_id FROM public.product_barcodes WHERE barcode = trim(_barcode) LIMIT 1)
  )
$$;

-- ---------------------------------------------------------------------
-- 4. Proteção do saldo/custo: só as funções de estoque alteram
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _ctx boolean := COALESCE(current_setting('app.stock_ctx', true), '') = 'on';
BEGIN
  NEW.updated_at := now();
  IF _ctx THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Cadastros feitos fora do módulo de estoque nascem com saldo zero
    NEW.stock := 0;
    IF NOT public.is_manager_or_admin(auth.uid()) THEN
      NEW.cost_avg := 0;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.stock IS DISTINCT FROM OLD.stock THEN
    RAISE EXCEPTION 'O saldo de estoque só pode ser alterado por movimentações (nota, venda, inventário)';
  END IF;
  IF NEW.cost_avg IS DISTINCT FROM OLD.cost_avg AND NOT public.is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores ou gerentes podem alterar o custo médio';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_product_stock ON public.products;
CREATE TRIGGER trg_protect_product_stock
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.protect_product_stock();

-- ---------------------------------------------------------------------
-- 5. Kardex (stock_movements) ampliado
-- ---------------------------------------------------------------------
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS saldo_anterior numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_medio_anterior numeric(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usuario_id uuid,
  ADD COLUMN IF NOT EXISTS usuario_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS device_info text NOT NULL DEFAULT '';

-- Vários movimentos na mesma transação precisam de ordem cronológica estável
ALTER TABLE public.stock_movements ALTER COLUMN created_at SET DEFAULT clock_timestamp();

ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

-- Tipos antigos -> novos; quantidade passa a ser sempre com sinal (+ entra / - sai)
UPDATE public.stock_movements SET movement_type = 'ENTRADA_NOTA' WHERE movement_type = 'ENTRADA';
UPDATE public.stock_movements SET movement_type = 'SAIDA_VENDA', quantidade = -abs(quantidade) WHERE movement_type = 'SAIDA';
UPDATE public.stock_movements SET movement_type = 'AJUSTE_MANUAL' WHERE movement_type = 'AJUSTE';
UPDATE public.stock_movements m SET product_id = p.id
  FROM public.products p WHERE m.product_id IS NULL AND p.barcode = m.barcode;
UPDATE public.stock_movements SET saldo_anterior = estoque_apos - quantidade;

ALTER TABLE public.stock_movements
  ALTER COLUMN custo_unitario TYPE numeric(14,4) USING round(custo_unitario, 4),
  ALTER COLUMN custo_medio_apos TYPE numeric(14,4) USING round(custo_medio_apos, 4),
  ADD CONSTRAINT stock_movements_movement_type_check CHECK (movement_type IN (
    'ENTRADA_NOTA', 'ESTORNO_NOTA', 'SAIDA_VENDA', 'ESTORNO_VENDA',
    'AJUSTE_INVENTARIO', 'AJUSTE_MANUAL', 'MESCLAGEM'
  ));

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements (product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements (reference_id);

-- Só as funções gravam no kardex; leitura para usuários aprovados
DROP POLICY IF EXISTS "Authenticated insert stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Admins read stock_movements" ON public.stock_movements;
CREATE POLICY "Active users read stock_movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));

-- ---------------------------------------------------------------------
-- 6. Configuração de estoque
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bloquear_venda_sem_saldo boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.stock_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.stock_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read stock_settings" ON public.stock_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update stock_settings" ON public.stock_settings
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- 7. Nome do usuário para o kardex
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_display_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
    p.username,
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    ''
  )
  FROM (SELECT auth.uid() AS uid) u
  LEFT JOIN public.profiles p ON p.id = u.uid
$$;

-- ---------------------------------------------------------------------
-- 8. Movimentação de estoque (porta única)
--    _qtd com sinal. Custo médio só é recalculado em ENTRADA_NOTA / ESTORNO_NOTA.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_stock_movement(
  _product_id uuid,
  _tipo text,
  _qtd numeric,
  _custo_unit numeric DEFAULT NULL,
  _ref_id uuid DEFAULT NULL,
  _ref_type text DEFAULT '',
  _obs text DEFAULT '',
  _device text DEFAULT ''
)
RETURNS public.stock_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.products%ROWTYPE;
  _new_stock numeric;
  _new_cost numeric;
  _unit numeric;
  _mov public.stock_movements%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto % não encontrado', _product_id;
  END IF;

  _unit := COALESCE(_custo_unit, _p.cost_avg);
  _new_stock := _p.stock + _qtd;
  _new_cost := _p.cost_avg;

  IF _tipo = 'ENTRADA_NOTA' THEN
    IF _p.stock <= 0 THEN
      _new_cost := _unit;
    ELSE
      _new_cost := (_p.stock * _p.cost_avg + _qtd * _unit) / NULLIF(_p.stock + _qtd, 0);
    END IF;
  ELSIF _tipo = 'ESTORNO_NOTA' THEN
    -- Remove a entrada do custo médio, enquanto ainda houver saldo para isso
    IF _new_stock > 0 THEN
      _new_cost := (_p.stock * _p.cost_avg + _qtd * _unit) / _new_stock;
      IF _new_cost < 0 THEN
        _new_cost := _p.cost_avg;
      END IF;
    END IF;
  END IF;
  _new_cost := round(COALESCE(_new_cost, _p.cost_avg), 4);

  PERFORM set_config('app.stock_ctx', 'on', true);
  UPDATE public.products SET stock = _new_stock, cost_avg = _new_cost WHERE id = _product_id;
  PERFORM set_config('app.stock_ctx', 'off', true);

  INSERT INTO public.stock_movements (
    movement_type, product_id, barcode, product_name, quantidade, custo_unitario,
    saldo_anterior, estoque_apos, custo_medio_anterior, custo_medio_apos,
    reference_id, reference_type, observacoes, usuario_id, usuario_nome, device_info
  ) VALUES (
    _tipo, _product_id, _p.barcode, _p.product_name, _qtd, round(_unit, 4),
    _p.stock, _new_stock, _p.cost_avg, _new_cost,
    _ref_id, COALESCE(_ref_type, ''), COALESCE(_obs, ''), auth.uid(),
    COALESCE(public.current_user_display_name(), ''), COALESCE(_device, '')
  )
  RETURNING * INTO _mov;

  RETURN _mov;
END;
$$;

-- Cria produto a partir das funções de estoque (saldo 0; movimentos ajustam depois)
CREATE OR REPLACE FUNCTION public._create_stock_product(
  _barcode text,
  _name text,
  _price numeric DEFAULT 0,
  _pendente boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  PERFORM set_config('app.stock_ctx', 'on', true);
  INSERT INTO public.products (barcode, product_name, price, cost_avg, stock, pendente_identificacao)
  VALUES (trim(_barcode), _name, COALESCE(_price, 0), 0, 0, _pendente)
  RETURNING id INTO _id;
  PERFORM set_config('app.stock_ctx', 'off', true);
  RETURN _id;
END;
$$;

-- Funções internas não podem ser chamadas diretamente pela API
REVOKE ALL ON FUNCTION public._apply_stock_movement(uuid, text, numeric, numeric, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._create_stock_product(text, text, numeric, boolean) FROM PUBLIC, anon, authenticated;
