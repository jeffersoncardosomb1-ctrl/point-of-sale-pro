-- Create orders table (parent for sales)
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor TEXT NOT NULL,
  forma_pagamento payment_method NOT NULL DEFAULT 'PIX',
  status sale_status NOT NULL DEFAULT 'ATIVA',
  total_bruto NUMERIC NOT NULL DEFAULT 0,
  total_desconto NUMERIC NOT NULL DEFAULT 0,
  total_liquido NUMERIC NOT NULL DEFAULT 0,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  troco NUMERIC NOT NULL DEFAULT 0,
  canceled_at TIMESTAMP WITH TIME ZONE,
  cancel_motivo TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add order_id to sales table to link items to orders
ALTER TABLE public.sales 
ADD COLUMN order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

-- Add discount percentage column to sales (per product)
ALTER TABLE public.sales 
ADD COLUMN desconto_percentual NUMERIC NOT NULL DEFAULT 0;

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS policies for orders (same as sales - public access)
CREATE POLICY "Allow public read access to orders" 
ON public.orders FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to orders" 
ON public.orders FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to orders" 
ON public.orders FOR UPDATE 
USING (true);

CREATE POLICY "Admins can delete cancelled orders" 
ON public.orders FOR DELETE 
USING (is_admin(auth.uid()) AND status = 'CANCELADA');

-- Add orders to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders;