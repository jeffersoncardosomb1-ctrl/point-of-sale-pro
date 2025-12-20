-- Allow admins to delete cancelled sales
CREATE POLICY "Admins can delete cancelled sales"
ON public.sales
FOR DELETE
USING (
  is_admin(auth.uid()) AND status = 'CANCELADA'
);