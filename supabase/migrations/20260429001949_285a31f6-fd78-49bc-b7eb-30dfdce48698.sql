CREATE POLICY "Authenticated can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);