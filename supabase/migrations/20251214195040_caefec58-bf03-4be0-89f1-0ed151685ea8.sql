-- Create enum for payment method
CREATE TYPE public.payment_method AS ENUM ('PIX', 'CARTAO', 'DINHEIRO', 'BOLETO', 'OUTROS');

-- Create enum for sale status
CREATE TYPE public.sale_status AS ENUM ('ATIVA', 'CANCELADA');

-- Create sales table
CREATE TABLE public.sales (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    vendedor TEXT NOT NULL,
    barcode TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL DEFAULT '',
    quantidade INTEGER NOT NULL DEFAULT 1,
    valor_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_bruto NUMERIC(12, 2) NOT NULL DEFAULT 0,
    desconto NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_liquido NUMERIC(12, 2) NOT NULL DEFAULT 0,
    valor_pago NUMERIC(12, 2) NOT NULL DEFAULT 0,
    troco NUMERIC(12, 2) NOT NULL DEFAULT 0,
    forma_pagamento payment_method NOT NULL DEFAULT 'PIX',
    status sale_status NOT NULL DEFAULT 'ATIVA',
    cancel_motivo TEXT DEFAULT '',
    canceled_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (for this sales system without auth)
CREATE POLICY "Allow public read access to sales"
ON public.sales
FOR SELECT
USING (true);

-- Create policy for public insert access
CREATE POLICY "Allow public insert access to sales"
ON public.sales
FOR INSERT
WITH CHECK (true);

-- Create policy for public update access
CREATE POLICY "Allow public update access to sales"
ON public.sales
FOR UPDATE
USING (true);

-- Create index for faster queries
CREATE INDEX idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX idx_sales_vendedor ON public.sales(vendedor);
CREATE INDEX idx_sales_status ON public.sales(status);

-- Enable realtime for sales table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;