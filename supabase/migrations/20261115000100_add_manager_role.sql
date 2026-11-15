-- Módulo de Estoque: novo papel "gerente".
-- ALTER TYPE ... ADD VALUE precisa ficar em migration própria (não pode ser usado na mesma transação).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
