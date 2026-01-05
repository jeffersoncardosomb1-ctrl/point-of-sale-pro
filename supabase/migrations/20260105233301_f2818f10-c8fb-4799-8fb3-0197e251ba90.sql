-- Add price column to products table
ALTER TABLE public.products
ADD COLUMN price NUMERIC NOT NULL DEFAULT 0;