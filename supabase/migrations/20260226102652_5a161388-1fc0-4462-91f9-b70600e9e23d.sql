
ALTER TABLE public.orders ADD COLUMN pgto_pix numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN pgto_cartao numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN pgto_dinheiro numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN pgto_boleto numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN pgto_outros numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN observacoes text NOT NULL DEFAULT '';

ALTER TABLE public.sales ADD COLUMN pgto_pix numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN pgto_cartao numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN pgto_dinheiro numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN pgto_boleto numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN pgto_outros numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN observacoes text NOT NULL DEFAULT '';
